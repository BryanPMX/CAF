package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type stripeWebhookEnvelope struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Created  int64  `json:"created"`
	LiveMode bool   `json:"livemode"`
	Data     struct {
		Object map[string]interface{} `json:"object"`
	} `json:"data"`
}

// StripeWebhook receives Stripe event notifications and persists payment state server-side.
// Uses Stripe-Signature HMAC verification via STRIPE_WEBHOOK_SECRET.
func StripeWebhook(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		webhookSecret := strings.TrimSpace(os.Getenv("STRIPE_WEBHOOK_SECRET"))
		if webhookSecret == "" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Stripe webhook no configurado"})
			return
		}

		payload, err := c.GetRawData()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No se pudo leer el body del webhook"})
			return
		}

		if err := verifyStripeWebhookSignature(
			payload,
			c.GetHeader("Stripe-Signature"),
			webhookSecret,
			stripeWebhookTolerance(),
		); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Firma Stripe inválida"})
			return
		}

		var event stripeWebhookEnvelope
		if err := json.Unmarshal(payload, &event); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Payload Stripe inválido"})
			return
		}

		switch event.Type {
		case "checkout.session.completed",
			"checkout.session.async_payment_succeeded",
			"checkout.session.async_payment_failed",
			"checkout.session.expired":
			record, becamePaid, err := upsertPaymentRecordFromCheckoutSessionEvent(db, event)
			if err != nil {
				c.JSON(http.StatusBadGateway, gin.H{"error": "No se pudo procesar el evento Stripe"})
				return
			}
			if becamePaid {
				onStripePaymentSucceeded(db, *record)
			}
		case "charge.refunded":
			_ = applyStripeRefundEvent(db, event) // best-effort; keep webhook ACK idempotent
		default:
			// Ignore unsupported events but ACK so Stripe doesn't retry.
		}

		c.JSON(http.StatusOK, gin.H{"received": true})
	}
}

func stripeWebhookTolerance() time.Duration {
	seconds := 300
	if raw := strings.TrimSpace(os.Getenv("STRIPE_WEBHOOK_TOLERANCE_SECONDS")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 3600 {
			seconds = parsed
		}
	}
	return time.Duration(seconds) * time.Second
}

func verifyStripeWebhookSignature(payload []byte, signatureHeader, secret string, tolerance time.Duration) error {
	if strings.TrimSpace(signatureHeader) == "" {
		return fmt.Errorf("missing Stripe-Signature")
	}
	if strings.TrimSpace(secret) == "" {
		return fmt.Errorf("missing webhook secret")
	}

	var timestamp int64
	var signatures []string
	for _, part := range strings.Split(signatureHeader, ",") {
		part = strings.TrimSpace(part)
		switch {
		case strings.HasPrefix(part, "t="):
			if ts, err := strconv.ParseInt(strings.TrimPrefix(part, "t="), 10, 64); err == nil {
				timestamp = ts
			}
		case strings.HasPrefix(part, "v1="):
			sig := strings.TrimSpace(strings.TrimPrefix(part, "v1="))
			if sig != "" {
				signatures = append(signatures, sig)
			}
		}
	}

	if timestamp == 0 || len(signatures) == 0 {
		return fmt.Errorf("invalid signature header")
	}

	now := time.Now().Unix()
	if tolerance > 0 && absInt64(now-timestamp) > int64(tolerance.Seconds()) {
		return fmt.Errorf("signature timestamp outside tolerance")
	}

	signedPayload := fmt.Sprintf("%d.%s", timestamp, string(payload))
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(signedPayload))
	expected := hex.EncodeToString(mac.Sum(nil))

	for _, sig := range signatures {
		if hmac.Equal([]byte(strings.ToLower(sig)), []byte(expected)) {
			return nil
		}
	}
	return fmt.Errorf("no matching v1 signature")
}

func absInt64(v int64) int64 {
	if v < 0 {
		return -v
	}
	return v
}

func upsertPaymentRecordFromCheckoutSessionEvent(db *gorm.DB, event stripeWebhookEnvelope) (*models.PaymentRecord, bool, error) {
	obj := event.Data.Object
	if obj == nil {
		return nil, false, fmt.Errorf("missing checkout session object")
	}

	sessionID := strings.TrimSpace(asStripeString(obj["id"]))
	if sessionID == "" {
		return nil, false, fmt.Errorf("missing checkout session id")
	}

	metadata := stripeMetadataObject(obj["metadata"])
	userID := parseStripeMetadataUint(metadata, "user_id")
	if userID == nil {
		userID = parseStripeStringUint(strings.TrimSpace(asStripeString(obj["client_reference_id"])))
	}
	caseID := parseStripeMetadataUint(metadata, "case_id")

	status, paymentStatus, paidAt := normalizeStripeCheckoutSessionStatus(event, obj)
	amountCents, _ := toStripeInt64(obj["amount_total"])
	currency := strings.ToUpper(strings.TrimSpace(asStripeString(obj["currency"])))
	paymentIntentID := strings.TrimSpace(asStripeString(obj["payment_intent"]))
	customerID := strings.TrimSpace(asStripeString(obj["customer"]))
	checkoutURL := strings.TrimSpace(asStripeString(obj["url"]))
	liveMode := toStripeBool(obj["livemode"])
	if !liveMode {
		liveMode = event.LiveMode
	}

	record := models.PaymentRecord{}
	existed := false
	wasPaid := false

	tx := db.Begin()
	if tx.Error != nil {
		return nil, false, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()

	if err := tx.Where("stripe_checkout_session_id = ?", sessionID).First(&record).Error; err == nil {
		existed = true
		wasPaid = record.PaidAt != nil && (record.Status == "succeeded" || record.PaymentStatus == "paid")
	} else if err != nil && err != gorm.ErrRecordNotFound {
		tx.Rollback()
		return nil, false, err
	}

	record.StripeEventID = strings.TrimSpace(event.ID)
	record.StripeCheckoutSessionID = sessionID
	record.StripePaymentIntentID = paymentIntentID
	record.StripeCustomerID = customerID
	record.EventType = event.Type
	record.Status = status
	record.PaymentStatus = paymentStatus
	if src := strings.TrimSpace(asStripeString(metadata["source"])); src != "" {
		record.Source = src
	} else if strings.TrimSpace(record.Source) == "" {
		record.Source = "stripe_checkout"
	}
	record.Currency = currency
	record.AmountCents = amountCents
	record.LiveMode = liveMode
	if checkoutURL != "" {
		record.CheckoutURL = checkoutURL
	}
	record.ClientMetadata = metadata
	record.RawObject = obj
	if userID != nil {
		record.UserID = userID
	}
	if caseID != nil {
		record.CaseID = caseID
	}
	if paidAt != nil && record.PaidAt == nil {
		record.PaidAt = paidAt
	}
	if wasPaid && status != "succeeded" {
		record.Status = "succeeded"
		if strings.TrimSpace(record.PaymentStatus) == "" {
			record.PaymentStatus = "paid"
		}
	}

	var err error
	if existed {
		err = tx.Save(&record).Error
	} else {
		err = tx.Create(&record).Error
		if err != nil && isUniqueViolation(err) {
			tx.Rollback()
			var existing models.PaymentRecord
			if ferr := db.Where("stripe_checkout_session_id = ?", sessionID).First(&existing).Error; ferr == nil {
				return &existing, false, nil
			}
			return nil, false, err
		}
	}
	if err != nil {
		tx.Rollback()
		return nil, false, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, false, err
	}

	becamePaid := !wasPaid && record.PaidAt != nil && (record.Status == "succeeded" || record.PaymentStatus == "paid")
	return &record, becamePaid, nil
}

func normalizeStripeCheckoutSessionStatus(event stripeWebhookEnvelope, obj map[string]interface{}) (status string, paymentStatus string, paidAt *time.Time) {
	paymentStatus = strings.ToLower(strings.TrimSpace(asStripeString(obj["payment_status"])))
	status = "pending"

	switch event.Type {
	case "checkout.session.expired":
		status = "expired"
	case "checkout.session.async_payment_failed":
		status = "failed"
	case "checkout.session.async_payment_succeeded":
		status = "succeeded"
	case "checkout.session.completed":
		if paymentStatus == "paid" {
			status = "succeeded"
		} else {
			status = "pending"
		}
	}

	if status == "succeeded" || paymentStatus == "paid" {
		var ts time.Time
		if event.Created > 0 {
			ts = time.Unix(event.Created, 0).UTC()
		} else if createdUnix, ok := toStripeInt64(obj["created"]); ok && createdUnix > 0 {
			ts = time.Unix(createdUnix, 0).UTC()
		} else {
			ts = time.Now().UTC()
		}
		paidAt = &ts
	}
	return status, paymentStatus, paidAt
}

func stripeMetadataObject(v interface{}) map[string]interface{} {
	if v == nil {
		return map[string]interface{}{}
	}
	if m, ok := v.(map[string]interface{}); ok {
		return m
	}
	return map[string]interface{}{}
}

func parseStripeMetadataUint(metadata map[string]interface{}, key string) *uint {
	if metadata == nil {
		return nil
	}
	return parseStripeStringUint(strings.TrimSpace(asStripeString(metadata[key])))
}

func parseStripeStringUint(value string) *uint {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parsed, err := strconv.ParseUint(value, 10, 32)
	if err != nil || parsed == 0 {
		return nil
	}
	u := uint(parsed)
	return &u
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate key") || strings.Contains(msg, "unique constraint")
}

func onStripePaymentSucceeded(db *gorm.DB, record models.PaymentRecord) {
	caseID := record.CaseID
	if caseID == nil || *caseID == 0 {
		return
	}

	var caseRecord models.Case
	if err := db.Select("id, title, office_id, client_id, primary_staff_id").
		Where("id = ?", *caseID).
		First(&caseRecord).Error; err != nil {
		return
	}

	createClientVisiblePaymentCaseEvent(db, caseRecord, record)
	notifyClientAndPortalUsersForStripePayment(db, caseRecord, record)
	invalidateCache(strconv.FormatUint(uint64(caseRecord.ID), 10))
}

func createClientVisiblePaymentCaseEvent(db *gorm.DB, caseRecord models.Case, record models.PaymentRecord) {
	if caseRecord.ClientID == nil || *caseRecord.ClientID == 0 {
		return
	}
	if strings.TrimSpace(record.StripeCheckoutSessionID) == "" {
		return
	}

	var existingCount int64
	if err := db.Model(&models.CaseEvent{}).
		Where("case_id = ? AND event_type = ?", caseRecord.ID, "payment_received").
		Where("metadata ->> 'stripe_checkout_session_id' = ?", record.StripeCheckoutSessionID).
		Count(&existingCount).Error; err == nil && existingCount > 0 {
		return
	}

	amountLabel := formatPaymentAmountLabel(record)
	comment := fmt.Sprintf("Pago recibido por %s vía Stripe Checkout.", amountLabel)
	if caseRecord.Title != "" {
		comment = fmt.Sprintf("Pago recibido para el caso \"%s\" por %s vía Stripe Checkout.", caseRecord.Title, amountLabel)
	}

	event := models.CaseEvent{
		CaseID:      caseRecord.ID,
		UserID:      *caseRecord.ClientID, // Representa el pago iniciado por el cliente; webhook valida la liquidación.
		EventType:   "payment_received",
		Visibility:  "client_visible",
		CommentText: comment,
		Description: "Stripe webhook payment confirmation",
		Metadata: map[string]interface{}{
			"source":                     "stripe_webhook",
			"payment_record_id":          record.ID,
			"stripe_checkout_session_id": record.StripeCheckoutSessionID,
			"stripe_payment_intent_id":   record.StripePaymentIntentID,
			"amount_cents":               record.AmountCents,
			"currency":                   record.Currency,
		},
	}
	_ = db.Create(&event).Error
}

func notifyClientAndPortalUsersForStripePayment(db *gorm.DB, caseRecord models.Case, record models.PaymentRecord) {
	link := "/app/cases/" + strconv.FormatUint(uint64(caseRecord.ID), 10)
	entityID := record.ID
	amountLabel := formatPaymentAmountLabel(record)

	if caseRecord.ClientID != nil && *caseRecord.ClientID != 0 {
		clientMsg := fmt.Sprintf("CAF confirmó tu pago de %s para el caso #%d.", amountLabel, caseRecord.ID)
		dedupKey := "stripe-payment-client:" + strings.TrimSpace(record.StripeCheckoutSessionID)
		_ = CreateNotificationWithMeta(db, *caseRecord.ClientID, clientMsg, "success", nil, "payment", &entityID, dedupKey)
		SendUserNotification(strconv.FormatUint(uint64(*caseRecord.ClientID), 10), map[string]interface{}{
			"message":    clientMsg,
			"type":       "success",
			"entityType": "payment",
			"entityId":   &entityID,
		})
	}

	recipientSet := map[uint]struct{}{}
	if ids, err := GetAdminUserIDs(db); err == nil {
		for _, id := range ids {
			recipientSet[id] = struct{}{}
		}
	}
	if ids, err := GetOfficeManagerUserIDs(db, caseRecord.OfficeID); err == nil {
		for _, id := range ids {
			recipientSet[id] = struct{}{}
		}
	}
	if caseRecord.PrimaryStaffID != nil && *caseRecord.PrimaryStaffID != 0 {
		recipientSet[*caseRecord.PrimaryStaffID] = struct{}{}
	}
	var assignedIDs []uint
	if err := db.Model(&models.UserCaseAssignment{}).
		Where("case_id = ? AND deleted_at IS NULL", caseRecord.ID).
		Pluck("user_id", &assignedIDs).Error; err == nil {
		for _, id := range assignedIDs {
			recipientSet[id] = struct{}{}
		}
	}

	recipientIDs := make([]uint, 0, len(recipientSet))
	for id := range recipientSet {
		if id != 0 {
			recipientIDs = append(recipientIDs, id)
		}
	}
	if len(recipientIDs) == 0 {
		return
	}

	var activePortalUserIDs []uint
	if err := db.Model(&models.User{}).
		Where("id IN ? AND role <> ? AND is_active = ? AND deleted_at IS NULL", recipientIDs, "client", true).
		Pluck("id", &activePortalUserIDs).Error; err != nil {
		return
	}

	portalMsg := fmt.Sprintf("Pago recibido por %s en el caso #%d.", amountLabel, caseRecord.ID)
	dedupKey := "stripe-payment-portal:" + strings.TrimSpace(record.StripeCheckoutSessionID)
	for _, recipientID := range activePortalUserIDs {
		_ = CreateNotificationWithMeta(db, recipientID, portalMsg, "success", &link, "payment", &entityID, dedupKey)
		SendUserNotification(strconv.FormatUint(uint64(recipientID), 10), map[string]interface{}{
			"message":    portalMsg,
			"type":       "success",
			"link":       &link,
			"entityType": "payment",
			"entityId":   &entityID,
		})
	}
}

func formatPaymentAmountLabel(record models.PaymentRecord) string {
	amount := float64(record.AmountCents-record.RefundedCents) / 100.0
	if amount < 0 {
		amount = 0
	}
	currency := strings.ToUpper(strings.TrimSpace(record.Currency))
	if currency == "" {
		currency = "MXN"
	}
	return fmt.Sprintf("%s %.2f", currency, amount)
}

func applyStripeRefundEvent(db *gorm.DB, event stripeWebhookEnvelope) error {
	obj := event.Data.Object
	if obj == nil {
		return nil
	}
	paymentIntentID := strings.TrimSpace(asStripeString(obj["payment_intent"]))
	chargeID := strings.TrimSpace(asStripeString(obj["id"]))
	if paymentIntentID == "" && chargeID == "" {
		return nil
	}

	var record models.PaymentRecord
	query := db.Model(&models.PaymentRecord{})
	if paymentIntentID != "" {
		query = query.Where("stripe_payment_intent_id = ?", paymentIntentID)
	} else {
		query = query.Where("stripe_charge_id = ?", chargeID)
	}
	if err := query.First(&record).Error; err != nil {
		return nil
	}

	refundedCents, _ := toStripeInt64(obj["amount_refunded"])
	record.StripeEventID = strings.TrimSpace(event.ID)
	record.EventType = event.Type
	if chargeID != "" {
		record.StripeChargeID = chargeID
	}
	record.RefundedCents = refundedCents
	if record.AmountCents > 0 && refundedCents >= record.AmountCents {
		record.Status = "refunded"
	} else if refundedCents > 0 {
		record.Status = "partially_refunded"
	}
	now := time.Now().UTC()
	record.RefundedAt = &now
	record.RawObject = obj
	return db.Save(&record).Error
}
