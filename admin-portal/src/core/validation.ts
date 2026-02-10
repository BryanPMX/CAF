// admin-portal/src/core/validation.ts
import { ValidationError } from './errors';

// Validation Rules
export interface ValidationRule<T = any> {
  validate: (value: T) => boolean;
  message: string;
}

export interface ValidationSchema<T = any> {
  [key: string]: ValidationRule<T> | ValidationRule<T>[];
}

// Common Validation Rules
export const ValidationRules = {
  required: (message = 'This field is required'): ValidationRule => ({
    validate: (value: any) => value !== null && value !== undefined && value !== '',
    message,
  }),

  email: (message = 'Invalid email address'): ValidationRule<string> => ({
    validate: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
  }),

  minLength: (min: number, message?: string): ValidationRule<string> => ({
    validate: (value: string) => value.length >= min,
    message: message || `Must be at least ${min} characters`,
  }),

  maxLength: (max: number, message?: string): ValidationRule<string> => ({
    validate: (value: string) => value.length <= max,
    message: message || `Must be no more than ${max} characters`,
  }),

  pattern: (regex: RegExp, message = 'Invalid format'): ValidationRule<string> => ({
    validate: (value: string) => regex.test(value),
    message,
  }),

  oneOf: (options: any[], message?: string): ValidationRule => ({
    validate: (value: any) => options.includes(value),
    message: message || `Must be one of: ${options.join(', ')}`,
  }),

  date: (message = 'Invalid date'): ValidationRule<string> => ({
    validate: (value: string) => !isNaN(Date.parse(value)),
    message,
  }),

  futureDate: (message = 'Date must be in the future'): ValidationRule<string> => ({
    validate: (value: string) => new Date(value) > new Date(),
    message,
  }),
};

// Validator Class
export class Validator {
  static validateField<T>(value: T, rules: ValidationRule<T> | ValidationRule<T>[]): ValidationError | null {
    const ruleArray = Array.isArray(rules) ? rules : [rules];

    for (const rule of ruleArray) {
      if (!rule.validate(value)) {
        return new ValidationError(rule.message);
      }
    }

    return null;
  }

  static validateObject<T extends Record<string, any>>(
    data: T,
    schema: ValidationSchema
  ): Record<string, ValidationError> {
    const errors: Record<string, ValidationError> = {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      const error = this.validateField(value, rules);

      if (error) {
        errors[field] = error;
      }
    }

    return errors;
  }

  static hasErrors(errors: Record<string, ValidationError>): boolean {
    return Object.keys(errors).length > 0;
  }

  static getFirstError(errors: Record<string, ValidationError>): ValidationError | null {
    const firstKey = Object.keys(errors)[0];
    return firstKey ? errors[firstKey] : null;
  }
}

// Common Validation Schemas
export const ValidationSchemas = {
  case: {
    title: [ValidationRules.required(), ValidationRules.minLength(3), ValidationRules.maxLength(200)],
    description: [ValidationRules.maxLength(2000)],
    client_id: ValidationRules.required('Client is required'),
    office_id: ValidationRules.required('Office is required'),
    category: ValidationRules.required('Category is required'),
    priority: ValidationRules.oneOf(['low', 'medium', 'high', 'urgent'], 'Invalid priority level'),
  },

  appointment: {
    title: [ValidationRules.required(), ValidationRules.minLength(3), ValidationRules.maxLength(200)],
    description: [ValidationRules.maxLength(1000)],
    case_id: ValidationRules.required('Case is required'),
    start_time: [ValidationRules.required('Start time is required'), ValidationRules.date()],
    end_time: [ValidationRules.required('End time is required'), ValidationRules.date()],
    status: ValidationRules.oneOf(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']),
  },

  user: {
    email: [ValidationRules.required(), ValidationRules.email()],
    first_name: [ValidationRules.required(), ValidationRules.minLength(2), ValidationRules.maxLength(50)],
    last_name: [ValidationRules.required(), ValidationRules.minLength(2), ValidationRules.maxLength(50)],
    role: ValidationRules.oneOf([
      'admin', 'office_manager', 'lawyer', 'psychologist',
      'receptionist', 'event_coordinator', 'client'
    ]),
  },

  office: {
    name: [ValidationRules.required(), ValidationRules.minLength(2), ValidationRules.maxLength(100)],
  },
};

// Validation Helper Functions
export function validateCase(data: any) {
  return Validator.validateObject(data, ValidationSchemas.case);
}

export function validateAppointment(data: any) {
  return Validator.validateObject(data, ValidationSchemas.appointment);
}

export function validateUser(data: any) {
  return Validator.validateObject(data, ValidationSchemas.user);
}

export function validateOffice(data: any) {
  return Validator.validateObject(data, ValidationSchemas.office);
}
