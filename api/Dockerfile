# These are the step-by-step instructions for building the Go API's container image.

# Use an official Go image as the base.
FROM golang:1.23-alpine

# Set the working directory inside the container.
WORKDIR /app

# UPDATED: Install git.
# The 'alpine' image uses the 'apk' package manager.
# We need git to be able to download some of the Go modules.
RUN apk add --no-cache git

# Copy the Go module files first. This is a Docker caching optimization.
COPY go.mod go.sum ./

# Download dependencies and ensure go.sum is up to date
RUN go mod download && go mod tidy

# Copy the rest of the application's source code into the container.
COPY . .

# Build the Go application with explicit architecture targeting.
# '-o /app/main' specifies the output file name.
# 'GOOS=linux GOARCH=amd64' ensures the binary is built for Linux x86_64
RUN GOOS=linux GOARCH=amd64 go build -o /app/main ./cmd/server

# This command will be executed when the container starts.
# It simply runs our compiled application.
CMD [ "/app/main" ]

