import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:client_app/src/app_state.dart';
import 'package:client_app/src/portal/access.dart';
import 'package:client_app/src/portal/case_editor.dart';
import 'package:client_app/src/portal/employee_shell.dart';
import 'fakes.dart';

void main() {
  testWidgets('case form is usable at phone/tablet sizes and enlarged text', (
    tester,
  ) async {
    for (final scenario in [
      (320.0, 1.0),
      (390.0, 1.0),
      (768.0, 1.0),
      (390.0, 2.0),
    ]) {
      await tester.binding.setSurfaceSize(Size(scenario.$1, 844));
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(
              size: Size(scenario.$1, 844),
              textScaler: TextScaler.linear(scenario.$2),
            ),
            child: CaseEditorScreen(
              key: ValueKey(scenario),
              repository: FakePortalRepository(),
              role: PortalRole.administrator,
              officeId: 1,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Crear Nuevo Caso'), findsOneWidget);
      expect(find.text('Crear Caso'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Cliente Nuevo'));
      await tester.pumpAndSettle();
      expect(find.text('Nombre(s) *'), findsOneWidget);
      expect(tester.takeException(), isNull);
    }
    await tester.pumpWidget(const SizedBox());
    await tester.binding.setSurfaceSize(null);
  });

  testWidgets('save action stays above the keyboard', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(
            size: Size(390, 844),
            viewInsets: EdgeInsets.only(bottom: 300),
          ),
          child: CaseEditorScreen(
            repository: FakePortalRepository(),
            role: PortalRole.administrator,
            officeId: 1,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      tester.getRect(find.text('Crear Caso')).bottom,
      lessThanOrEqualTo(544),
    );
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    await tester.binding.setSurfaceSize(null);
  });

  testWidgets(
    'unchanged forms close directly; changed forms confirm before discard',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => CaseEditorScreen(
                      repository: FakePortalRepository(),
                      role: PortalRole.administrator,
                      officeId: 1,
                    ),
                  ),
                ),
                child: const Text('Abrir formulario'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Abrir formulario'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Volver'));
      await tester.pumpAndSettle();
      expect(find.text('¿Descartar los cambios?'), findsNothing);
      expect(find.text('Abrir formulario'), findsOneWidget);
      await tester.tap(find.text('Abrir formulario'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cliente Nuevo'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Volver'));
      await tester.pumpAndSettle();
      expect(find.text('¿Descartar los cambios?'), findsOneWidget);
      await tester.tap(find.text('Seguir editando'));
      await tester.pumpAndSettle();
      expect(find.text('Nombre(s) *'), findsOneWidget);
      await tester.tap(find.byTooltip('Volver'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Descartar'));
      await tester.pumpAndSettle();
      expect(find.text('Abrir formulario'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'case validation shows required errors and retains typed values',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      await tester.pumpWidget(
        MaterialApp(
          home: CaseEditorScreen(
            repository: FakePortalRepository(),
            role: PortalRole.administrator,
            officeId: 1,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cliente Nuevo'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Crear Caso'));
      await tester.pumpAndSettle();
      expect(find.text('Este campo es obligatorio.'), findsWidgets);
      expect(find.text('Crear Nuevo Caso'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      await tester.binding.setSurfaceSize(null);
    },
  );

  testWidgets('employee workspace adapts phone and tablet navigation', (
    tester,
  ) async {
    final tokens = MemoryTokens();
    final api = ApiClient(
      tokenStorage: tokens,
      httpClient: MockClient(
        (request) async => http.Response(
          jsonEncode(
            request.url.path.endsWith('/login')
                ? {
                    'token': 'test',
                    'user': {'id': 1, 'role': 'technical_support'},
                  }
                : {
                    'userID': '1',
                    'role': 'technical_support',
                    'firstName': 'Soporte',
                    'lastName': 'CAF',
                  },
          ),
          200,
        ),
      ),
    );
    final session = AppState(
      apiClient: api,
      tokenStorage: tokens,
      realtimeService: OfflineRealtime(),
    );
    await session.login('support@example.test', 'test-only');
    for (final width in [390.0, 1024.0]) {
      await tester.binding.setSurfaceSize(Size(width, 900));
      await tester.pumpWidget(
        ChangeNotifierProvider.value(
          value: session,
          child: MaterialApp(
            home: EmployeeAppShell(
              key: ValueKey(width),
              repository: FakePortalRepository(),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Bienvenido, Soporte CAF'), findsOneWidget);
      expect(find.text('Usuarios'), findsNothing);
      expect(find.text('Sitio Web'), findsNothing);
      if (width < 840) {
        expect(find.byType(NavigationBar), findsOneWidget);
      } else {
        expect(find.byType(NavigationBar), findsNothing);
      }
      expect(tester.takeException(), isNull);
    }
    await tester.pumpWidget(const SizedBox());
    session.dispose();
    await tester.binding.setSurfaceSize(null);
  });
}
