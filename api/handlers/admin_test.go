package handlers

import "testing"

func TestNormalizeCreateUserInputUsesCanonicalEmail(t *testing.T) {
	address := "  Calle Principal  "
	input := CreateUserInput{
		FirstName: "  Ana ", LastName: " Martínez  ", Email: " ANA@CAF-MEXICO.COM ",
		Phone: " +52 656 123 4567 ", PersonalAddress: &address,
	}
	normalizeCreateUserInput(&input)
	if input.FirstName != "Ana" || input.LastName != "Martínez" {
		t.Fatalf("names were not normalized: %#v", input)
	}
	if input.Email != "ana@caf-mexico.com" {
		t.Fatalf("email was not canonicalized: %q", input.Email)
	}
	if input.PersonalAddress == nil || *input.PersonalAddress != "Calle Principal" {
		t.Fatalf("address was not normalized: %#v", input.PersonalAddress)
	}
}

func TestValidateCreateUserEmailRequiresClientEmailOnly(t *testing.T) {
	if got := validateCreateUserEmail(CreateUserInput{Role: "client"}); got == "" {
		t.Fatal("client without email should be rejected")
	}
	if got := validateCreateUserEmail(CreateUserInput{Role: "psychologist"}); got != "" {
		t.Fatalf("staff email should be generated, got %q", got)
	}
}
