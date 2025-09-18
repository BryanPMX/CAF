// api/middleware/validation.go
package middleware

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

// ValidationRule represents a validation rule
type ValidationRule struct {
	Required bool
	MinLen   int
	MaxLen   int
	Pattern  string
	Message  string
}

// ValidationRules defines validation rules for different fields
var ValidationRules = map[string]ValidationRule{
	"email": {
		Required: true,
		Pattern:  `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`,
		Message:  "Invalid email format",
	},
	"password": {
		Required: true,
		MinLen:   8,
		MaxLen:   128,
		Pattern:  `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$`,
		Message:  "Password must be at least 8 characters with uppercase, lowercase, and number",
	},
	"firstName": {
		Required: true,
		MinLen:   2,
		MaxLen:   50,
		Pattern:  `^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$`,
		Message:  "First name must be 2-50 characters and contain only letters",
	},
	"lastName": {
		Required: true,
		MinLen:   2,
		MaxLen:   50,
		Pattern:  `^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$`,
		Message:  "Last name must be 2-50 characters and contain only letters",
	},
	"phone": {
		Required: false,
		Pattern:  `^[\+]?[1-9][\d]{0,15}$`,
		Message:  "Invalid phone number format",
	},
	"title": {
		Required: true,
		MinLen:   3,
		MaxLen:   200,
		Message:  "Title must be 3-200 characters",
	},
	"description": {
		Required: true,
		MinLen:   10,
		MaxLen:   2000,
		Message:  "Description must be 10-2000 characters",
	},
	"role": {
		Required: true,
		Pattern:  `^(admin|office_manager|staff|counselor|psychologist|client)$`,
		Message:  "Invalid role. Must be one of: admin, office_manager, staff, counselor, psychologist, client",
	},
	"status": {
		Required: true,
		Pattern:  `^(open|in_progress|closed|pending|archived)$`,
		Message:  "Invalid status. Must be one of: open, in_progress, closed, pending, archived",
	},
	"priority": {
		Required: true,
		Pattern:  `^(low|medium|high)$`,
		Message:  "Invalid priority. Must be one of: low, medium, high",
	},
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ValidationResponse represents the validation response
type ValidationResponse struct {
	Valid   bool             `json:"valid"`
	Errors  []ValidationError `json:"errors"`
	Message string           `json:"message"`
}

// ValidateField validates a single field
func ValidateField(fieldName, value string, rule ValidationRule) *ValidationError {
	// Check required
	if rule.Required && strings.TrimSpace(value) == "" {
		return &ValidationError{
			Field:   fieldName,
			Message: rule.Message,
		}
	}

	// Skip other validations if field is empty and not required
	if strings.TrimSpace(value) == "" {
		return nil
	}

	// Check minimum length
	if rule.MinLen > 0 && len(value) < rule.MinLen {
		return &ValidationError{
			Field:   fieldName,
			Message: rule.Message,
		}
	}

	// Check maximum length
	if rule.MaxLen > 0 && len(value) > rule.MaxLen {
		return &ValidationError{
			Field:   fieldName,
			Message: rule.Message,
		}
	}

	// Check pattern
	if rule.Pattern != "" {
		matched, err := regexp.MatchString(rule.Pattern, value)
		if err != nil || !matched {
			return &ValidationError{
				Field:   fieldName,
				Message: rule.Message,
			}
		}
	}

	return nil
}

// ValidateRequest validates a request against specified rules
func ValidateRequest(c *gin.Context, rules map[string]ValidationRule) *ValidationResponse {
	var errors []ValidationError

	for fieldName, rule := range rules {
		value := c.PostForm(fieldName)
		if value == "" {
			// Try to get from JSON body
			var jsonData map[string]interface{}
			if err := c.ShouldBindJSON(&jsonData); err == nil {
				if val, exists := jsonData[fieldName]; exists {
					if strVal, ok := val.(string); ok {
						value = strVal
					}
				}
			}
		}

		if err := ValidateField(fieldName, value, rule); err != nil {
			errors = append(errors, *err)
		}
	}

	return &ValidationResponse{
		Valid:   len(errors) == 0,
		Errors:  errors,
		Message: "Validation failed",
	}
}

// ValidationMiddleware creates a validation middleware
func ValidationMiddleware(rules map[string]ValidationRule) gin.HandlerFunc {
	return func(c *gin.Context) {
		validation := ValidateRequest(c, rules)
		
		if !validation.Valid {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Validation failed",
				"message": validation.Message,
				"details": validation.Errors,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// Common validation middleware functions

// ValidateUserRegistration validates user registration data
func ValidateUserRegistration() gin.HandlerFunc {
	rules := map[string]ValidationRule{
		"firstName": ValidationRules["firstName"],
		"lastName":  ValidationRules["lastName"],
		"email":     ValidationRules["email"],
		"password":  ValidationRules["password"],
		"role":      ValidationRules["role"],
	}
	return ValidationMiddleware(rules)
}

// ValidateUserUpdate validates user update data
func ValidateUserUpdate() gin.HandlerFunc {
	rules := map[string]ValidationRule{
		"firstName": ValidationRules["firstName"],
		"lastName":  ValidationRules["lastName"],
		"email":     ValidationRules["email"],
		"phone":     ValidationRules["phone"],
		"role":      ValidationRules["role"],
	}
	return ValidationMiddleware(rules)
}

// ValidateCaseCreation validates case creation data
func ValidateCaseCreation() gin.HandlerFunc {
	rules := map[string]ValidationRule{
		"title":       ValidationRules["title"],
		"description": ValidationRules["description"],
		"category": {
			Required: true,
			MinLen:   2,
			MaxLen:   50,
			Message:  "Category must be 2-50 characters",
		},
		"priority": ValidationRules["priority"],
	}
	return ValidationMiddleware(rules)
}

// ValidateCaseUpdate validates case update data
func ValidateCaseUpdate() gin.HandlerFunc {
	rules := map[string]ValidationRule{
		"title":       ValidationRules["title"],
		"description": ValidationRules["description"],
		"status":      ValidationRules["status"],
		"priority":    ValidationRules["priority"],
	}
	return ValidationMiddleware(rules)
}

// ValidateAppointmentCreation validates appointment creation data
func ValidateAppointmentCreation() gin.HandlerFunc {
	rules := map[string]ValidationRule{
		"title": {
			Required: true,
			MinLen:   3,
			MaxLen:   200,
			Message:  "Title must be 3-200 characters",
		},
		"startTime": {
			Required: true,
			Pattern:  `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$`,
			Message:  "Invalid start time format. Use ISO 8601 format",
		},
		"endTime": {
			Required: true,
			Pattern:  `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$`,
			Message:  "Invalid end time format. Use ISO 8601 format",
		},
	}
	return ValidationMiddleware(rules)
}

// ValidateTaskCreation validates task creation data
func ValidateTaskCreation() gin.HandlerFunc {
	rules := map[string]ValidationRule{
		"title":       ValidationRules["title"],
		"description": ValidationRules["description"],
		"priority":    ValidationRules["priority"],
	}
	return ValidationMiddleware(rules)
}

// ValidateOfficeCreation validates office creation data
func ValidateOfficeCreation() gin.HandlerFunc {
	rules := map[string]ValidationRule{
		"name": {
			Required: true,
			MinLen:   2,
			MaxLen:   100,
			Message:  "Office name must be 2-100 characters",
		},
		"address": {
			Required: true,
			MinLen:   10,
			MaxLen:   200,
			Message:  "Address must be 10-200 characters",
		},
		"phone": ValidationRules["phone"],
		"email": ValidationRules["email"],
	}
	return ValidationMiddleware(rules)
}

// SanitizeInput sanitizes input to prevent XSS and other attacks
func SanitizeInput(input string) string {
	// Remove potentially dangerous characters
	input = strings.ReplaceAll(input, "<script", "")
	input = strings.ReplaceAll(input, "</script", "")
	input = strings.ReplaceAll(input, "javascript:", "")
	input = strings.ReplaceAll(input, "onload=", "")
	input = strings.ReplaceAll(input, "onerror=", "")
	
	// Trim whitespace
	input = strings.TrimSpace(input)
	
	return input
}

// SanitizeMiddleware sanitizes request data
func SanitizeMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Sanitize form data
		for key, values := range c.Request.PostForm {
			for i, value := range values {
				c.Request.PostForm[key][i] = SanitizeInput(value)
			}
		}

		c.Next()
	}
}
