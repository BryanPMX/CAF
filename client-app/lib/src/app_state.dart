import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';

enum StripeCheckoutReturnStatus { success, cancel }

class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'CAF_API_BASE_URL',
    defaultValue: 'https://api.caf-mexico.org/api/v1',
  );

  static const String wsBaseUrlOverride = String.fromEnvironment(
    'CAF_WS_BASE_URL',
    defaultValue: '',
  );

  static const String paymentReturnScheme = String.fromEnvironment(
    'CAF_PAYMENT_RETURN_SCHEME',
    defaultValue: 'cafclient',
  );

  static const String paymentReturnHostsCsv = String.fromEnvironment(
    'CAF_PAYMENT_RETURN_HOSTS',
    defaultValue:
        'caf-mexico.org,www.caf-mexico.org,caf-mexico.com,www.caf-mexico.com,portal.caf-mexico.org,portal.caf-mexico.com',
  );

  static Uri apiUri(String path) {
    final normalizedPath = path.startsWith('/') ? path : '/$path';
    return Uri.parse(
        '${apiBaseUrl.replaceAll(RegExp(r'/+$'), '')}$normalizedPath');
  }

  static Uri websocketUri(String token) {
    final base = wsBaseUrlOverride.trim().isNotEmpty
        ? _normalizeWsUri(Uri.parse(wsBaseUrlOverride.trim()))
        : _deriveWsUriFromApi();
    final nextParams = Map<String, String>.from(base.queryParameters)
      ..['token'] = token;
    return base.replace(queryParameters: nextParams);
  }

  static Uri _normalizeWsUri(Uri uri) {
    final scheme = uri.scheme == 'https'
        ? 'wss'
        : (uri.scheme == 'http' ? 'ws' : uri.scheme);
    final trimmed = uri.path.replaceAll(RegExp(r'/+$'), '');
    final path = trimmed.endsWith('/ws') ? trimmed : '$trimmed/ws';
    return uri.replace(scheme: scheme, path: path.isEmpty ? '/ws' : path);
  }

  static Uri _deriveWsUriFromApi() {
    final api = Uri.parse(apiBaseUrl);
    var path = api.path.replaceAll(RegExp(r'/+$'), '');
    if (path.endsWith('/api/v1')) {
      path = path.substring(0, path.length - '/api/v1'.length);
    }
    final wsScheme = api.scheme == 'https' ? 'wss' : 'ws';
    final wsPath = '${path.isEmpty ? '' : path}/ws';
    return api.replace(scheme: wsScheme, path: wsPath);
  }

  static StripeCheckoutReturnStatus? parseStripeCheckoutReturnUri(Uri uri) {
    final scheme = uri.scheme.toLowerCase();
    final host = uri.host.toLowerCase();
    final path = uri.path.toLowerCase();
    final statusParam = (uri.queryParameters['status'] ?? '').toLowerCase();

    if (statusParam == 'success') return StripeCheckoutReturnStatus.success;
    if (statusParam == 'cancel' || statusParam == 'canceled') {
      return StripeCheckoutReturnStatus.cancel;
    }

    if (scheme == paymentReturnScheme.toLowerCase()) {
      if ((host == 'payments' || host == 'pagos') &&
          (path == '/success' || path == '/exito')) {
        return StripeCheckoutReturnStatus.success;
      }
      if ((host == 'payments' || host == 'pagos') &&
          (path == '/cancel' || path == '/cancelado')) {
        return StripeCheckoutReturnStatus.cancel;
      }
      final normalized = '$host$path';
      if (normalized == 'payments/success' || normalized == 'pagos/exito') {
        return StripeCheckoutReturnStatus.success;
      }
      if (normalized == 'payments/cancel' || normalized == 'pagos/cancelado') {
        return StripeCheckoutReturnStatus.cancel;
      }
    }

    if (scheme == 'https' || scheme == 'http') {
      final allowedHosts = paymentReturnHostsCsv
          .split(',')
          .map((e) => e.trim().toLowerCase())
          .where((e) => e.isNotEmpty)
          .toSet();
      if (allowedHosts.contains(host)) {
        if (path.endsWith('/pagos/exito'))
          return StripeCheckoutReturnStatus.success;
        if (path.endsWith('/pagos/cancelado')) {
          return StripeCheckoutReturnStatus.cancel;
        }
      }
    }

    return null;
  }
}

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.data});

  final String message;
  final int? statusCode;
  final dynamic data;

  @override
  String toString() =>
      'ApiException(statusCode: $statusCode, message: $message)';
}

class TokenStorage {
  static const _tokenKey = 'caf_client_jwt';

  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<String?> readToken() => _storage.read(key: _tokenKey);

  Future<void> writeToken(String token) =>
      _storage.write(key: _tokenKey, value: token);

  Future<void> clear() => _storage.delete(key: _tokenKey);
}

class ApiClient {
  ApiClient({TokenStorage? tokenStorage, http.Client? httpClient})
      : _tokenStorage = tokenStorage ?? TokenStorage(),
        _httpClient = httpClient ?? http.Client();

  final TokenStorage _tokenStorage;
  final http.Client _httpClient;

  Future<dynamic> get(
    String path, {
    bool authenticated = true,
    Map<String, String>? headers,
  }) {
    return _send('GET', path, authenticated: authenticated, headers: headers);
  }

  Future<dynamic> post(
    String path, {
    Object? body,
    bool authenticated = true,
    Map<String, String>? headers,
  }) {
    return _send(
      'POST',
      path,
      authenticated: authenticated,
      body: body,
      headers: headers,
    );
  }

  Future<dynamic> patch(
    String path, {
    Object? body,
    bool authenticated = true,
    Map<String, String>? headers,
  }) {
    return _send(
      'PATCH',
      path,
      authenticated: authenticated,
      body: body,
      headers: headers,
    );
  }

  Future<dynamic> _send(
    String method,
    String path, {
    bool authenticated = true,
    Object? body,
    Map<String, String>? headers,
  }) async {
    final uri = AppConfig.apiUri(path);
    final requestHeaders = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Version': 'v1',
      'X-Platform': defaultTargetPlatform.name,
      ...?headers,
    };

    if (authenticated) {
      final token = await _tokenStorage.readToken();
      if (token == null || token.isEmpty) {
        throw ApiException('Sesión no disponible', statusCode: 401);
      }
      requestHeaders['Authorization'] = 'Bearer $token';
    }

    http.Response response;
    try {
      switch (method) {
        case 'GET':
          response = await _httpClient
              .get(uri, headers: requestHeaders)
              .timeout(const Duration(seconds: 15));
          break;
        case 'POST':
          response = await _httpClient
              .post(uri,
                  headers: requestHeaders,
                  body: body == null ? null : jsonEncode(body))
              .timeout(const Duration(seconds: 20));
          break;
        case 'PATCH':
          response = await _httpClient
              .patch(uri,
                  headers: requestHeaders,
                  body: body == null ? null : jsonEncode(body))
              .timeout(const Duration(seconds: 20));
          break;
        default:
          throw ApiException('Método HTTP no soportado: $method');
      }
    } on TimeoutException {
      throw ApiException(
          'Tiempo de espera agotado al conectar con el servidor');
    } on http.ClientException {
      throw ApiException('No fue posible conectar con el servidor');
    } on Exception {
      throw ApiException('No fue posible completar la solicitud');
    }

    dynamic data;
    final bodyText = response.body;
    if (bodyText.isNotEmpty) {
      try {
        data = jsonDecode(bodyText);
      } catch (_) {
        data = bodyText;
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        _extractErrorMessage(data) ??
            'Solicitud fallida (${response.statusCode})',
        statusCode: response.statusCode,
        data: data,
      );
    }

    return data;
  }

  String? _extractErrorMessage(dynamic data) {
    if (data is Map) {
      final error = data['error'];
      if (error is String && error.trim().isNotEmpty) return error;
      final message = data['message'];
      if (message is String && message.trim().isNotEmpty) return message;
    }
    if (data is String && data.trim().isNotEmpty) {
      return data;
    }
    return null;
  }

  void close() {
    _httpClient.close();
  }
}

class RealtimeService {
  RealtimeService({
    required this.onNotificationMessage,
    required this.onConnectionChanged,
  });

  final void Function(Map<String, dynamic> message) onNotificationMessage;
  final void Function(bool connected) onConnectionChanged;

  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _reconnectTimer;
  bool _manuallyDisconnected = false;
  bool _connected = false;
  String? _token;
  int _reconnectAttempts = 0;

  bool get isConnected => _connected;

  void connect(String token) {
    _token = token;
    _manuallyDisconnected = false;
    _reconnectTimer?.cancel();
    _open();
  }

  void _open() {
    final token = _token;
    if (token == null || token.isEmpty) return;

    _subscription?.cancel();
    try {
      final uri = AppConfig.websocketUri(token);
      _channel = WebSocketChannel.connect(uri);
      _setConnected(true);
      _subscription = _channel!.stream.listen(
        (event) {
          if (event is String) {
            try {
              final decoded = jsonDecode(event);
              if (decoded is Map<String, dynamic>) {
                onNotificationMessage(decoded);
              } else if (decoded is Map) {
                onNotificationMessage(Map<String, dynamic>.from(decoded));
              }
            } catch (_) {
              // Ignore malformed messages.
            }
          } else if (event is Map) {
            onNotificationMessage(Map<String, dynamic>.from(event));
          }
          _reconnectAttempts = 0;
        },
        onError: (_) => _handleDisconnect(),
        onDone: _handleDisconnect,
        cancelOnError: true,
      );
    } catch (_) {
      _handleDisconnect();
    }
  }

  void _handleDisconnect() {
    _setConnected(false);
    if (_manuallyDisconnected) return;
    _reconnectTimer?.cancel();
    final delaySeconds = (_reconnectAttempts + 1).clamp(1, 5);
    _reconnectAttempts = (_reconnectAttempts + 1).clamp(0, 20);
    _reconnectTimer = Timer(Duration(seconds: delaySeconds), _open);
  }

  void _setConnected(bool value) {
    if (_connected == value) return;
    _connected = value;
    onConnectionChanged(value);
  }

  void disconnect() {
    _manuallyDisconnected = true;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _subscription?.cancel();
    _subscription = null;
    _channel?.sink.close();
    _channel = null;
    _setConnected(false);
  }

  void dispose() {
    disconnect();
  }
}

Map<String, dynamic> _asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return const <String, dynamic>{};
}

List<Map<String, dynamic>> _asMapList(dynamic value) {
  if (value is! List) return const <Map<String, dynamic>>[];
  return value.map((e) => _asMap(e)).toList(growable: false);
}

String _asString(dynamic value, {String fallback = ''}) {
  if (value is String) return value;
  if (value == null) return fallback;
  return '$value';
}

int? _asInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

double? _asDouble(dynamic value) {
  if (value is double) return value;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

DateTime? _asDate(dynamic value) {
  if (value is String && value.isNotEmpty) {
    return DateTime.tryParse(value)?.toLocal();
  }
  return null;
}

String _fullName(Map<String, dynamic> userMap) {
  final first = _asString(userMap['firstName']).trim();
  final last = _asString(userMap['lastName']).trim();
  return [first, last].where((e) => e.isNotEmpty).join(' ').trim();
}

class AuthUser {
  AuthUser({
    required this.id,
    required this.email,
    required this.role,
    required this.firstName,
    required this.lastName,
  });

  final int id;
  final String email;
  final String role;
  final String firstName;
  final String lastName;

  String get fullName =>
      [firstName, lastName].where((e) => e.isNotEmpty).join(' ');

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: _asInt(json['id']) ?? 0,
      email: _asString(json['email']),
      role: _asString(json['role']),
      firstName: _asString(json['firstName']),
      lastName: _asString(json['lastName']),
    );
  }
}

class ClientProfile {
  ClientProfile({
    required this.userId,
    required this.role,
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.phone,
    required this.avatarUrl,
    required this.officeId,
    required this.officeName,
  });

  final int userId;
  final String role;
  final String firstName;
  final String lastName;
  final String email;
  final String phone;
  final String avatarUrl;
  final int? officeId;
  final String officeName;

  String get fullName =>
      [firstName, lastName].where((e) => e.isNotEmpty).join(' ');

  factory ClientProfile.fromJson(Map<String, dynamic> json) {
    final office = _asMap(json['office']);
    return ClientProfile(
      userId: _asInt(json['userID']) ?? _asInt(json['id']) ?? 0,
      role: _asString(json['role']),
      firstName: _asString(json['firstName']),
      lastName: _asString(json['lastName']),
      email: _asString(json['email']),
      phone: _asString(json['phone']),
      avatarUrl: _asString(json['avatarUrl']),
      officeId: _asInt(json['officeId']),
      officeName: _asString(office['name']),
    );
  }
}

class AppNotificationItem {
  AppNotificationItem({
    required this.id,
    required this.message,
    required this.type,
    required this.isRead,
    required this.link,
    required this.entityType,
    required this.entityId,
    required this.createdAt,
  });

  final int id;
  final String message;
  final String type;
  final bool isRead;
  final String? link;
  final String entityType;
  final int? entityId;
  final DateTime? createdAt;

  AppNotificationItem copyWith({bool? isRead}) {
    return AppNotificationItem(
      id: id,
      message: message,
      type: type,
      isRead: isRead ?? this.isRead,
      link: link,
      entityType: entityType,
      entityId: entityId,
      createdAt: createdAt,
    );
  }

  factory AppNotificationItem.fromJson(Map<String, dynamic> json) {
    return AppNotificationItem(
      id: _asInt(json['id']) ?? 0,
      message: _asString(json['message']),
      type: _asString(json['type'], fallback: 'info'),
      isRead: json['isRead'] == true,
      link: json['link'] == null ? null : _asString(json['link']),
      entityType: _asString(json['entityType']),
      entityId: _asInt(json['entityId']),
      createdAt: _asDate(json['createdAt']),
    );
  }
}

class OfficeContact {
  OfficeContact({
    required this.id,
    required this.name,
    required this.address,
    required this.phoneOffice,
    required this.phoneCell,
  });

  final int id;
  final String name;
  final String address;
  final String phoneOffice;
  final String phoneCell;

  factory OfficeContact.fromJson(Map<String, dynamic> json) {
    return OfficeContact(
      id: _asInt(json['id']) ?? 0,
      name: _asString(json['name']),
      address: _asString(json['address']),
      phoneOffice: _asString(json['phoneOffice']),
      phoneCell: _asString(json['phoneCell']),
    );
  }
}

class AppointmentItem {
  AppointmentItem({
    required this.id,
    required this.caseId,
    required this.caseTitle,
    required this.title,
    required this.status,
    required this.category,
    required this.department,
    required this.startTime,
    required this.endTime,
    required this.staffName,
    required this.officeName,
  });

  final int id;
  final int? caseId;
  final String caseTitle;
  final String title;
  final String status;
  final String category;
  final String department;
  final DateTime? startTime;
  final DateTime? endTime;
  final String staffName;
  final String officeName;

  factory AppointmentItem.fromJson(Map<String, dynamic> json) {
    final caseMap = _asMap(json['case']);
    final officeMap = _asMap(json['office']);
    final staffMap = _asMap(json['staff']);
    return AppointmentItem(
      id: _asInt(json['id']) ?? 0,
      caseId: _asInt(json['caseId']),
      caseTitle: _asString(caseMap['title']),
      title: _asString(json['title']),
      status: _asString(json['status']),
      category: _asString(json['category']),
      department: _asString(json['department']),
      startTime: _asDate(json['startTime']),
      endTime: _asDate(json['endTime']),
      staffName: _fullName(staffMap),
      officeName: _asString(officeMap['name'],
          fallback: _asString(_asMap(caseMap['office'])['name'])),
    );
  }
}

class PaymentReceipt {
  PaymentReceipt({
    required this.id,
    required this.amountCents,
    required this.currency,
    required this.status,
    required this.paid,
    required this.receiptUrl,
    required this.description,
    required this.caseId,
    required this.createdAt,
  });

  final String id;
  final int amountCents;
  final String currency;
  final String status;
  final bool paid;
  final String receiptUrl;
  final String description;
  final int? caseId;
  final DateTime? createdAt;

  double get amount => amountCents / 100.0;

  factory PaymentReceipt.fromJson(Map<String, dynamic> json) {
    return PaymentReceipt(
      id: _asString(json['id']),
      amountCents: _asInt(json['amountCents']) ?? 0,
      currency: _asString(json['currency'], fallback: 'MXN'),
      status: _asString(json['status']),
      paid: json['paid'] == true,
      receiptUrl: _asString(json['receiptUrl']),
      description: _asString(json['description']),
      caseId: _asInt(json['caseId']),
      createdAt: _asDate(json['createdAt']),
    );
  }
}

class CaseSummary {
  CaseSummary({
    required this.id,
    required this.title,
    required this.description,
    required this.status,
    required this.category,
    required this.priority,
    required this.currentStage,
    required this.fee,
    required this.updatedAt,
    required this.officeName,
    required this.primaryStaffName,
  });

  final int id;
  final String title;
  final String description;
  final String status;
  final String category;
  final String priority;
  final String currentStage;
  final double fee;
  final DateTime? updatedAt;
  final String officeName;
  final String primaryStaffName;

  factory CaseSummary.fromJson(Map<String, dynamic> json) {
    return CaseSummary(
      id: _asInt(json['id']) ?? 0,
      title: _asString(json['title']),
      description: _asString(json['description']),
      status: _asString(json['status']),
      category: _asString(json['category']),
      priority: _asString(json['priority']),
      currentStage: _asString(json['currentStage']),
      fee: _asDouble(json['fee']) ?? 0,
      updatedAt: _asDate(json['updatedAt']),
      officeName: _asString(_asMap(json['office'])['name']),
      primaryStaffName: _fullName(_asMap(json['primaryStaff'])),
    );
  }
}

class CaseTimelineEvent {
  CaseTimelineEvent({
    required this.id,
    required this.eventType,
    required this.visibility,
    required this.commentText,
    required this.description,
    required this.fileName,
    required this.fileType,
    required this.createdAt,
    required this.authorName,
  });

  final int id;
  final String eventType;
  final String visibility;
  final String commentText;
  final String description;
  final String fileName;
  final String fileType;
  final DateTime? createdAt;
  final String authorName;

  bool get isComment => eventType == 'comment';
  bool get isDocument => eventType == 'file_upload';

  factory CaseTimelineEvent.fromJson(Map<String, dynamic> json) {
    return CaseTimelineEvent(
      id: _asInt(json['id']) ?? 0,
      eventType: _asString(json['eventType']),
      visibility: _asString(json['visibility']),
      commentText: _asString(json['commentText']),
      description: _asString(json['description']),
      fileName: _asString(json['fileName']),
      fileType: _asString(json['fileType']),
      createdAt: _asDate(json['createdAt']),
      authorName: _fullName(_asMap(json['user'])),
    );
  }
}

class StaffContact {
  StaffContact({
    required this.id,
    required this.name,
    required this.role,
    required this.email,
    required this.phone,
  });

  final int id;
  final String name;
  final String role;
  final String email;
  final String phone;

  factory StaffContact.fromJson(Map<String, dynamic> json) {
    return StaffContact(
      id: _asInt(json['id']) ?? 0,
      name: _fullName(json),
      role: _asString(json['role']),
      email: _asString(json['email']),
      phone: _asString(json['phone']),
    );
  }
}

class CaseDetail {
  CaseDetail({
    required this.summary,
    required this.events,
    required this.appointments,
    required this.primaryStaff,
    required this.office,
  });

  final CaseSummary summary;
  final List<CaseTimelineEvent> events;
  final List<AppointmentItem> appointments;
  final StaffContact? primaryStaff;
  final OfficeContact? office;

  factory CaseDetail.fromJson(Map<String, dynamic> json) {
    final primaryStaffMap = _asMap(json['primaryStaff']);
    final officeMap = _asMap(json['office']);
    return CaseDetail(
      summary: CaseSummary.fromJson(json),
      events: _asMapList(json['caseEvents'])
          .map(CaseTimelineEvent.fromJson)
          .toList(growable: false),
      appointments: _asMapList(json['appointments'])
          .map(AppointmentItem.fromJson)
          .toList(growable: false),
      primaryStaff: primaryStaffMap.isEmpty
          ? null
          : StaffContact.fromJson(primaryStaffMap),
      office: officeMap.isEmpty ? null : OfficeContact.fromJson(officeMap),
    );
  }
}

class AppState extends ChangeNotifier {
  AppState({ApiClient? apiClient, TokenStorage? tokenStorage})
      : _tokenStorage = tokenStorage ?? TokenStorage(),
        _api = apiClient ??
            ApiClient(tokenStorage: tokenStorage ?? TokenStorage()) {
    _realtime = RealtimeService(
      onNotificationMessage: _handleRealtimeMessage,
      onConnectionChanged: (connected) {
        _isRealtimeConnected = connected;
        notifyListeners();
      },
    );
  }

  final TokenStorage _tokenStorage;
  final ApiClient _api;
  late final RealtimeService _realtime;

  bool _isBootstrapping = true;
  bool _isAuthenticated = false;
  bool _isBusy = false;
  bool _isRefreshing = false;
  bool _isRealtimeConnected = false;
  String? _errorMessage;

  AuthUser? _authUser;
  ClientProfile? _profile;
  List<AppNotificationItem> _notifications = const [];
  int _unreadNotifications = 0;
  List<CaseSummary> _cases = const [];
  List<AppointmentItem> _appointments = const [];
  List<PaymentReceipt> _paymentReceipts = const [];
  List<OfficeContact> _offices = const [];
  bool _paymentsConfigured = true;
  String? _paymentsMessage;
  CaseDetail? _selectedCaseDetail;
  int? _selectedCaseId;
  DateTime? _lastSyncAt;

  bool get isBootstrapping => _isBootstrapping;
  bool get isAuthenticated => _isAuthenticated;
  bool get isBusy => _isBusy;
  bool get isRefreshing => _isRefreshing;
  bool get isRealtimeConnected => _isRealtimeConnected;
  String? get errorMessage => _errorMessage;
  AuthUser? get authUser => _authUser;
  ClientProfile? get profile => _profile;
  List<AppNotificationItem> get notifications => _notifications;
  int get unreadNotifications => _unreadNotifications;
  List<CaseSummary> get cases => _cases;
  List<AppointmentItem> get appointments => _appointments;
  List<PaymentReceipt> get paymentReceipts => _paymentReceipts;
  List<OfficeContact> get offices => _offices;
  bool get paymentsConfigured => _paymentsConfigured;
  String? get paymentsMessage => _paymentsMessage;
  CaseDetail? get selectedCaseDetail => _selectedCaseDetail;
  int? get selectedCaseId => _selectedCaseId;
  DateTime? get lastSyncAt => _lastSyncAt;

  AppointmentItem? get nextAppointment {
    final now = DateTime.now();
    final futureItems = _appointments
        .where((a) => a.startTime != null && a.startTime!.isAfter(now))
        .toList();
    futureItems.sort((a, b) => a.startTime!.compareTo(b.startTime!));
    return futureItems.isEmpty ? null : futureItems.first;
  }

  double get totalCaseFees =>
      _cases.fold<double>(0, (sum, item) => sum + item.fee);

  void clearError() {
    if (_errorMessage == null) return;
    _errorMessage = null;
    notifyListeners();
  }

  Future<void> bootstrap() async {
    _isBootstrapping = true;
    notifyListeners();

    try {
      final token = await _tokenStorage.readToken();
      if (token == null || token.isEmpty) {
        _isAuthenticated = false;
        return;
      }

      _isAuthenticated = true;
      await _loadSessionData(initialLoad: true);
      _realtime.connect(token);
    } on ApiException catch (e) {
      await _forceLogout(localOnly: true);
      _errorMessage = e.message;
    } catch (_) {
      await _forceLogout(localOnly: true);
      _errorMessage = 'No fue posible restaurar la sesión';
    } finally {
      _isBootstrapping = false;
      notifyListeners();
    }
  }

  Future<String?> login(String email, String password) async {
    _isBusy = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final raw = await _api.post(
        '/login',
        authenticated: false,
        body: {
          'email': email.trim(),
          'password': password,
          'deviceId': 'flutter-client-app',
        },
      );

      final data = _asMap(raw);
      final token = _asString(data['token']);
      final user = AuthUser.fromJson(_asMap(data['user']));

      if (token.isEmpty) {
        throw ApiException('Respuesta inválida del servidor');
      }
      if (user.role != 'client') {
        throw ApiException('Esta app es exclusiva para clientes.');
      }

      await _tokenStorage.writeToken(token);
      _authUser = user;
      _isAuthenticated = true;
      await _loadSessionData(initialLoad: true);
      _realtime.connect(token);
      return null;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return e.message;
    } catch (_) {
      _errorMessage = 'Error inesperado al iniciar sesión';
      return _errorMessage;
    } finally {
      _isBusy = false;
      notifyListeners();
    }
  }

  Future<String?> register({
    required String firstName,
    required String lastName,
    required String email,
    required String password,
  }) async {
    _isBusy = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _api.post(
        '/register',
        authenticated: false,
        body: {
          'firstName': firstName.trim(),
          'lastName': lastName.trim(),
          'email': email.trim(),
          'password': password,
          'role': 'client',
        },
      );
      return null;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return e.message;
    } catch (_) {
      _errorMessage = 'No fue posible registrar la cuenta';
      return _errorMessage;
    } finally {
      _isBusy = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await _forceLogout(localOnly: false);
    notifyListeners();
  }

  Future<void> _forceLogout({required bool localOnly}) async {
    _realtime.disconnect();
    if (!localOnly) {
      try {
        await _api.post('/logout', body: const {}, authenticated: true);
      } catch (_) {
        // Stateless logout; local cleanup is enough.
      }
    }
    await _tokenStorage.clear();
    _isAuthenticated = false;
    _authUser = null;
    _profile = null;
    _notifications = const [];
    _unreadNotifications = 0;
    _cases = const [];
    _appointments = const [];
    _paymentReceipts = const [];
    _offices = const [];
    _paymentsConfigured = true;
    _paymentsMessage = null;
    _selectedCaseDetail = null;
    _selectedCaseId = null;
    _lastSyncAt = null;
    _errorMessage = null;
  }

  Future<void> refreshAll() async {
    if (!_isAuthenticated) return;
    _isRefreshing = true;
    notifyListeners();
    try {
      await _loadSessionData(initialLoad: false);
    } finally {
      _isRefreshing = false;
      notifyListeners();
    }
  }

  Future<void> _loadSessionData({required bool initialLoad}) async {
    await Future.wait<void>([
      loadProfile(silent: true),
      loadNotifications(silent: true),
      loadCases(silent: true),
      loadAppointments(silent: true),
      loadPaymentReceipts(silent: true),
      loadOffices(silent: true),
    ]);

    if (_selectedCaseId != null) {
      await loadCaseDetail(_selectedCaseId!, silent: true);
    } else if (_cases.isNotEmpty) {
      _selectedCaseId = _cases.first.id;
      await loadCaseDetail(_selectedCaseId!, silent: true);
    }

    if (!initialLoad) {
      _lastSyncAt = DateTime.now();
    } else {
      _lastSyncAt = DateTime.now();
    }
  }

  Future<void> loadProfile({bool silent = false}) async {
    try {
      final raw = await _api.get('/client/profile');
      final data = _asMap(raw);
      _profile = ClientProfile.fromJson(data);
      _authUser ??= AuthUser(
        id: _profile!.userId,
        email: _profile!.email,
        role: _profile!.role,
        firstName: _profile!.firstName,
        lastName: _profile!.lastName,
      );
    } on ApiException catch (e) {
      if (!silent) {
        _errorMessage = e.message;
        notifyListeners();
      }
      rethrow;
    }
  }

  Future<void> loadNotifications({bool silent = false}) async {
    try {
      final raw = await _api.get('/client/notifications');
      final data = _asMap(raw);
      _notifications = _asMapList(data['notifications'])
          .map(AppNotificationItem.fromJson)
          .toList(growable: false);
      _unreadNotifications = _asInt(data['unread_count']) ??
          _notifications.where((n) => !n.isRead).length;
      if (!silent) notifyListeners();
    } on ApiException catch (e) {
      if (!silent) {
        _errorMessage = e.message;
        notifyListeners();
      }
      rethrow;
    }
  }

  Future<void> loadCases({bool silent = false}) async {
    try {
      final raw = await _api.get('/client/cases');
      final data = _asMap(raw);
      _cases = _asMapList(data['data'])
          .map(CaseSummary.fromJson)
          .toList(growable: false);
      if (_cases.isEmpty) {
        _selectedCaseId = null;
        _selectedCaseDetail = null;
      } else if (_selectedCaseId == null ||
          !_cases.any((c) => c.id == _selectedCaseId)) {
        _selectedCaseId = _cases.first.id;
      }
      if (!silent) notifyListeners();
    } on ApiException catch (e) {
      if (!silent) {
        _errorMessage = e.message;
        notifyListeners();
      }
      rethrow;
    }
  }

  Future<void> selectCase(int caseId) async {
    _selectedCaseId = caseId;
    notifyListeners();
    await loadCaseDetail(caseId);
  }

  Future<void> loadCaseDetail(int caseId, {bool silent = false}) async {
    try {
      final raw = await _api.get('/client/cases/$caseId');
      final data = _asMap(raw);
      _selectedCaseDetail = CaseDetail.fromJson(data);
      _selectedCaseId = caseId;
      if (!silent) notifyListeners();
    } on ApiException catch (e) {
      if (!silent) {
        _errorMessage = e.message;
        notifyListeners();
      }
      rethrow;
    }
  }

  Future<void> loadAppointments({bool silent = false}) async {
    try {
      final raw = await _api.get('/client/appointments');
      final data = _asMap(raw);
      _appointments = _asMapList(data['data'])
          .map(AppointmentItem.fromJson)
          .toList(growable: false);
      if (!silent) notifyListeners();
    } on ApiException catch (e) {
      if (!silent) {
        _errorMessage = e.message;
        notifyListeners();
      }
      rethrow;
    }
  }

  Future<void> loadPaymentReceipts({bool silent = false}) async {
    try {
      final raw = await _api.get('/client/payments/receipts');
      final data = _asMap(raw);
      _paymentReceipts = _asMapList(data['receipts'])
          .map(PaymentReceipt.fromJson)
          .toList(growable: false);
      _paymentsConfigured = true;
      _paymentsMessage = null;
      if (!silent) notifyListeners();
    } on ApiException catch (e) {
      if (e.statusCode == 503) {
        _paymentReceipts = const [];
        _paymentsConfigured = false;
        _paymentsMessage = e.message;
        if (!silent) notifyListeners();
        return;
      }
      if (!silent) {
        _errorMessage = e.message;
        notifyListeners();
      }
      rethrow;
    }
  }

  Future<void> loadOffices({bool silent = false}) async {
    try {
      final raw = await _api.get('/client/offices');
      if (raw is List) {
        _offices = raw
            .map((e) => OfficeContact.fromJson(_asMap(e)))
            .toList(growable: false);
      } else {
        _offices = _asMapList(_asMap(raw)['data'])
            .map(OfficeContact.fromJson)
            .toList(growable: false);
      }
      if (!silent) notifyListeners();
    } on ApiException catch (e) {
      if (!silent) {
        _errorMessage = e.message;
        notifyListeners();
      }
      rethrow;
    }
  }

  Future<void> markNotificationAsRead(int notificationId) async {
    final idx = _notifications.indexWhere((n) => n.id == notificationId);
    if (idx == -1) return;
    if (_notifications[idx].isRead) return;

    final updated = [..._notifications];
    updated[idx] = updated[idx].copyWith(isRead: true);
    _notifications = updated;
    _unreadNotifications = _notifications.where((n) => !n.isRead).length;
    notifyListeners();

    try {
      await _api.post(
        '/client/notifications/mark-read',
        body: {
          'notificationIds': [notificationId],
        },
      );
    } on ApiException catch (e) {
      _errorMessage = e.message;
      await loadNotifications(silent: true);
      notifyListeners();
    }
  }

  Future<void> markAllNotificationsAsRead() async {
    final ids = _notifications
        .where((n) => !n.isRead)
        .map((n) => n.id)
        .toList(growable: false);
    if (ids.isEmpty) return;

    _notifications = _notifications
        .map((n) => n.copyWith(isRead: true))
        .toList(growable: false);
    _unreadNotifications = 0;
    notifyListeners();

    try {
      await _api.post(
        '/client/notifications/mark-read',
        body: {'notificationIds': ids},
      );
    } on ApiException catch (e) {
      _errorMessage = e.message;
      await loadNotifications(silent: true);
      notifyListeners();
    }
  }

  Future<String?> sendCaseMessage({
    required int caseId,
    required String comment,
  }) async {
    final trimmed = comment.trim();
    if (trimmed.isEmpty) {
      return 'Escribe un mensaje antes de enviar.';
    }

    try {
      await _api.post(
        '/client/cases/$caseId/comments',
        body: {'comment': trimmed},
      );
      await Future.wait<void>([
        loadCaseDetail(caseId, silent: true),
        loadNotifications(silent: true),
      ]);
      notifyListeners();
      return null;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      notifyListeners();
      return e.message;
    }
  }

  Future<String?> createCheckoutForCase(int caseId) async {
    try {
      final raw = await _api.post(
        '/client/payments/checkout-session',
        body: {'caseId': caseId},
      );
      final data = _asMap(raw);
      final url = _asString(data['checkoutUrl']);
      if (url.isEmpty) {
        return 'El servidor no devolvió una URL de pago.';
      }
      _paymentsConfigured = true;
      _paymentsMessage = null;
      unawaited(loadPaymentReceipts(silent: true));
      notifyListeners();
      return url;
    } on ApiException catch (e) {
      if (e.statusCode == 503) {
        _paymentsConfigured = false;
        _paymentsMessage = e.message;
      } else {
        _errorMessage = e.message;
      }
      notifyListeners();
      return null;
    }
  }

  Future<String?> handleStripeCheckoutReturn(
    StripeCheckoutReturnStatus status, {
    Uri? uri,
  }) async {
    try {
      final caseId = _asInt(uri?.queryParameters['case_id']);
      await Future.wait<void>([
        loadPaymentReceipts(silent: true),
        loadNotifications(silent: true),
      ]);
      if (caseId != null && caseId > 0) {
        if (_selectedCaseId == caseId) {
          await loadCaseDetail(caseId, silent: true);
        }
      } else if (_selectedCaseId != null) {
        await loadCaseDetail(_selectedCaseId!, silent: true);
      }
      _lastSyncAt = DateTime.now();
      notifyListeners();

      switch (status) {
        case StripeCheckoutReturnStatus.success:
          return 'Pago procesado. Estamos actualizando tus recibos.';
        case StripeCheckoutReturnStatus.cancel:
          return 'Pago cancelado. Puedes intentarlo nuevamente cuando gustes.';
      }
    } on ApiException catch (e) {
      _errorMessage = e.message;
      notifyListeners();
      return e.message;
    } catch (_) {
      _errorMessage = 'No fue posible actualizar el estado del pago.';
      notifyListeners();
      return _errorMessage;
    }
  }

  Future<void> refreshPaymentsAfterExternalCheckout(
      {bool silent = false}) async {
    try {
      await loadPaymentReceipts(silent: true);
      await loadNotifications(silent: true);
      _lastSyncAt = DateTime.now();
      if (!silent) notifyListeners();
    } on ApiException catch (e) {
      if (!silent) {
        _errorMessage = e.message;
        notifyListeners();
      }
    }
  }

  void _handleRealtimeMessage(Map<String, dynamic> message) {
    final type = _asString(message['type']);
    if (type == 'notification') {
      unawaited(loadNotifications(silent: true));
      final notificationPayload = _asMap(message['notification']);
      final entityType = _asString(notificationPayload['entityType']);
      if (entityType == 'payment') {
        unawaited(loadPaymentReceipts(silent: true));
      }
      if (entityType == 'case' && _selectedCaseId != null) {
        unawaited(loadCaseDetail(_selectedCaseId!, silent: true));
      }
      unawaited(loadAppointments(silent: true));
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _realtime.dispose();
    _api.close();
    super.dispose();
  }
}
