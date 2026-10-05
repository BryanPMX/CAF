package handlers

import (
	"strings"
	"testing"
)

func TestBuildProfileAvatarURLVersionsLocalAvatars(t *testing.T) {
	first := "local://avatars/7-first.jpg"
	second := "local://avatars/7-second.jpg"

	firstURL := BuildProfileAvatarURL(&first, "https://api.example.com")
	repeatedURL := BuildProfileAvatarURL(&first, "https://api.example.com")
	secondURL := BuildProfileAvatarURL(&second, "https://api.example.com")

	if firstURL != repeatedURL {
		t.Fatalf("same stored avatar produced different URLs: %q != %q", firstURL, repeatedURL)
	}
	if firstURL == secondURL {
		t.Fatalf("different stored avatars produced the same URL: %q", firstURL)
	}
	if !strings.HasPrefix(firstURL, "https://api.example.com/api/v1/avatar?v=") {
		t.Fatalf("unexpected staff avatar URL: %q", firstURL)
	}
}

func TestBuildProfileAvatarURLSupportsClientRoute(t *testing.T) {
	stored := "local://avatars/9-client.webp"
	got := BuildProfileAvatarURL(&stored, "", "/api/v1/client/avatar")

	if !strings.HasPrefix(got, "/api/v1/client/avatar?v=") {
		t.Fatalf("unexpected client avatar URL: %q", got)
	}
}

func TestBuildProfileAvatarURLPreservesExternalURL(t *testing.T) {
	external := "https://images.example.com/avatar.png"
	if got := BuildProfileAvatarURL(&external, "https://api.example.com"); got != external {
		t.Fatalf("external URL = %q, want %q", got, external)
	}
}
