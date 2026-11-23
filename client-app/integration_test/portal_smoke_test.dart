// Run only with CAF_API_BASE_URL pointing at the documented synthetic preview.
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:client_app/main.dart' as app;
import 'package:client_app/src/app_state.dart';
import 'package:client_app/src/portal/models.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  tearDownAll(() => TokenStorage().clear());
  setUpAll(() {
    final api = Uri.parse(AppConfig.apiBaseUrl);
    final websocket = AppConfig.websocketUri();
    const syntheticHosts = {'127.0.0.1', 'localhost', '10.0.2.2'};
    if (api.scheme != 'http' ||
        !syntheticHosts.contains(api.host) ||
        api.port != 8080 ||
        api.path != '/api/v1' ||
        websocket.scheme != 'ws' ||
        !syntheticHosts.contains(websocket.host) ||
        websocket.port != 8080) {
      throw StateError(
        'Native E2E requires the documented local synthetic API.',
      );
    }
  });

  Future<void> reveal(WidgetTester tester, Finder finder) async {
    await Scrollable.ensureVisible(tester.element(finder), alignment: 0.5);
    await tester.pumpAndSettle();
  }

  Future<void> selectField(WidgetTester tester, String label) async {
    final finder = find
        .ancestor(
          of: find.text(label),
          matching: find.byWidgetPredicate((widget) => widget is FormField),
        )
        .first;
    await reveal(tester, finder);
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  Future<void> capture(String name) async {
    if (defaultTargetPlatform == TargetPlatform.android) return;
    await binding.takeScreenshot(name);
  }

  Future<void> waitFor(WidgetTester tester, Finder finder) async {
    final deadline = DateTime.now().add(const Duration(seconds: 30));
    while (finder.evaluate().isEmpty && DateTime.now().isBefore(deadline)) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(finder, findsWidgets);
    await tester.pumpAndSettle();
  }

  Future<void> field(WidgetTester tester, String label, String value) async {
    final finder = find.ancestor(
      of: find.text(label),
      matching: find.byType(TextFormField),
    );
    await reveal(tester, finder);
    await tester.enterText(finder, value);
    await tester.pumpAndSettle();
  }

  Future<void> signIn(WidgetTester tester, String email) async {
    await waitFor(tester, find.text('Entrar'));
    final inputs = find.byType(TextFormField);
    await tester.enterText(inputs.at(0), email);
    await tester.enterText(inputs.at(1), 'Synthetic-E2E-Password123!');
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Entrar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Entrar'));
    await waitFor(tester, find.textContaining('Bienvenido,'));
  }

  testWidgets(
    'office administrator creates and edits a case through the mobile app',
    (tester) async {
      await TokenStorage().clear();
      app.main();
      await signIn(tester, 'a@example.test');
      final api = ApiClient();
      final factory = await api.post(
        '/organizations',
        body: {
          'kind': 'maquila',
          'name': 'Maquila Móvil ${DateTime.now().millisecondsSinceEpoch}',
        },
      );
      api.close();
      await capture('dashboard');
      await reveal(tester, find.text('Crear Caso'));
      await tester.tap(find.text('Crear Caso'));
      await waitFor(tester, find.text('Crear Nuevo Caso'));
      await capture('case-form');
      await tester.tap(find.text('Cliente Nuevo'));
      await tester.pumpAndSettle();
      final suffix = DateTime.now().millisecondsSinceEpoch;
      await field(tester, 'Nombre(s) *', 'Persona');
      await field(tester, 'Apellidos *', 'Móvil $suffix');
      await field(
        tester,
        'Correo Electrónico *',
        'mobile-$suffix@example.test',
      );
      await reveal(tester, find.text('Seleccionar maquila'));
      await tester.tap(find.text('Seleccionar maquila'));
      await waitFor(tester, find.text('Buscar por nombre o correo'));
      await tester.enterText(
        find.ancestor(
          of: find.text('Buscar por nombre o correo'),
          matching: find.byType(TextField),
        ),
        '${factory['name']}',
      );
      await waitFor(
        tester,
        find.text('${factory['name']} · #${factory['id']}'),
      );
      await tester.tap(find.text('${factory['name']} · #${factory['id']}'));
      await tester.pumpAndSettle();
      await field(tester, 'Número de Empleado *', '000042');
      await field(tester, 'Turno *', 'Tercer turno');
      await field(tester, 'Inicio del turno', '22:00');
      await field(tester, 'Fin del turno', '06:00');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();
      await reveal(tester, find.text('Datos de maquila'));
      await tester.pumpAndSettle();
      await capture('case-employment');
      final caseType = find.text('Tipo de Caso *');
      await reveal(tester, caseType);
      await tester.tap(caseType);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Divorcios').last);
      await tester.pumpAndSettle();
      await field(
        tester,
        'Descripción Inicial *',
        'Expediente sintético creado desde Flutter.',
      );
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Crear Caso'));
      await waitFor(tester, find.text('Gestión de Casos'));
      await tester.tap(find.text('Divorcios').first);
      await waitFor(tester, find.text('Datos del caso'));
      expect(
        find.text('Expediente sintético creado desde Flutter.'),
        findsOneWidget,
      );
      await tester.tap(find.byTooltip('Editar Caso'));
      await waitFor(tester, find.text('Editar Caso'));
      await field(
        tester,
        'Descripción Inicial *',
        'Descripción actualizada desde el móvil.',
      );
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Guardar Cambios'));
      await waitFor(
        tester,
        find.text('Descripción actualizada desde el móvil.'),
      );
      expect(find.text('000042'), findsOneWidget);
      await capture('case-detail');
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      await tester.pumpAndSettle();
    },
  );
  testWidgets(
    'staff workspace and existing client experience remain separated',
    (tester) async {
      await TokenStorage().clear();
      app.main();
      await signIn(tester, 'lawyer@example.test');
      await capture('staff-dashboard');
      await tester.tap(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.text('Expedientes'),
        ),
      );
      await waitFor(tester, find.text('Gestión de Casos'));
      expect(find.text('Usuarios'), findsNothing);
      expect(find.text('Sitio Web'), findsNothing);
      await tester.tap(find.byTooltip('Cerrar sesión'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cerrar sesión'));
      await waitFor(tester, find.text('Entrar'));
      final inputs = find.byType(TextFormField);
      await tester.enterText(inputs.at(0), 'client@example.test');
      await tester.enterText(inputs.at(1), 'Synthetic-E2E-Password123!');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Entrar'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Entrar'));
      await waitFor(tester, find.text('Inicio'));
      expect(find.text('Crear Caso'), findsNothing);
      await tester.tap(find.byIcon(Icons.menu));
      await tester.pumpAndSettle();
      expect(find.text('Mi Caso'), findsOneWidget);
      expect(find.text('Pagos'), findsWidgets);
      expect(find.text('Usuarios'), findsNothing);
      await capture('client-menu');
      await tester.pumpWidget(const SizedBox());
      await tester.pumpAndSettle();
    },
  );
  Future<void> more(WidgetTester tester) async {
    await tester.tap(
      find.descendant(
        of: find.byType(NavigationBar),
        matching: find.text('Más'),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
    'administrator manages users and case tasks from native screens',
    (tester) async {
      await TokenStorage().clear();
      app.main();
      await signIn(tester, 'a@example.test');
      final suffix = DateTime.now().millisecondsSinceEpoch;
      await more(tester);
      await reveal(tester, find.text('Usuarios'));
      await tester.tap(find.text('Usuarios'));
      await waitFor(tester, find.text('Crear'));
      await tester.tap(find.text('Crear'));
      await waitFor(tester, find.text('Crear Usuario'));
      await field(tester, 'Nombre(s) *', 'Móvil');
      await field(tester, 'Apellidos *', 'Prueba $suffix');
      await field(
        tester,
        'Correo Electrónico *',
        'native-$suffix@example.test',
      );
      await field(tester, 'Teléfono *', '6561234567');
      await field(tester, 'Contraseña inicial *', 'Native-Test-Password123!');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Guardar'));
      await waitFor(tester, find.text('Móvil Prueba $suffix'));
      await tester.tap(find.text('Móvil Prueba $suffix'));
      await waitFor(tester, find.text('Información'));
      await tester.tap(find.byTooltip('Editar'));
      await waitFor(tester, find.text('Editar Usuario'));
      await field(tester, 'Teléfono *', '6567654321');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Guardar'));
      await waitFor(tester, find.text('Móvil Prueba $suffix'));
      await tester.tap(find.text('Móvil Prueba $suffix'));
      await waitFor(tester, find.text('6567654321'));
      await capture('user-detail');
      await reveal(tester, find.text('Eliminar'));
      await tester.tap(find.text('Eliminar'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Eliminar').last);
      await waitFor(tester, find.text('Crear'));
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      final api = ApiClient();
      final created = jsonObject(
        await api.post(
          '/admin/cases',
          body: {
            'title': 'Caso móvil tareas $suffix',
            'category': 'Familiar',
            'description': 'Expediente sintético para tareas',
            'officeId': 1,
            'clientId': 10,
          },
        ),
      );
      expect(jsonObject(created['data'])['id'], isNotNull);
      await reveal(tester, find.text('Tareas'));
      await tester.tap(find.text('Tareas'));
      await waitFor(tester, find.text('Crear'));
      await tester.tap(find.text('Crear'));
      await waitFor(tester, find.text('Crear Tarea'));
      await selectField(tester, 'Expediente *');
      await waitFor(tester, find.text('Caso móvil tareas $suffix'));
      await tester.tap(find.text('Caso móvil tareas $suffix'));
      await tester.pumpAndSettle();
      await field(tester, 'Título *', 'Tarea móvil $suffix');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Guardar'));
      await waitFor(tester, find.text('Tarea móvil $suffix'));
      await tester.tap(find.text('Tarea móvil $suffix'));
      await waitFor(tester, find.text('Información'));
      await tester.tap(find.byTooltip('Editar'));
      await waitFor(tester, find.text('Editar Tarea'));
      await selectField(tester, 'Estado *');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Completada'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Guardar'));
      await waitFor(tester, find.text('Tarea móvil $suffix'));
      final tasks = jsonRows(await api.get('/tasks'));
      expect(
        tasks.singleWhere(
          (row) => row['title'] == 'Tarea móvil $suffix',
        )['status'],
        'completed',
      );
      api.close();
      await capture('task-list');
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      await tester.pumpAndSettle();
    },
  );
  testWidgets(
    'administrator edits meetings and appointments with preserved local times',
    (tester) async {
      await TokenStorage().clear();
      app.main();
      await signIn(tester, 'a@example.test');
      final api = ApiClient();
      final suffix = DateTime.now().millisecondsSinceEpoch;
      var day = DateTime.now().add(const Duration(days: 1));
      while (day.weekday == DateTime.sunday) {
        day = day.add(const Duration(days: 1));
      }
      final start = DateTime(day.year, day.month, day.day, 10);
      final meeting = jsonObject(
        await api.post(
          '/calendar/events',
          body: {
            'title': 'Reunión móvil $suffix',
            'description': 'Reunión sintética',
            'startTime': localApiTime(start.toIso8601String()),
            'endTime': localApiTime(
              start.add(const Duration(minutes: 30)).toIso8601String(),
            ),
            'attendeeIds': [6],
            'relatedClientIds': [],
          },
        ),
      );
      expect(meeting['id'], isNotNull);
      await more(tester);
      await tester.tap(find.text('Calendario'));
      await waitFor(tester, find.text('Reunión móvil $suffix'));
      await reveal(tester, find.text('Reunión móvil $suffix'));
      await tester.tap(find.text('Reunión móvil $suffix'));
      await waitFor(tester, find.text('Información'));
      await tester.tap(find.byTooltip('Editar'));
      await waitFor(tester, find.text('Editar Reunión'));
      await field(tester, 'Título *', 'Reunión actualizada $suffix');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Guardar'));
      await waitFor(tester, find.text('Reunión actualizada $suffix'));
      await capture('calendar');
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      final appointment = jsonObject(
        await api.post(
          '/admin/appointments',
          body: {
            'title': 'Cita móvil $suffix',
            'clientId': 10,
            'newCase': {
              'title': 'Divorcios',
              'description': 'Cita sintética',
              'officeId': 1,
            },
            'staffId': 6,
            'startTime': localApiTime(
              start.add(const Duration(hours: 1)).toIso8601String(),
            ),
            'endTime': localApiTime(
              start
                  .add(const Duration(hours: 1, minutes: 30))
                  .toIso8601String(),
            ),
            'category': 'Familiar',
            'department': 'Familiar',
            'status': 'pending',
          },
        ),
      );
      final appointmentId = intValue(
        jsonObject(appointment['data'])['id'] ??
            appointment['id'] ??
            jsonObject(appointment['appointment'])['id'],
      );
      expect(appointmentId, isNotNull);
      await tester.tap(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.text('Citas'),
        ),
      );
      await waitFor(tester, find.text('Cita móvil $suffix'));
      await tester.tap(find.text('Cita móvil $suffix'));
      await waitFor(tester, find.text('Información'));
      await tester.tap(find.byTooltip('Editar'));
      await waitFor(tester, find.text('Editar Cita'));
      await field(tester, 'Título *', 'Cita actualizada $suffix');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Guardar'));
      await waitFor(tester, find.text('Cita actualizada $suffix'));
      final savedRaw = jsonObject(
        await api.get('/admin/appointments/$appointmentId'),
      );
      final saved = jsonObject(savedRaw['appointment'] ?? savedRaw);
      expect(saved['title'], 'Cita actualizada $suffix');
      expect(
        DateTime.parse(
          saved['startTime'],
        ).isAtSameMomentAs(start.add(const Duration(hours: 1))),
        true,
      );
      await api.delete('/calendar/events/${meeting['id']}');
      await api.delete('/admin/appointments/$appointmentId');
      api.close();
      await capture('appointments');
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      await tester.pumpAndSettle();
    },
  );
}
