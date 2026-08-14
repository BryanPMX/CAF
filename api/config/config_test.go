package config

import "testing"

func TestIsPlaceholderSecret(t *testing.T) {
	tests := []struct {
		value string
		want  bool
	}{
		{"replace_with_random_bytes", true},
		{"YOUR_SECRET_HERE", true},
		{"production-example-secret", true},
		{"N7^kL9!2vQ#8sT4@pX6&cM1z", false},
	}

	for _, test := range tests {
		if got := isPlaceholderSecret(test.value); got != test.want {
			t.Fatalf("isPlaceholderSecret(%q) = %v, want %v", test.value, got, test.want)
		}
	}
}
