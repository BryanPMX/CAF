package models

import (
	"time"

	"gorm.io/gorm"
)

// PaymentRecord stores Stripe payment lifecycle data processed by server-side webhooks.
// It is the source of truth for financial dashboards/reports inside CAF.
type PaymentRecord struct {
	ID uint `gorm:"primaryKey" json:"id"`

	UserID *uint `gorm:"index" json:"userId,omitempty"`
	User   *User `gorm:"foreignKey:UserID" json:"user,omitempty"`

	CaseID *uint `gorm:"index" json:"caseId,omitempty"`
	Case   *Case `gorm:"foreignKey:CaseID" json:"case,omitempty"`

	StripeEventID           string `gorm:"size:255;index" json:"stripeEventId"`
	StripeCheckoutSessionID string `gorm:"column:stripe_checkout_session_id;size:255;uniqueIndex:ux_payment_records_checkout_session_id" json:"stripeCheckoutSessionId"`
	StripePaymentIntentID   string `gorm:"column:stripe_payment_intent_id;size:255;index" json:"stripePaymentIntentId"`
	StripeChargeID          string `gorm:"column:stripe_charge_id;size:255;index" json:"stripeChargeId"`
	StripeCustomerID        string `gorm:"column:stripe_customer_id;size:255;index" json:"stripeCustomerId"`

	EventType      string                 `gorm:"size:100;index" json:"eventType"`
	Status         string                 `gorm:"size:50;index" json:"status"`        // pending, succeeded, failed, expired, refunded
	PaymentStatus  string                 `gorm:"size:50;index" json:"paymentStatus"` // Stripe checkout payment_status
	Source         string                 `gorm:"size:100;default:'stripe_checkout'" json:"source"`
	Currency       string                 `gorm:"size:16" json:"currency"`
	AmountCents    int64                  `gorm:"not null;default:0" json:"amountCents"`
	RefundedCents  int64                  `gorm:"not null;default:0" json:"refundedCents"`
	ReceiptURL     string                 `gorm:"size:1000" json:"receiptUrl"`
	CheckoutURL    string                 `gorm:"size:1000" json:"checkoutUrl"`
	LiveMode       bool                   `gorm:"default:false;index" json:"liveMode"`
	ClientMetadata map[string]interface{} `gorm:"type:jsonb" json:"clientMetadata,omitempty"`
	RawObject      map[string]interface{} `gorm:"type:jsonb" json:"rawObject,omitempty"`

	PaidAt     *time.Time     `gorm:"index;type:timestamp" json:"paidAt,omitempty"`
	RefundedAt *time.Time     `gorm:"index;type:timestamp" json:"refundedAt,omitempty"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index;type:timestamp" json:"-"`
}

func (PaymentRecord) TableName() string {
	return "payment_records"
}
