# CAF Client App - Mobile Application

This directory contains the Flutter-based mobile application for the Centro de Apoyo para la Familia (CAF) system, providing client-facing access to case management services.

## Mobile Architecture Overview

The client app follows modern Flutter patterns with clean architecture principles:

- **Provider Pattern**: State management and dependency injection
- **Repository Pattern**: Data access abstraction
- **Service Layer**: API communication and business logic
- **Secure Storage**: JWT token persistence

## Directory Structure

```
client-app/
├── lib/
│   ├── main.dart                    # Application entry point
│   ├── screens/                     # UI screens
│   │   ├── login_screen.dart       # Authentication screen
│   │   ├── register_screen.dart    # User registration
│   │   ├── home_screen.dart        # Main dashboard
│   │   └── appointment_screen.dart # Appointment booking
│   └── services/                   # Business logic layer
│       └── auth_service.dart       # Authentication service
├── android/                        # Android platform configuration
├── ios/                           # iOS platform configuration
├── pubspec.yaml                   # Flutter dependencies
└── README.md                      # This documentation
```

## Key Components

### 1. Application Entry Point (`lib/main.dart`)

**Main Application Setup:**
- Initializes Flutter app with Material Design
- Configures Provider for state management
- Sets up routing and navigation
- Handles app lifecycle events

### 2. Authentication Service (`lib/services/auth_service.dart`)

**Authentication Features:**
- JWT token-based authentication
- Secure token storage using flutter_secure_storage
- Automatic token refresh logic
- Login/logout state management
- API communication with Go backend

**Security Implementation:**
- Encrypted token storage on device
- Automatic session management
- Secure HTTP communication

### 3. User Interface Screens

**Login Screen (`lib/screens/login_screen.dart`):**
- Email/password authentication
- Form validation and error handling
- Loading states and user feedback
- Navigation to registration

**Registration Screen (`lib/screens/register_screen.dart`):**
- New user account creation
- Input validation and sanitization
- Integration with backend user management
- Success/error state handling

**Home Screen (`lib/screens/home_screen.dart`):**
- User dashboard with personalized content
- Case status overview
- Quick access to appointments
- Navigation to other features

**Appointment Screen (`lib/screens/appointment_screen.dart`):**
- Appointment scheduling interface
- Calendar integration
- Case selection and assignment
- Real-time availability checking

## State Management Architecture

### Provider Pattern Implementation

**Global App State:**
```dart
class AppState extends ChangeNotifier {
  User? _currentUser;
  String? _token;

  User? get currentUser => _currentUser;
  String? get token => _token;

  Future<void> login(String email, String password) async {
    // Authentication logic
    notifyListeners();
  }

  void logout() {
    // Cleanup logic
    notifyListeners();
  }
}
```

**Benefits:**
- Reactive UI updates
- Centralized state management
- Dependency injection
- Testable architecture

## API Integration

### HTTP Client Configuration

**RESTful API Communication:**
- HTTP package for API calls
- JWT token automatic injection
- Request/response interceptors
- Error handling and retry logic
- JSON serialization/deserialization

**API Endpoints Integration:**
- User authentication endpoints
- Case management APIs
- Appointment scheduling
- Profile management

## Security Implementation

### Client-Side Security

**Data Protection:**
- Secure token storage (encrypted)
- Input validation and sanitization
- HTTPS-only communication
- Certificate pinning (future implementation)

**Authentication Flow:**
1. User enters credentials
2. API call to authentication endpoint
3. JWT token received and stored securely
4. Automatic token inclusion in subsequent requests
5. Token refresh before expiration

## Development Workflow

### Local Development Setup

```bash
# Install Flutter dependencies
flutter pub get

# Run on connected device/emulator
flutter run

# Run tests
flutter test

# Build for production
flutter build apk  # Android
flutter build ios  # iOS
```

### Environment Configuration

**Development vs Production:**
- API endpoint configuration
- Debug/release build settings
- Logging levels
- Test vs production certificates

## Platform-Specific Features

### Android Configuration

**AndroidManifest.xml:**
- Network permissions
- Storage permissions for secure storage
- Minimum SDK requirements

### iOS Configuration

**Info.plist:**
- Network capabilities
- Keychain access for secure storage
- App transport security settings

## Testing Strategy

### Unit Tests
```bash
flutter test --coverage
# Tests for services, utilities, and business logic
```

### Widget Tests
```bash
flutter test --coverage
# UI component testing with Flutter test framework
```

### Integration Tests
```bash
flutter drive --target=test_driver/app.dart
# End-to-end testing with real device/emulator
```

## Build and Deployment

### Android Build Process

```bash
# Debug build
flutter build apk --debug

# Release build
flutter build apk --release

# App Bundle for Play Store
flutter build appbundle --release
```

### iOS Build Process

```bash
# Debug build
flutter build ios --debug

# Release build
flutter build ios --release

# Archive for App Store
flutter build ios --release
xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner archive
```

## Key Design Patterns

### Service-Oriented Architecture
- Separation of concerns between UI and business logic
- Dependency injection through Provider
- Repository pattern for data access
- Service layer for API communication

### Error Handling
- Centralized error management
- User-friendly error messages
- Graceful degradation
- Logging and reporting

### State Management
- Reactive programming with Provider
- Immutable state updates
- Side effect management
- State persistence

## Performance Optimizations

### App Performance
- Lazy loading of screens
- Image optimization and caching
- Efficient list rendering
- Memory management

### Network Performance
- Request caching strategies
- Background sync capabilities
- Offline mode support
- Bandwidth optimization

## Future Enhancements

### Planned Features
- Push notifications for appointment reminders
- Offline case viewing and editing
- Document upload and management
- Real-time chat support
- Biometric authentication

### Technical Improvements
- State management migration to Riverpod
- GraphQL API integration
- Advanced caching with Hive
- CI/CD pipeline integration

This mobile application provides a comprehensive client interface for the CAF case management system, ensuring secure, efficient, and user-friendly access to legal services on mobile devices.
