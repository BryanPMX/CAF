// api/config/stages.go
package config

// CaseStages defines the ordered, canonical list of stages in a case's lifecycle.
var CaseStages = []string{
	"intake",               // Initial data entry
	"initial_consultation", // First meeting with staff
	"document_review",      // Staff is reviewing submitted documents
	"action_plan",          // Staff is actively working on the case
	"resolution",           // A resolution has been reached
	"closed",               // The case is complete
}

// IsValidStage is a helper function to check if a given stage is valid.
func IsValidStage(stage string) bool {
	for _, s := range CaseStages {
		if s == stage {
			return true
		}
	}
	return false
}
