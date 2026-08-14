package security

import (
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestValidatePassword(t *testing.T) {
	tests := []struct {
		name     string
		password string
		wantErr  bool
	}{
		{name: "strong", password: "Correct-Horse7!Battery", wantErr: false},
		{name: "known default", password: "TempPassword123!", wantErr: true},
		{name: "too short", password: "Short7!a", wantErr: true},
		{name: "missing symbol", password: "LongPassword123", wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidatePassword(test.password)
			if (err != nil) != test.wantErr {
				t.Fatalf("ValidatePassword() error = %v, wantErr %v", err, test.wantErr)
			}
		})
	}
}

func TestHashRandomPasswordProducesUsableUniqueHashes(t *testing.T) {
	first, err := HashRandomPassword()
	if err != nil {
		t.Fatal(err)
	}
	second, err := HashRandomPassword()
	if err != nil {
		t.Fatal(err)
	}
	if first == second {
		t.Fatal("expected independently generated hashes")
	}
	if _, err := bcrypt.Cost([]byte(first)); err != nil {
		t.Fatalf("first hash is invalid: %v", err)
	}
}
