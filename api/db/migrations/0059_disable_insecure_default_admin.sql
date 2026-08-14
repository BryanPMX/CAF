-- Disable the historical development administrator only when its email and
-- known bcrypt hash are unchanged. Customized accounts are not affected.
UPDATE users
SET is_active = FALSE,
    updated_at = CURRENT_TIMESTAMP
WHERE LOWER(email) = 'admin@caf.org'
  AND password = '$2a$10$HRly5tidgBfZqgZIx8N5Fee.qqRfKvKSIHjcIAx1gjOrkLdxP71Wq';
