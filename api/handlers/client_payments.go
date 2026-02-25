package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	neturl "net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type stripeRESTClient struct {
	secretKey  string
	httpClient *http.Client
}

type createClientCheckoutSessionInput struct {
	CaseID uint `json:"caseId" binding:"required"`
}

func newStripeRESTClientFromEnv() (*stripeRESTClient, error) {
	secret := strings.TrimSpace(os.Getenv("STRIPE_SECRET_KEY"))
	if secret == "" {
		return nil, fmt.Errorf("Stripe no está configurado")
	}
	return &stripeRESTClient{
		secretKey: secret,
		httpClient: &http.Client{
			Timeout: 20 * time.Second,
		},
	}, nil
}

func (s *stripeRESTClient) doForm(path string, form neturl.Values) (map[string]interface{}, int, error) {
	req, err := http.NewRequest(http.MethodPost, "https://api.stripe.com"+path, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(s.secretKey, "")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var payload map[string]interface{}
	if len(body) > 0 {
		_ = json.Unmarshal(body, &payload)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return payload, resp.StatusCode, fmt.Errorf(stripeErrorMessage(payload, resp.StatusCode))
	}
	return payload, resp.StatusCode, nil
}

func (s *stripeRESTClient) doGet(path string, query neturl.Values) (map[string]interface{}, int, error) {
	fullURL := "https://api.stripe.com" + path
	if len(query) > 0 {
		fullURL += "?" + query.Encode()
	}
	req, err := http.NewRequest(http.MethodGet, fullURL, nil)
	if err != nil {
		return nil, 0, err
	}
	req.SetBasicAuth(s.secretKey, "")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var payload map[string]interface{}
	if len(body) > 0 {
		_ = json.Unmarshal(body, &payload)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return payload, resp.StatusCode, fmt.Errorf(stripeErrorMessage(payload, resp.StatusCode))
	}
	return payload, resp.StatusCode, nil
}

func stripeErrorMessage(payload map[string]interface{}, statusCode int) string {
	if payload != nil {
		if errObj, ok := payload["error"].(map[string]interface{}); ok {
			if msg, ok := errObj["message"].(string); ok && strings.TrimSpace(msg) != "" {
				return msg
			}
		}
	}
	return fmt.Sprintf("Stripe error (%d)", statusCode)
}

func (s *stripeRESTClient) ensureCustomer(db *gorm.DB, user *models.User) (string, error) {
	if user.StripeCustomerID != nil && strings.TrimSpace(*user.StripeCustomerID) != "" {
		return strings.TrimSpace(*user.StripeCustomerID), nil
	}

	form := neturl.Values{}
	form.Set("email", user.Email)
	name := strings.TrimSpace(strings.TrimSpace(user.FirstName) + " " + strings.TrimSpace(user.LastName))
	if name != "" {
		form.Set("name", name)
	}
	form.Set("metadata[user_id]", strconv.FormatUint(uint64(user.ID), 10))
	form.Set("metadata[source]", "caf-client-app")

	payload, _, err := s.doForm("/v1/customers", form)
	if err != nil {
		return "", err
	}
	customerID, _ := payload["id"].(string)
	customerID = strings.TrimSpace(customerID)
	if customerID == "" {
		return "", fmt.Errorf("Stripe no devolvió customer id")
	}

	if err := db.Model(&models.User{}).
		Where("id = ?", user.ID).
		Update("stripe_customer_id", customerID).Error; err != nil {
		return "", err
	}
	user.StripeCustomerID = &customerID
	return customerID, nil
}

// GetClientPaymentReceipts returns Stripe receipts (charges) for the authenticated client.
func GetClientPaymentReceipts(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		currentUserRaw, exists := c.Get("currentUser")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no autenticado"})
			return
		}
		user := currentUserRaw.(models.User)
		if user.Role != "client" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo clientes pueden consultar recibos"})
			return
		}

		stripeClient, err := newStripeRESTClientFromEnv()
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":    "Pagos no configurados",
				"message":  "Stripe no está configurado todavía en el servidor.",
				"receipts": []interface{}{},
			})
			return
		}

		if user.StripeCustomerID == nil || strings.TrimSpace(*user.StripeCustomerID) == "" {
			c.JSON(http.StatusOK, gin.H{
				"receipts": []interface{}{},
				"total":    0,
			})
			return
		}

		limit := c.DefaultQuery("limit", "20")
		if _, err := strconv.Atoi(limit); err != nil {
			limit = "20"
		}
		query := neturl.Values{}
		query.Set("customer", strings.TrimSpace(*user.StripeCustomerID))
		query.Set("limit", limit)

		payload, _, err := stripeClient.doGet("/v1/charges", query)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "No se pudieron obtener recibos", "message": err.Error()})
			return
		}

		rawData, _ := payload["data"].([]interface{})
		receipts := make([]gin.H, 0, len(rawData))
		for _, item := range rawData {
			chargeMap, ok := item.(map[string]interface{})
			if !ok {
				continue
			}
			metadata, _ := chargeMap["metadata"].(map[string]interface{})
			caseID, _ := strconv.Atoi(strings.TrimSpace(asStripeString(metadata["case_id"])))
			var createdAt interface{}
			if createdUnix, ok := toStripeInt64(chargeMap["created"]); ok && createdUnix > 0 {
				createdAt = time.Unix(createdUnix, 0).UTC()
			}
			receipts = append(receipts, gin.H{
				"id":          asStripeString(chargeMap["id"]),
				"amountCents": toStripeInt(chargeMap["amount"]),
				"currency":    strings.ToUpper(asStripeString(chargeMap["currency"])),
				"status":      asStripeString(chargeMap["status"]),
				"paid":        toStripeBool(chargeMap["paid"]),
				"receiptUrl":  asStripeString(chargeMap["receipt_url"]),
				"description": asStripeString(chargeMap["description"]),
				"caseId":      caseID,
				"createdAt":   createdAt,
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"receipts": receipts,
			"total":    len(receipts),
		})
	}
}

// CreateClientCheckoutSession creates a Stripe Checkout Session URL for paying a case fee.
func CreateClientCheckoutSession(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		currentUserRaw, exists := c.Get("currentUser")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no autenticado"})
			return
		}
		user := currentUserRaw.(models.User)
		if user.Role != "client" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo clientes pueden crear pagos"})
			return
		}

		var input createClientCheckoutSessionInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var caseRecord models.Case
		if err := db.Preload("Office").
			Where("id = ? AND client_id = ?", input.CaseID, user.ID).
			First(&caseRecord).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Caso no encontrado"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo validar el caso"})
			return
		}
		if caseRecord.Fee <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "El caso no tiene un monto disponible para pago"})
			return
		}

		successURL := strings.TrimSpace(os.Getenv("STRIPE_CHECKOUT_SUCCESS_URL"))
		cancelURL := strings.TrimSpace(os.Getenv("STRIPE_CHECKOUT_CANCEL_URL"))
		if successURL == "" || cancelURL == "" {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":   "Pagos no configurados",
				"message": "Faltan STRIPE_CHECKOUT_SUCCESS_URL y/o STRIPE_CHECKOUT_CANCEL_URL en el servidor.",
			})
			return
		}
		successURL = appendStripeCheckoutReturnQuery(successURL, map[string]string{
			"checkout":   "stripe",
			"status":     "success",
			"case_id":    strconv.FormatUint(uint64(caseRecord.ID), 10),
			"session_id": "{CHECKOUT_SESSION_ID}",
		})
		cancelURL = appendStripeCheckoutReturnQuery(cancelURL, map[string]string{
			"checkout": "stripe",
			"status":   "cancel",
			"case_id":  strconv.FormatUint(uint64(caseRecord.ID), 10),
		})

		stripeClient, err := newStripeRESTClientFromEnv()
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Pagos no configurados", "message": err.Error()})
			return
		}

		customerID, err := stripeClient.ensureCustomer(db, &user)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "No se pudo preparar el cliente de pago", "message": err.Error()})
			return
		}

		amountCents := int(math.Round(caseRecord.Fee * 100))
		if amountCents <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Monto inválido para pago"})
			return
		}

		currency := strings.ToLower(strings.TrimSpace(os.Getenv("STRIPE_CURRENCY")))
		if currency == "" {
			currency = "mxn"
		}

		form := neturl.Values{}
		form.Set("mode", "payment")
		form.Set("customer", customerID)
		form.Set("success_url", successURL)
		form.Set("cancel_url", cancelURL)
		form.Set("client_reference_id", strconv.FormatUint(uint64(user.ID), 10))
		form.Set("metadata[user_id]", strconv.FormatUint(uint64(user.ID), 10))
		form.Set("metadata[case_id]", strconv.FormatUint(uint64(caseRecord.ID), 10))
		form.Set("metadata[source]", "caf-client-app")
		form.Set("payment_intent_data[metadata][user_id]", strconv.FormatUint(uint64(user.ID), 10))
		form.Set("payment_intent_data[metadata][case_id]", strconv.FormatUint(uint64(caseRecord.ID), 10))
		form.Set("payment_intent_data[metadata][source]", "caf-client-app")
		form.Set("line_items[0][quantity]", "1")
		form.Set("line_items[0][price_data][currency]", currency)
		form.Set("line_items[0][price_data][unit_amount]", strconv.Itoa(amountCents))
		form.Set("line_items[0][price_data][product_data][name]", buildStripeCaseProductName(caseRecord))
		form.Set("line_items[0][price_data][product_data][description]", buildStripeCaseProductDescription(caseRecord))

		payload, _, err := stripeClient.doForm("/v1/checkout/sessions", form)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "No se pudo crear la sesión de pago", "message": err.Error()})
			return
		}

		sessionID := asStripeString(payload["id"])
		checkoutURL := asStripeString(payload["url"])
		if sessionID == "" || checkoutURL == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Respuesta inválida de Stripe"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"sessionId":   sessionID,
			"checkoutUrl": checkoutURL,
			"currency":    strings.ToUpper(currency),
			"amountCents": amountCents,
			"caseId":      caseRecord.ID,
			"customerId":  customerID,
		})
	}
}

func buildStripeCaseProductName(caseRecord models.Case) string {
	if strings.TrimSpace(caseRecord.Title) != "" {
		return fmt.Sprintf("CAF - Pago de caso #%d: %s", caseRecord.ID, strings.TrimSpace(caseRecord.Title))
	}
	return fmt.Sprintf("CAF - Pago de caso #%d", caseRecord.ID)
}

func buildStripeCaseProductDescription(caseRecord models.Case) string {
	parts := make([]string, 0, 3)
	if strings.TrimSpace(caseRecord.Category) != "" {
		parts = append(parts, "Categoría: "+strings.TrimSpace(caseRecord.Category))
	}
	if caseRecord.Office != nil && strings.TrimSpace(caseRecord.Office.Name) != "" {
		parts = append(parts, "Oficina: "+strings.TrimSpace(caseRecord.Office.Name))
	}
	if strings.TrimSpace(caseRecord.CurrentStage) != "" {
		parts = append(parts, "Etapa: "+strings.TrimSpace(caseRecord.CurrentStage))
	}
	if len(parts) == 0 {
		return "Pago de servicio CAF"
	}
	return strings.Join(parts, " | ")
}

func appendStripeCheckoutReturnQuery(rawURL string, params map[string]string) string {
	parsed, err := neturl.Parse(rawURL)
	if err != nil || parsed == nil {
		return rawURL
	}
	q := parsed.Query()
	for key, value := range params {
		if strings.TrimSpace(key) == "" || strings.TrimSpace(value) == "" {
			continue
		}
		if _, exists := q[key]; !exists {
			q.Set(key, value)
		}
	}
	parsed.RawQuery = q.Encode()
	encodedSessionPlaceholder := neturl.QueryEscape("{CHECKOUT_SESSION_ID}")
	parsed.RawQuery = strings.ReplaceAll(
		parsed.RawQuery,
		encodedSessionPlaceholder,
		"{CHECKOUT_SESSION_ID}",
	)
	return parsed.String()
}

func asStripeString(v interface{}) string {
	if v == nil {
		return ""
	}
	switch x := v.(type) {
	case string:
		return x
	default:
		return fmt.Sprintf("%v", x)
	}
}

func toStripeInt(v interface{}) int {
	switch x := v.(type) {
	case float64:
		return int(x)
	case int:
		return x
	case int64:
		return int(x)
	default:
		return 0
	}
}

func toStripeInt64(v interface{}) (int64, bool) {
	switch x := v.(type) {
	case float64:
		return int64(x), true
	case int64:
		return x, true
	case int:
		return int64(x), true
	default:
		return 0, false
	}
}

func toStripeBool(v interface{}) bool {
	switch x := v.(type) {
	case bool:
		return x
	default:
		return false
	}
}
