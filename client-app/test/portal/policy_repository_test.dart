import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:client_app/src/app_state.dart';
import 'package:client_app/src/portal/access.dart';
import 'package:client_app/src/portal/models.dart';
import 'package:client_app/src/portal/repository.dart';
import 'fakes.dart';

void main() {
  test(
    'only supported roles can select an API group; client has no employee prefix',
    () {
      expect(PortalRole.parse('office_manager'), isNull);
      expect(PortalRole.parse('superadmin'), isNull);
      expect(() => PortalRole.client.endpointPrefix, throwsStateError);
      for (final role in PortalRole.values.where((role) => role.isEmployee)) {
        expect(role.endpointPrefix, role.isManagement ? '/admin' : '/staff');
        expect(
          role.allOffices,
          [
            PortalRole.technicalSupport,
            PortalRole.executiveDirector,
          ].contains(role),
        );
        expect(role.canResetPasswords, role == PortalRole.technicalSupport);
      }
    },
  );

  test(
    'employment preserves zeroes, accepts overnight shifts, and requires paired hours',
    () {
      const snapshot = Employment(
        maquilaId: 5,
        employeeNumber: '000042',
        shiftName: 'Tercero',
        shiftStart: '22:00',
        shiftEnd: '06:00',
      );
      expect(snapshot.validate(), isNull);
      expect(snapshot.toJson()['employeeNumber'], '000042');
      expect(
        const Employment(
          maquilaId: 5,
          employeeNumber: '4',
          shiftName: 'Mixto',
          shiftStart: '08:00',
        ).validate(),
        isNotNull,
      );
      expect(
        const Employment(
          maquilaId: 5,
          employeeNumber: '4',
          shiftName: 'Mixto',
          shiftStart: '24:00',
          shiftEnd: '08:00',
        ).validate(),
        isNotNull,
      );
      expect(const Employment(maquilaId: 5).validate(), isNotNull);
      expect(
        const Employment(employeeNumber: 'old', shiftName: 'old').toJson(),
        {
          'maquilaId': null,
          'employeeNumber': '',
          'shiftName': '',
          'shiftStart': '',
          'shiftEnd': '',
        },
      );
    },
  );

  test(
    'repository uses server pagination, encoded search, role routes and JSON PUT',
    () async {
      final storage = MemoryTokens();
      await storage.writeToken('test-token');
      final requests = <http.Request>[];
      final api = ApiClient(
        tokenStorage: storage,
        httpClient: MockClient((request) async {
          requests.add(request);
          expect(request.headers['Authorization'], 'Bearer test-token');
          if (request.method == 'PUT') return http.Response('{}', 200);
          if (request.url.path.endsWith('/cases/8')) {
            return http.Response(
              jsonEncode({'id': 8, 'title': 'Divorcios'}),
              200,
            );
          }
          return http.Response(
            jsonEncode({
              'data': [
                {'id': 8},
              ],
              'pagination': {'total': 42},
            }),
            200,
          );
        }),
      );
      final repository = HttpPortalRepository(api, PortalRole.administrator);
      final result = await repository.cases(
        page: 2,
        query: 'María & José',
        status: 'open',
      );
      expect(result.total, 42);
      expect(requests.first.url.queryParameters, {
        'page': '2',
        'limit': '20',
        'search': 'María & José',
        'status': 'open',
      });
      expect(requests.first.url.path, '/api/v1/admin/cases');
      expect((await repository.caseDetail(8)).id, 8);
      await repository.saveCase({'title': 'Prueba'}, id: 8);
      expect(requests.last.method, 'PUT');
      expect(jsonDecode(requests.last.body), {'title': 'Prueba'});
      final staff = HttpPortalRepository(api, PortalRole.lawyer);
      await staff.cases();
      expect(requests.last.url.path, '/api/v1/staff/cases');
      expect(
        () => HttpPortalRepository(api, PortalRole.client),
        throwsArgumentError,
      );
      api.close();
    },
  );

  test(
    'HTTP errors remain errors; failures never become empty successful results',
    () async {
      final tokens = MemoryTokens();
      await tokens.writeToken('test-token');
      final api = ApiClient(
        tokenStorage: tokens,
        httpClient: MockClient(
          (_) async => http.Response('{"error":"Acceso denegado"}', 403),
        ),
      );
      expect(
        HttpPortalRepository(api, PortalRole.receptionist).cases(),
        throwsA(
          isA<ApiException>().having(
            (error) => error.statusCode,
            'status',
            403,
          ),
        ),
      );
      api.close();
    },
  );
}
