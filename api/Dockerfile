# Multi-stage build using a supported, patch-pinned Go toolchain.
FROM golang:1.26.6-bookworm AS builder

# Set the working directory
WORKDIR /app

# Copy go mod files first for better caching
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application with optimizations
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o main ./cmd/server

# Production stage
FROM debian:bookworm-slim

# Install CA certificates and timezone data
RUN apt-get update && apt-get install -y ca-certificates tzdata wget && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/bash -m appuser

WORKDIR /app

# Copy the binary from builder stage
COPY --from=builder /app/main .

# Copy migrations directory for database setup
COPY --from=builder /app/db/migrations ./db/migrations

# Create uploads directory for local file storage (used when S3 is not configured)
RUN mkdir -p /app/uploads

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider --method=GET http://localhost:8080/health || exit 1

# Run the application
CMD ["./main"]

