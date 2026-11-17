-- Correct inherited migration defaults on the protected support account only.
-- Preserve identity, credentials, status and the department data of other users.
UPDATE users
SET department = 'IT', specialty = NULL, updated_at = CURRENT_TIMESTAMP
WHERE role = 'technical_support'
  AND (department IS DISTINCT FROM 'IT' OR specialty IS NOT NULL);
