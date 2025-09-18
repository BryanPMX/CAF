// marketing/src/lib/utils/formValidator.js
// Form validation utilities for the marketing site

export class FormValidator {
  constructor() {
    this.rules = {
      email: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: 'Por favor, ingrese un correo electrónico válido.'
      },
      phone: {
        pattern: /^[\+]?[1-9][\d]{0,15}$/,
        message: 'Por favor, ingrese un número de teléfono válido.'
      },
      required: {
        message: 'Este campo es obligatorio.'
      },
      minLength: {
        message: 'Este campo debe tener al menos {min} caracteres.'
      },
      maxLength: {
        message: 'Este campo no puede tener más de {max} caracteres.'
      }
    };
  }

  // Validate a single field
  validateField(value, fieldRules) {
    const errors = [];

    // Required validation
    if (fieldRules.required && (!value || value.trim() === '')) {
      errors.push(this.rules.required.message);
      return errors; // Return early if required field is empty
    }

    // Skip other validations if field is empty and not required
    if (!value || value.trim() === '') {
      return errors;
    }

    // Email validation
    if (fieldRules.email && !this.rules.email.pattern.test(value)) {
      errors.push(this.rules.email.message);
    }

    // Phone validation
    if (fieldRules.phone && !this.rules.phone.pattern.test(value.replace(/\s/g, ''))) {
      errors.push(this.rules.phone.message);
    }

    // Length validations
    if (fieldRules.minLength && value.length < fieldRules.minLength) {
      errors.push(this.rules.minLength.message.replace('{min}', fieldRules.minLength));
    }

    if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
      errors.push(this.rules.maxLength.message.replace('{max}', fieldRules.maxLength));
    }

    return errors;
  }

  // Validate entire form
  validateForm(formData, formRules) {
    const errors = {};
    let isValid = true;

    for (const [fieldName, fieldRules] of Object.entries(formRules)) {
      const fieldErrors = this.validateField(formData[fieldName], fieldRules);
      if (fieldErrors.length > 0) {
        errors[fieldName] = fieldErrors;
        isValid = false;
      }
    }

    return { isValid, errors };
  }

  // Show field errors
  showFieldErrors(fieldName, errors, container) {
    // Remove existing errors
    const existingErrors = container.querySelectorAll('.field-error');
    existingErrors.forEach(error => error.remove());

    if (errors && errors.length > 0) {
      const errorContainer = document.createElement('div');
      errorContainer.className = 'field-error';
      errorContainer.style.cssText = `
        color: #dc2626;
        font-size: 12px;
        margin-top: 4px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      `;

      errors.forEach(error => {
        const errorElement = document.createElement('div');
        errorElement.textContent = error;
        errorContainer.appendChild(errorElement);
      });

      container.appendChild(errorContainer);
    }
  }

  // Clear field errors
  clearFieldErrors(container) {
    const existingErrors = container.querySelectorAll('.field-error');
    existingErrors.forEach(error => error.remove());
  }

  // Add error styling to field
  addErrorStyling(field) {
    field.style.borderColor = '#dc2626';
    field.style.borderWidth = '2px';
  }

  // Remove error styling from field
  removeErrorStyling(field) {
    field.style.borderColor = '';
    field.style.borderWidth = '';
  }
}

// Create global validator instance
export const formValidator = new FormValidator();

// Common form rules
export const commonRules = {
  contactForm: {
    name: { required: true, minLength: 2, maxLength: 50 },
    email: { required: true, email: true },
    phone: { phone: true },
    message: { required: true, minLength: 10, maxLength: 1000 }
  },
  newsletterForm: {
    email: { required: true, email: true }
  }
};
