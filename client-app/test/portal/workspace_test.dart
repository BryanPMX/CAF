import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:client_app/src/app_state.dart';
import 'package:client_app/src/portal/access.dart';
import 'package:client_app/src/portal/catalog_forms.dart';
import 'package:client_app/src/portal/models.dart';
import 'package:client_app/src/portal/record_editor.dart';
import 'package:client_app/src/portal/workspace_menu.dart';
import 'package:client_app/src/portal/workspace_repository.dart';
import 'fakes.dart';
import 'package:client_app/src/portal/session_refresh.dart';
import 'package:client_app/src/portal/availability_picker.dart';
import 'package:client_app/src/portal/calendar_screen.dart';
import 'package:client_app/src/portal/agenda.dart';
import 'package:client_app/src/portal/employee_shell.dart';
import 'package:provider/provider.dart';

void main() {
  HttpWorkspaceRepository repository(
    PortalRole role,
    Future<http.Response> Function(http.Request) handler,
  ) => HttpWorkspaceRepository(
    ApiClient(
      tokenStorage: MemoryTokens()..value = 'synthetic-token',
      httpClient: MockClient(handler),
    ),
    role,
  );
  test(
    'session-bound requests cannot switch to another account while reading credentials',
    () async {
      var current = true, calls = 0;
      final tokens = DeferredTokens();
      final api = ApiClient(
        tokenStorage: tokens,
        httpClient: MockClient((r) async {
          calls++;
          return http.Response('{}', 200);
        }),
      );
      final scoped = api.forSession(() => current);
      final request = scoped.post('/profile', body: {'avatarUrl': ''});
      final assertion = expectLater(
        request,
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 401)),
      );
      current = false;
      tokens.pending.complete('another-account-token');
      await assertion;
      expect(calls, 0);
      api.close();
    },
  );
  test(
    'late client notifications cannot overwrite another account after sign-out',
    () async {
      final started = Completer<void>(), old = Completer<http.Response>();
      var count = 0;
      final tokens = MemoryTokens()..value = 'first';
      final api = ApiClient(
        tokenStorage: tokens,
        httpClient: MockClient((request) async {
          if (request.url.path.endsWith('/logout')) {
            return http.Response('{}', 200);
          }
          if (count++ == 0) {
            started.complete();
            return old.future;
          }
          return http.Response(
            '{"notifications":[{"id":2,"message":"Second account"}],"unread_count":1}',
            200,
          );
        }),
      );
      final state = AppState(
        apiClient: api,
        tokenStorage: tokens,
        realtimeService: OfflineRealtime(),
      );
      final first = state.loadNotifications(silent: true);
      await started.future;
      final rejected = expectLater(first, throwsA(isA<ApiException>()));
      await state.logout();
      tokens.value = 'second';
      await state.loadNotifications(silent: true);
      old.complete(
        http.Response(
          '{"notifications":[{"id":1,"message":"First account"}]}',
          200,
        ),
      );
      await rejected;
      expect(state.notifications.single.id, 2);
      state.dispose();
    },
  );
  test('contractor editing preserves canonical account contact fields', () async {
    final repo = repository(
      PortalRole.administrator,
      (r) async => http.Response(
        '{"organization":{"id":7,"kind":"contractor","name":"Constructora"},"accountClient":{"email":"company@example.test","phone":"6561234567"}}',
        200,
      ),
    );
    final data = await repo.detail(WorkspaceResource.contractors, 7);
    final form = await CatalogForms(repo, actorId: 2, officeId: 1).build(
      WorkspaceResource.contractors,
      record: jsonObject(data['organization']),
    );
    expect(form.initial['email'], 'company@example.test');
    expect(form.initial['phone'], '6561234567');
  });
  test('rapid client case selection ignores late detail responses', () async {
    final old = Completer<http.Response>();
    final tokens = MemoryTokens()..value = 'synthetic';
    final api = ApiClient(
      tokenStorage: tokens,
      httpClient: MockClient(
        (request) async => request.url.path.endsWith('/1')
            ? old.future
            : http.Response('{"id":2,"title":"Caso actual"}', 200),
      ),
    );
    final state = AppState(
      apiClient: api,
      tokenStorage: tokens,
      realtimeService: OfflineRealtime(),
    );
    final first = state.selectCase(1);
    final second = state.selectCase(2);
    expect(state.selectedCaseDetail, isNull);
    await second;
    old.complete(http.Response('{"id":1,"title":"Caso anterior"}', 200));
    await first;
    expect(state.selectedCaseId, 2);
    expect(state.selectedCaseDetail!.summary.id, 2);
    state.dispose();
  });
  testWidgets('live refresh preserves the selected dashboard office', (
    tester,
  ) async {
    final scopes = <String?>[];
    final tokens = MemoryTokens()..value = 'synthetic';
    final api = ApiClient(
      tokenStorage: tokens,
      httpClient: MockClient((request) async {
        if (request.url.path.endsWith('/offices')) {
          return http.Response('[{"id":2,"name":"Oficina B"}]', 200);
        }
        if (request.url.path.endsWith('/dashboard-summary')) {
          scopes.add(request.url.queryParameters['officeId']);
          return http.Response(
            '{"totalCases":1,"openCases":1,"appointmentsToday":0,"pendingTasks":0}',
            200,
          );
        }
        return http.Response('{"data":[]}', 200);
      }),
    );
    final session = WorkspaceSession(api);
    await tester.pumpWidget(
      ChangeNotifierProvider<AppState>.value(
        value: session,
        child: MaterialApp(
          home: EmployeeAppShell(repository: FakePortalRepository()),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Todas las oficinas'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Seleccionar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Oficina B'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    expect(scopes.last, '2');
    session.bump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(scopes.last, '2');
    expect(find.text('Oficina seleccionada'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    session.dispose();
    api.close();
  });
  testWidgets(
    'calendar combines meetings and appointments with a narrow large-text layout',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(320, 844));
      final now = DateTime.now();
      final start = DateTime(now.year, now.month, now.day, 10);
      final repo = repository(
        PortalRole.administrator,
        (request) async => http.Response(
          jsonEncode({
            'data': [
              {
                'id': request.url.path.contains('/calendar') ? 1 : 2,
                'title': request.url.path.contains('/calendar')
                    ? 'Reunión'
                    : 'Cita',
                'startTime': start.toUtc().toIso8601String(),
                'endTime': start
                    .add(const Duration(hours: 1))
                    .toUtc()
                    .toIso8601String(),
              },
            ],
          }),
          200,
        ),
      );
      final session = RefreshSession();
      await tester.pumpWidget(
        ChangeNotifierProvider<AppState>.value(
          value: session,
          child: MaterialApp(
            home: MediaQuery(
              data: const MediaQueryData(textScaler: TextScaler.linear(2)),
              child: CalendarScreen(repository: repo),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(CalendarDatePicker), findsOneWidget);
      expect(find.text('Reunión'), findsOneWidget);
      expect(find.text('Cita'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      session.dispose();
      await tester.binding.setSurfaceSize(null);
    },
  );
  test(
    'agenda uses each API date contract and orders exact instants',
    () async {
      final from = DateTime.utc(2030, 1, 2), to = DateTime.utc(2030, 1, 3);
      final repo = repository(PortalRole.administrator, (request) async {
        final meeting = request.url.path.contains('/calendar');
        final query = request.url.queryParameters;
        expect(
          query['dateFrom'],
          meeting ? from.toIso8601String() : '2030-01-01',
        );
        expect(query['dateTo'], meeting ? to.toIso8601String() : '2030-01-04');
        return http.Response(
          jsonEncode({
            'data': meeting
                ? [
                    {
                      'id': 1,
                      'startTime': '2030-01-02T08:00:00-07:00',
                      'endTime': '2030-01-02T09:00:00-07:00',
                      'organizer': {'officeId': 2},
                    },
                  ]
                : [
                    {
                      'id': 2,
                      'startTime': '2030-01-02T14:00:00Z',
                      'endTime': '2030-01-02T15:00:00Z',
                      'officeId': 2,
                    },
                    {
                      'id': 3,
                      'startTime': '2030-01-03T00:00:00Z',
                      'endTime': '2030-01-03T01:00:00Z',
                      'officeId': 2,
                    },
                    {
                      'id': 4,
                      'startTime': '2030-01-02T10:00:00Z',
                      'endTime': '2030-01-02T11:00:00Z',
                      'officeId': 3,
                    },
                  ],
          }),
          200,
        );
      });
      final rows = await loadAgenda(repo, from, to, officeId: 2);
      expect(rows.map((r) => r['id']), [2, 1]);
      expect(rows.last['_meeting'], true);
      repo.api.close();
    },
  );
  test(
    'office administrators cannot request organization-wide metrics',
    () async {
      var calls = 0;
      final repo = repository(PortalRole.administrator, (r) async {
        calls++;
        return http.Response('{}', 200);
      });
      await expectLater(repo.metrics(), throwsA(isA<ApiException>()));
      expect(calls, 0);
    },
  );
  testWidgets(
    'availability disables busy slots and selects a free local interval with enlarged text',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(320, 844));
      var future = DateTime.now().add(const Duration(days: 2));
      while (future.weekday == DateTime.sunday) {
        future = future.add(const Duration(days: 1));
      }
      final start = DateTime(future.year, future.month, future.day, 9);
      final repo = repository(
        PortalRole.administrator,
        (request) async => http.Response(
          jsonEncode({
            'busy': [
              {
                'startTime': start.toUtc().toIso8601String(),
                'endTime': start
                    .add(const Duration(minutes: 30))
                    .toUtc()
                    .toIso8601String(),
              },
            ],
          }),
          200,
        ),
      );
      DateTime? chosen;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MediaQuery(
              data: const MediaQueryData(textScaler: TextScaler.linear(2)),
              child: ListView(
                children: [
                  AvailabilityPicker(
                    repository: repo,
                    staffId: 6,
                    value: start,
                    onSelect: (from, to) {
                      chosen = from;
                      expect(to.difference(from), const Duration(minutes: 30));
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final busy = find.ancestor(
        of: find.text('09:00 · Ocupado'),
        matching: find.byType(ChoiceChip),
      );
      expect(tester.widget<ChoiceChip>(busy).onSelected, isNull);
      await Scrollable.ensureVisible(
        tester.element(find.text('09:30')),
        alignment: 0.5,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('09:30'));
      expect(chosen, start.add(const Duration(minutes: 30)));
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      await tester.binding.setSurfaceSize(null);
    },
  );
  testWidgets(
    'changing a role clears dependent values in both the payload and visible input',
    (tester) async {
      final form = RecordForm(
        title: 'Editar Usuario',
        initial: const {'role': 'lawyer', 'specialty': 'Derecho familiar'},
        fields: const [
          RecordField(
            'role',
            'Rol',
            kind: InputKind.choice,
            choices: [
              FieldChoice('lawyer', 'Abogado/a'),
              FieldChoice('psychologist', 'Psicólogo/a'),
            ],
          ),
          RecordField('specialty', 'Especialidad'),
        ],
        onChange: (key, values) {
          if (key == 'role') values['specialty'] = '';
        },
        save: (v) async {},
      );
      await tester.pumpWidget(
        MaterialApp(home: RecordEditorScreen(form: form)),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Abogado/a'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Psicólogo/a'));
      await tester.pumpAndSettle();
      final field = find.byType(TextFormField);
      expect(tester.widget<TextFormField>(field).controller!.text, isEmpty);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'live invalidations debounce and stop when the screen is disposed',
    (tester) async {
      final session = RefreshSession();
      var calls = 0;
      final binding = EmployeeRefreshBinding(session, () => calls++);
      session.bump();
      session.bump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(calls, 1);
      binding.dispose();
      session.bump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(calls, 1);
      session.dispose();
    },
  );
  test('client case history reads every server page', () async {
    final pages = <String?>[];
    final tokens = MemoryTokens()..value = 'synthetic';
    final api = ApiClient(
      tokenStorage: tokens,
      httpClient: MockClient((request) async {
        final page = request.url.queryParameters['page'];
        pages.add(page);
        return http.Response(
          jsonEncode({
            'data': [
              {'id': page == '1' ? 1 : 2, 'title': 'Caso'},
            ],
            'pagination': {'total': 2},
          }),
          200,
        );
      }),
    );
    final state = AppState(
      apiClient: api,
      tokenStorage: tokens,
      realtimeService: OfflineRealtime(),
    );
    await state.loadCases();
    expect(state.cases.map((c) => c.id), [1, 2]);
    expect(pages, ['1', '2']);
    state.dispose();
  });
  test(
    'case management follows the primary professional and management roles',
    () {
      expect(canManageCase(PortalRole.lawyer, 6, {'primaryStaffId': 6}), true);
      expect(canManageCase(PortalRole.lawyer, 7, {'primaryStaffId': 6}), false);
      expect(
        canManageCase(PortalRole.administrator, 2, {'primaryStaffId': 6}),
        true,
      );
    },
  );
  test(
    'archive and notes adapters preserve pagination and broadcast restrictions',
    () async {
      final repo = repository(
        PortalRole.administrator,
        (r) async => http.Response(
          jsonEncode(
            r.url.path.endsWith('/notes')
                ? {
                    'userNotes': [
                      {'id': 1, 'bodyText': 'personal'},
                    ],
                    'adminNotes': [
                      {'id': 2, 'bodyText': 'organización'},
                    ],
                  }
                : {
                    'cases': [
                      {'id': 4},
                    ],
                    'pagination': {'total': 42},
                  },
          ),
          200,
        ),
      );
      final archived = await repo.list(
        WorkspaceResource.archivedCases,
        page: 2,
      );
      expect(archived.total, 42);
      expect(archived.items.single['id'], 4);
      final notes = await repo.list(WorkspaceResource.notes);
      expect(notes.items.length, 2);
      expect(notes.items.first['_broadcast'], true);
    },
  );
  test(
    'staff management and CMS actions are rejected before HTTP while announcements remain readable',
    () async {
      var calls = 0;
      final repo = repository(PortalRole.lawyer, (r) async {
        calls++;
        return http.Response('{"announcements":[]}', 200);
      });
      for (final resource in [
        WorkspaceResource.users,
        WorkspaceResource.factories,
        WorkspaceResource.siteContent,
        WorkspaceResource.archivedCases,
      ]) {
        await expectLater(repo.list(resource), throwsA(isA<ApiException>()));
      }
      await expectLater(
        repo.save(WorkspaceResource.announcements, {'title': 'x'}),
        throwsA(isA<ApiException>()),
      );
      expect(calls, 0);
      await repo.list(WorkspaceResource.announcements);
      expect(calls, 1);
    },
  );
  test(
    'role routing, client-case wrapper and mutation verbs match the API',
    () async {
      final requests = <http.Request>[];
      final repo = repository(PortalRole.lawyer, (r) async {
        requests.add(r);
        return http.Response(
          r.url.path.contains('cases-for') ? '{"cases":[{"id":7}]}' : '{}',
          200,
        );
      });
      expect((await repo.clientCases(9)).single['id'], 7);
      await repo.save(WorkspaceResource.appointments, {
        'title': 'actualizada',
      }, id: 4);
      await repo.save(WorkspaceResource.tasks, {'status': 'completed'}, id: 5);
      await repo.respond(2, 'accepted');
      expect(requests.map((r) => '${r.method} ${r.url.path}'), [
        'GET /api/v1/staff/clients/9/cases-for-appointment',
        'PUT /api/v1/staff/appointments/4',
        'PUT /api/v1/tasks/5',
        'PATCH /api/v1/calendar/events/2/response',
      ]);
      expect(jsonDecode(requests.last.body), {'responseStatus': 'accepted'});
    },
  );
  test(
    'malformed successful lists fail visibly instead of looking empty',
    () async {
      final repo = repository(
        PortalRole.administrator,
        (r) async => http.Response('{"unexpected":[]}', 200),
      );
      await expectLater(
        repo.list(WorkspaceResource.users),
        throwsA(isA<ApiException>()),
      );
    },
  );
  test(
    'user scope protects support, executives and shared company accounts',
    () {
      expect(
        canEditUser(PortalRole.administrator, 2, {
          'role': 'executive_director',
          'officeId': 2,
        }),
        false,
      );
      expect(
        canEditUser(PortalRole.executiveDirector, null, {
          'role': 'technical_support',
        }),
        false,
      );
      expect(
        canEditUser(PortalRole.administrator, 2, {
          'role': 'client',
          'officeId': null,
          'clientType': 'organization',
        }),
        true,
      );
      expect(
        canEditUser(PortalRole.administrator, 2, {
          'role': 'lawyer',
          'officeId': 3,
        }),
        false,
      );
    },
  );
  test(
    'user form omits blank passwords and preserves unchanged employment; only own reset invalidates session',
    () async {
      final bodies = <Json>[];
      var invalidations = 0;
      final repo = repository(PortalRole.technicalSupport, (r) async {
        if (r.method == 'PATCH') bodies.add(jsonObject(jsonDecode(r.body)));
        return http.Response(
          r.method == 'GET' ? '[{"id":2,"name":"Oficina"}]' : '{}',
          200,
        );
      });
      final forms = CatalogForms(
        repo,
        actorId: 1,
        ownPasswordChanged: () async {
          invalidations++;
        },
      );
      final form = await forms.build(
        WorkspaceResource.users,
        record: {'id': 1, 'role': 'technical_support', 'firstName': 'Soporte'},
      );
      await form.save({
        'firstName': 'Soporte',
        'role': 'technical_support',
        'password': '',
        'officeId': 2,
      });
      expect(bodies.single.containsKey('password'), false);
      expect(bodies.single.containsKey('officeId'), false);
      expect(invalidations, 0);
      await form.save({
        'firstName': 'Soporte',
        'role': 'technical_support',
        'password': 'Synthetic-Password123!',
      });
      expect(invalidations, 1);
    },
  );
  test(
    'calendar serializer preserves the local wall time and absolute instant',
    () {
      final value = DateTime(2027, 1, 4, 10, 30);
      final serialized = localApiTime(value.toUtc().toIso8601String());
      expect(DateTime.parse(serialized).isAtSameMomentAs(value), true);
      expect(serialized, contains('T10:30:00'));
      expect(serialized, contains(RegExp(r'[+-]\d\d:\d\d$')));
      expect(
        intervalError({
          'startTime': value.toIso8601String(),
          'endTime': value.subtract(const Duration(hours: 1)).toIso8601String(),
        }),
        isNotNull,
      );
    },
  );
  testWidgets(
    'shared editor retains line arrays and entered values after failed saves at large text sizes',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(320, 844));
      final form = RecordForm(
        title: 'Editar Servicio',
        initial: const {
          'title': 'Servicio CAF',
          'details': ['Primero', 'Segundo'],
        },
        fields: const [
          RecordField('title', 'Título', required: true),
          RecordField('details', 'Detalles', kind: InputKind.lines),
        ],
        save: (v) async {
          expect(v['details'], ['Primero', 'Segundo']);
          throw ApiException('No se guardó. Intente nuevamente.');
        },
      );
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(2)),
            child: RecordEditorScreen(form: form),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();
      expect(find.text('No se guardó. Intente nuevamente.'), findsOneWidget);
      expect(find.text('Servicio CAF'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      await tester.binding.setSurfaceSize(null);
    },
  );
  testWidgets(
    'employee menu exposes permitted destinations at enlarged text sizes',
    (tester) async {
      for (final role in [PortalRole.administrator, PortalRole.lawyer]) {
        final repo = repository(role, (r) async => http.Response('{}', 200));
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: MediaQuery(
                data: const MediaQueryData(textScaler: TextScaler.linear(2)),
                child: WorkspaceMenu(repository: repo),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(
          find.text('Usuarios'),
          role.isManagement ? findsOneWidget : findsNothing,
        );
        expect(find.text('Contenido'), findsNothing);
        expect(tester.takeException(), isNull);
      }
    },
  );
}

class DeferredTokens extends MemoryTokens {
  final pending = Completer<String?>();
  @override
  Future<String?> readToken() => pending.future;
}

class RefreshSession extends AppState {
  int revision = 0;
  @override
  int get employeeRevision => revision;
  @override
  bool get isAuthenticated => true;
  void bump() {
    revision++;
    notifyListeners();
  }
}

class WorkspaceSession extends RefreshSession {
  WorkspaceSession(this.client);
  final ApiClient client;
  @override
  PortalRole get role => PortalRole.technicalSupport;
  @override
  ApiClient get apiClient => client;
  @override
  AuthUser get authUser => AuthUser(
    id: 1,
    email: 'support@example.test',
    role: 'technical_support',
    firstName: 'Soporte',
    lastName: 'CAF',
  );
}
