-- Fix case stage default value issue
-- The current_stage column has a default of 'intake' but for legal cases it should be 'etapa_inicial'

-- First, update existing legal cases that have 'intake' to 'etapa_inicial'
UPDATE cases 
SET current_stage = 'etapa_inicial' 
WHERE category IN ('Familiar', 'Civil') 
  AND current_stage = 'intake';

-- Remove the default constraint from the column
ALTER TABLE cases ALTER COLUMN current_stage DROP DEFAULT;

-- Add a comment to document the issue
COMMENT ON COLUMN cases.current_stage IS 'Current stage of the case. No default value to avoid conflicts between legal (etapa_inicial) and non-legal (intake) cases.';
