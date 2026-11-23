import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:client_app/src/app_state.dart';
import 'package:client_app/src/portal/access.dart';
import 'fakes.dart';

void main() {
  for (final role in PortalRole.values) {
    test(
      '${role.value} authenticates with authoritative profile and correct data endpoints',
      () async {
        final paths = <String>[];
        final tokens = MemoryTokens();
        final api = ApiClient(
          tokenStorage: tokens,
          httpClient: MockClient((request) async {
            paths.add(request.url.path);
            final path = request.url.path;
            Object response = {};
            if (path.endsWith('/login')) {
              response = {
                'token': 'synthetic-token',
                'user': {
                  'id': 10,
                  'role': role.value,
                  'email': 'person@example.test',
                },
              };
            } else if (path.endsWith('/profile')) {
              response = {
                'userID': '10',
                'role': role.value,
                'firstName': 'Persona',
                'lastName': 'CAF',
                'officeId': role.allOffices ? null : 1,
              };
            } else if (path.endsWith('/cases') ||
                path.endsWith('/appointments')) {
              response = {'data': []};
            } else if (path.endsWith('/notifications')) {
              response = {'notifications': [], 'unread_count': 0};
            } else if (path.endsWith('/receipts')) {
              response = {'receipts': []};
            } else if (path.endsWith('/offices')) {
              response = [];
            }
            return http.Response(jsonEncode(response), 200);
          }),
        );
        final state = AppState(
          apiClient: api,
          tokenStorage: tokens,
          realtimeService: OfflineRealtime(),
        );
        expect(await state.login('person@example.test', 'test-only'), isNull);
        expect(state.isAuthenticated, true);
        expect(state.role, role);
        if (role.isEmployee) {
          expect(paths.where((path) => path.contains('/client/')), isEmpty);
          expect(state.cases, isEmpty);
        } else {
          expect(paths, contains('/api/v1/client/cases'));
        }
        await state.logout();
        expect(tokens.value, isNull);
        expect(state.profile, isNull);
        expect(state.authUser, isNull);
        state.dispose();
      },
    );
  }

  test(
    'unsupported/retired roles cannot keep a token or authenticated state',
    () async {
      final tokens = MemoryTokens();
      final api = ApiClient(
        tokenStorage: tokens,
        httpClient: MockClient(
          (_) async => http.Response(
            '{"token":"test","user":{"id":1,"role":"office_manager"}}',
            200,
          ),
        ),
      );
      final state = AppState(
        apiClient: api,
        tokenStorage: tokens,
        realtimeService: OfflineRealtime(),
      );
      expect(await state.login('person@example.test', 'test-only'), isNotNull);
      expect(tokens.value, isNull);
      expect(state.isAuthenticated, false);
      state.dispose();
    },
  );

  test(
    'restoring a staff session tries the authoritative staff profile only after client 403',
    () async {
      final tokens = MemoryTokens()..value = 'saved-token';
      final paths = <String>[];
      final api = ApiClient(
        tokenStorage: tokens,
        httpClient: MockClient((request) async {
          paths.add(request.url.path);
          if (request.url.path.contains('/client/')) {
            return http.Response('{"error":"Forbidden"}', 403);
          }
          return http.Response(
            '{"userID":"6","role":"lawyer","officeId":1}',
            200,
          );
        }),
      );
      final state = AppState(
        apiClient: api,
        tokenStorage: tokens,
        realtimeService: OfflineRealtime(),
      );
      await state.bootstrap();
      expect(paths, ['/api/v1/client/profile', '/api/v1/profile']);
      expect(state.role, PortalRole.lawyer);
      expect(state.isAuthenticated, true);
      state.dispose();
    },
  );

  test('expired token is cleared without trying another role route', () async {
    final tokens = MemoryTokens()..value = 'expired-token';
    final paths = <String>[];
    final api = ApiClient(
      tokenStorage: tokens,
      httpClient: MockClient((request) async {
        paths.add(request.url.path);
        return http.Response('{"error":"Sesión expirada"}', 401);
      }),
    );
    final state = AppState(
      apiClient: api,
      tokenStorage: tokens,
      realtimeService: OfflineRealtime(),
    );
    await state.bootstrap();
    expect(paths, ['/api/v1/client/profile']);
    expect(state.isAuthenticated, false);
    expect(tokens.value, isNull);
    state.dispose();
  });
}
