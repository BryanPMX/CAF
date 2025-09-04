# CAF System Database Migrations

This directory contains the database migrations for the CAF System. The migration system is designed to be production-ready and follows best practices for database schema management.

## Migration System Overview

The CAF System uses a custom migration system that:

- **Versioned Migrations**: Each migration has a unique version number (e.g., `001_initial_schema.sql`)
- **Checksum Validation**: Each migration is validated using SHA256 checksums to ensure integrity
- **Transaction Safety**: All migrations run within database transactions
- **Rollback Support**: Migrations can be rolled back (manual process)
- **Status Tracking**: Migration status is tracked in the `migrations` table

## Migration Files

### Current Migrations

- **001_initial_schema.sql**: Initial database schema setup
  - Creates all core tables (users, cases, appointments, etc.)
  - Sets up indexes for performance
  - Creates views for common queries
  - Sets up audit trail functions and triggers
  - Inserts seed data (admin user, default office)
  - Grants proper permissions

## Adding New Migrations

To add a new migration:

1. **Create Migration File**: Create a new SQL file in `api/db/migrations/` with the naming convention:
   ```
   XXX_description.sql
   ```
   Where `XXX` is the next sequential number.

2. **Migration Content**: Write your SQL migration. Include:
   - Descriptive comments
   - Proper error handling with `IF EXISTS` checks
   - Index creation for performance
   - Comments for documentation

3. **Example Migration**:
   ```sql
   -- Migration: 002_add_phone_number_to_users.sql
   -- Description: Add phone number field to users table
   -- Date: 2025-09-03
   -- Author: CAF System Team

   -- Add phone number column to users table
   ALTER TABLE users ADD COLUMN phone_number VARCHAR(20);

   -- Create index for phone number lookups
   CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);

   -- Add comment for documentation
   COMMENT ON COLUMN users.phone_number IS 'User phone number for contact purposes';
   ```

## Migration Commands

### Check Migration Status
```bash
curl http://localhost:8080/health/migrations
```

### View Migration Logs
The API server logs migration status during startup. Check the logs for:
- Migration discovery
- Migration execution
- Migration completion status

## Migration Best Practices

1. **Always Use Transactions**: The migration system automatically wraps migrations in transactions
2. **Check for Existing Objects**: Use `IF EXISTS` and `IF NOT EXISTS` checks
3. **Add Indexes**: Create appropriate indexes for performance
4. **Document Changes**: Add comments explaining the purpose of each change
5. **Test Migrations**: Test migrations in a development environment first
6. **Backup Before Production**: Always backup the database before running migrations in production

## Migration Rollback

To rollback a migration:

1. **Manual Process**: Create a rollback migration with the reverse operations
2. **Example Rollback**:
   ```sql
   -- Migration: 003_rollback_002_add_phone_number.sql
   -- Description: Remove phone number field from users table
   
   -- Drop index first
   DROP INDEX IF EXISTS idx_users_phone_number;
   
   -- Remove column
   ALTER TABLE users DROP COLUMN IF EXISTS phone_number;
   ```

## Database Schema

The current schema includes:

### Core Tables
- `users`: User accounts and authentication
- `offices`: Office locations and information
- `cases`: Legal cases and case management
- `appointments`: Scheduled appointments
- `tasks`: Task management for cases
- `task_comments`: Comments on tasks
- `case_events`: Audit trail for case events
- `audit_logs`: Comprehensive audit logging
- `sessions`: User session management
- `user_case_assignments`: Many-to-many case assignments
- `migrations`: Migration tracking

### Views
- `active_cases`: Cases that are not deleted or archived
- `deleted_cases`: Cases that are deleted or archived

### Functions
- `set_audit_fields()`: Automatically sets audit timestamps
- `log_case_deletion()`: Logs case deletion events

## Troubleshooting

### Common Issues

1. **Migration Already Applied**: If a migration fails with "already exists" errors, check if it was already applied
2. **Permission Errors**: Ensure the database user has proper permissions
3. **Transaction Conflicts**: Check for long-running transactions that might conflict

### Debugging

1. **Check Migration Status**: Use the `/health/migrations` endpoint
2. **View Logs**: Check API server logs for migration details
3. **Database Inspection**: Query the `migrations` table directly:
   ```sql
   SELECT * FROM migrations ORDER BY version;
   ```

## Production Deployment

When deploying to production:

1. **Backup Database**: Always backup before running migrations
2. **Test Migrations**: Test migrations in staging environment first
3. **Monitor Execution**: Watch logs during migration execution
4. **Verify Results**: Check migration status after completion
5. **Rollback Plan**: Have a rollback plan ready

## Migration History

- **2025-09-03**: Initial migration system implementation
  - Replaced auto-migration with versioned migrations
  - Created comprehensive initial schema
  - Added audit trail and session management
  - Implemented proper indexing and performance optimization
