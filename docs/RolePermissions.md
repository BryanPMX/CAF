# CAF System - Role-Based Access Control Specification

**Version:** 1.0  
**Last Updated:** September 20, 2025  
**Status:** Production Ready  

---

## Overview

This document serves as the **authoritative blueprint** for the CAF System's role-based access control (RBAC) implementation. It defines the complete specification for staff roles, permissions, and UI visibility across the entire system.

**⚠️ CRITICAL:** This document is the **single source of truth** for all role and permission logic. Any changes to roles or permissions must be reflected here first, then implemented across all system components.

---

## A. Role Definitions

The CAF System recognizes **six official staff roles** with specific responsibilities and access levels:

| Database Key | Spanish Title | English Title | Department | Description |
|--------------|---------------|---------------|------------|-------------|
| `admin` | Administrador | Administrator | Administration | Full system access and management |
| `office_manager` | Gerente de Oficina | Office Manager | Management | Office-level management and oversight |
| `lawyer` | Abogado/a | Lawyer | Legal | Legal case management and documentation |
| `psychologist` | Psicólogo/a | Psychologist | Psychology | Psychological assessment and counseling |
| `receptionist` | Recepcionista | Receptionist | Administration | Front desk and appointment management |
| `event_coordinator` | Coordinador/a de Eventos | Event Coordinator | Events | Event planning and coordination |

### Role Hierarchy and Access Levels

1. **Admin** - Highest level access (system-wide)
2. **Office Manager** - Office-level management access
3. **Lawyer/Psychologist** - Professional service access
4. **Receptionist** - Administrative support access
5. **Event Coordinator** - Event-specific access

---

## B. View Permissions Matrix

This matrix defines the **exact UI visibility** for each role within the Admin Portal. This is the most critical part of the specification and must be implemented exactly as defined.

### Sidebar Menu Links

| Component / View | Admin | Office Manager | Lawyer | Psychologist | Receptionist | Event Coordinator |
|------------------|-------|----------------|--------|--------------|--------------|-------------------|
| **Dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Citas** (Appointments) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Casos** (Cases) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Usuarios** (Users) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Oficinas** (Offices) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Archivos** (Files) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Contenido Web** (Web Content) | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |

### Page-Level Permissions

| Permission | Admin | Office Manager | Lawyer | Psychologist | Receptionist | Event Coordinator |
|------------|-------|----------------|--------|--------------|--------------|-------------------|
| **Can view data from all offices?** | ✅ | ❌ | ❌ | ❌ | ❌ | N/A |
| **Can see admin-only dashboard widgets?** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Can access user management?** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Can access office management?** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Can access file management?** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Can access web content management?** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |

### Case Detail Page (Privacy Wall)

The case detail page implements a **privacy wall** that restricts access to sensitive information based on professional roles:

| Document Type | Admin | Office Manager | Lawyer | Psychologist | Receptionist | Event Coordinator |
|---------------|-------|----------------|--------|--------------|--------------|-------------------|
| **Legal Notes/Documents** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Psychological Notes/Documents** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **General Case Information** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Appointment History** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Basic Case Status** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

### Data Access Permissions

| Data Type | Admin | Office Manager | Lawyer | Psychologist | Receptionist | Event Coordinator |
|-----------|-------|----------------|--------|--------------|--------------|-------------------|
| **All Users** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Office Users Only** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **All Cases** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Office Cases Only** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Assigned Cases Only** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **All Appointments** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Event-Related Data** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |

---

## C. Implementation Requirements

### Backend Requirements

1. **Centralized Role Configuration**
   - All role definitions must be centralized in `api/config/roles.go`
   - Role validation must be enforced in all user management endpoints
   - Database queries must respect role-based data access

2. **Security Enforcement**
   - All API endpoints must validate user permissions
   - Data filtering must be applied based on user role
   - Audit logging must track all permission-based actions

### Frontend Requirements

1. **Dynamic UI Rendering**
   - Sidebar must dynamically show/hide links based on user role
   - Dashboard widgets must be role-specific
   - Case detail pages must implement privacy walls

2. **Consistent Permission Checking**
   - All components must use centralized permission logic
   - No hardcoded role checks allowed
   - Permission changes must be reflected system-wide

---

## D. Security Considerations

### Data Privacy
- **Legal Information**: Only accessible to lawyers and admins
- **Psychological Information**: Only accessible to psychologists and admins
- **Administrative Information**: Only accessible to admins and office managers
- **Event Information**: Only accessible to event coordinators and admins

### Access Control
- **Principle of Least Privilege**: Users receive minimum required access
- **Role Separation**: Professional roles cannot access each other's sensitive data
- **Audit Trail**: All access attempts are logged and monitored

### Compliance
- **HIPAA Considerations**: Psychological data access is strictly controlled
- **Legal Privilege**: Legal communications are protected
- **Administrative Oversight**: Office managers can oversee but not access sensitive data

---

## E. Migration Strategy

### Phase 1: Documentation and Configuration
- ✅ Create this authoritative specification
- ✅ Implement centralized role configuration
- ✅ Update backend validation logic

### Phase 2: Frontend Implementation
- ✅ Implement dynamic sidebar rendering
- ✅ Create role-based dashboard widgets
- ✅ Implement case detail privacy walls

### Phase 3: Testing and Validation
- ✅ Test all role combinations
- ✅ Validate security boundaries
- ✅ Audit permission enforcement

---

## F. Maintenance and Updates

### Adding New Roles
1. Update this specification document
2. Add role to backend configuration
3. Update frontend role definitions
4. Implement permission matrix
5. Test and validate

### Modifying Permissions
1. Update this specification document
2. Update backend validation logic
3. Update frontend permission checks
4. Test all affected components
5. Deploy with proper testing

### Monitoring and Auditing
- Regular permission audits
- Access pattern monitoring
- Security boundary validation
- User feedback collection

---

## G. Technical Implementation Notes

### Backend Implementation
```go
// Example role validation
func ValidateRole(role string) bool {
    validRoles := []string{"admin", "office_manager", "lawyer", "psychologist", "receptionist", "event_coordinator"}
    return contains(validRoles, role)
}
```

### Frontend Implementation
```typescript
// Example permission checking
const canAccessUsers = (userRole: string) => {
    return userRole === 'admin';
};
```

### Database Considerations
- Role-based data filtering at query level
- Indexed role columns for performance
- Audit tables for access tracking

---

**This document is the definitive specification for the CAF System's role-based access control. All implementations must strictly adhere to these specifications to ensure security, consistency, and maintainability.**
