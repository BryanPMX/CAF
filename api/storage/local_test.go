// api/storage/local_test.go
// Unit tests for the local filesystem storage provider.
package storage

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/textproto"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// createTestFile builds a multipart.FileHeader for testing.
func createTestFile(t *testing.T, filename string, content string) *multipart.FileHeader {
	t.Helper()

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// Create a form file part
	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", `form-data; name="file"; filename="`+filename+`"`)
	h.Set("Content-Type", "application/octet-stream")
	part, err := writer.CreatePart(h)
	if err != nil {
		t.Fatalf("failed to create multipart part: %v", err)
	}

	if _, err := part.Write([]byte(content)); err != nil {
		t.Fatalf("failed to write content: %v", err)
	}
	writer.Close()

	reader := multipart.NewReader(&buf, writer.Boundary())
	form, err := reader.ReadForm(int64(len(content) + 512))
	if err != nil {
		t.Fatalf("failed to read form: %v", err)
	}

	files := form.File["file"]
	if len(files) == 0 {
		t.Fatal("no file found in form")
	}

	return files[0]
}

func TestNewLocalStorage(t *testing.T) {
	tmpDir := t.TempDir()

	ls, err := NewLocalStorage(tmpDir)
	if err != nil {
		t.Fatalf("NewLocalStorage failed: %v", err)
	}
	if ls.baseDir != tmpDir {
		t.Errorf("baseDir = %q, want %q", ls.baseDir, tmpDir)
	}
}

func TestNewLocalStorage_CreatesDir(t *testing.T) {
	tmpDir := t.TempDir()
	nestedDir := filepath.Join(tmpDir, "a", "b", "c")

	ls, err := NewLocalStorage(nestedDir)
	if err != nil {
		t.Fatalf("NewLocalStorage failed: %v", err)
	}

	info, err := os.Stat(ls.baseDir)
	if err != nil {
		t.Fatalf("stat failed: %v", err)
	}
	if !info.IsDir() {
		t.Error("expected directory to be created")
	}
}

func TestUploadAndGet(t *testing.T) {
	tmpDir := t.TempDir()
	ls, _ := NewLocalStorage(tmpDir)

	content := "hello, world!"
	fh := createTestFile(t, "report.pdf", content)

	// Upload
	url, err := ls.Upload(fh, "42")
	if err != nil {
		t.Fatalf("Upload failed: %v", err)
	}

	if !strings.HasPrefix(url, LocalURLPrefix) {
		t.Errorf("URL %q should have prefix %q", url, LocalURLPrefix)
	}
	if !strings.Contains(url, "cases/42/") {
		t.Errorf("URL %q should contain cases/42/", url)
	}
	if !strings.HasSuffix(url, ".pdf") {
		t.Errorf("URL %q should have .pdf extension", url)
	}

	// Get
	body, ct, err := ls.Get(url)
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
	defer body.Close()

	data, _ := io.ReadAll(body)
	if string(data) != content {
		t.Errorf("got %q, want %q", string(data), content)
	}
	if ct != "application/pdf" {
		t.Errorf("content type = %q, want application/pdf", ct)
	}
}

func TestDelete(t *testing.T) {
	tmpDir := t.TempDir()
	ls, _ := NewLocalStorage(tmpDir)

	fh := createTestFile(t, "delete-me.txt", "temporary data")
	url, _ := ls.Upload(fh, "99")

	// Delete
	if err := ls.Delete(url); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	// Verify file is gone
	_, _, err := ls.Get(url)
	if err == nil {
		t.Error("expected error when getting deleted file")
	}
}

func TestDelete_Idempotent(t *testing.T) {
	tmpDir := t.TempDir()
	ls, _ := NewLocalStorage(tmpDir)

	fh := createTestFile(t, "delete-me.txt", "temporary")
	url, _ := ls.Upload(fh, "1")

	ls.Delete(url)

	// Second delete should not error
	if err := ls.Delete(url); err != nil {
		t.Errorf("second Delete should be idempotent, got: %v", err)
	}
}

func TestHealthCheck(t *testing.T) {
	tmpDir := t.TempDir()
	ls, _ := NewLocalStorage(tmpDir)

	if err := ls.HealthCheck(); err != nil {
		t.Errorf("HealthCheck failed: %v", err)
	}
}

func TestHealthCheck_MissingDir(t *testing.T) {
	ls := &LocalStorage{baseDir: "/nonexistent/path/xyz"}
	if err := ls.HealthCheck(); err == nil {
		t.Error("expected error for missing directory")
	}
}

func TestIsLocalURL(t *testing.T) {
	tests := []struct {
		url  string
		want bool
	}{
		{"local://cases/1/abc.pdf", true},
		{"local://anything", true},
		{"https://s3.amazonaws.com/bucket/key", false},
		{"http://localstack:4566/bucket/key", false},
		{"", false},
	}
	for _, tt := range tests {
		if got := IsLocalURL(tt.url); got != tt.want {
			t.Errorf("IsLocalURL(%q) = %v, want %v", tt.url, got, tt.want)
		}
	}
}

func TestResolvePath_PathTraversal(t *testing.T) {
	tmpDir := t.TempDir()
	ls, _ := NewLocalStorage(tmpDir)

	_, err := ls.resolvePath("local://../../etc/passwd")
	if err == nil {
		t.Error("expected error for path traversal")
	}
}

func TestDetectContentType(t *testing.T) {
	tests := []struct {
		path string
		want string
	}{
		{"doc.pdf", "application/pdf"},
		{"photo.jpg", "image/jpeg"},
		{"photo.JPEG", "image/jpeg"},
		{"data.csv", "text/csv"},
		{"archive.zip", "application/zip"},
		{"unknown.xyz", "application/octet-stream"},
	}
	for _, tt := range tests {
		if got := detectContentType(tt.path); got != tt.want {
			t.Errorf("detectContentType(%q) = %q, want %q", tt.path, got, tt.want)
		}
	}
}

func TestSetAndGetActiveStorage(t *testing.T) {
	tmpDir := t.TempDir()
	ls, _ := NewLocalStorage(tmpDir)

	SetActiveStorage(ls)
	got := GetActiveStorage()
	if got == nil {
		t.Fatal("GetActiveStorage returned nil")
	}

	// Verify it works through the interface
	fh := createTestFile(t, "via-interface.txt", "interface test")
	url, err := got.Upload(fh, "1")
	if err != nil {
		t.Fatalf("Upload through interface failed: %v", err)
	}
	if !IsLocalURL(url) {
		t.Errorf("expected local URL, got: %s", url)
	}

	// Clean up
	SetActiveStorage(nil)
}
