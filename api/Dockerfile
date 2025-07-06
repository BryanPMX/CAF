# These are the step-by-step instructions for building the Go API's container image.

# Use an official Go image as the base.
# The 'alpine' version is smaller, which is great for production.
FROM golang:1.21-alpine

# Set the working directory inside the container.
WORKDIR /app

# Copy the Go module files first. This is a Docker caching optimization.
# If these files don't change, Docker won't re-download dependencies on every build.
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the application's source code into the container.
COPY . .

# Build the Go application.
# '-o /app/main' specifies the output file name.
RUN go build -o /app/main ./cmd/server

# This command will be executed when the container starts.
# It simply runs our compiled application.
CMD [ "/app/main" ]
