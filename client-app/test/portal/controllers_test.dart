import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:client_app/src/app_state.dart';
import 'package:client_app/src/portal/access.dart';
import 'package:client_app/src/portal/controllers.dart';
import 'package:client_app/src/portal/models.dart';
import 'fakes.dart';

void main() {
  test('late search responses cannot overwrite newer results', () async {
    final slow = Completer<CasePage>();
    final repository = FakePortalRepository()
      ..pageLoader = (page, query, status) async => query == 'old'
          ? await slow.future
          : CasePage([
              PortalCase(const {'id': 2}),
            ], 1);
    final controller = CaseListController(repository);
    final old = controller.load(search: 'old');
    await controller.load(search: 'new');
    slow.complete(
      CasePage([
        PortalCase(const {'id': 1}),
      ], 1),
    );
    await old;
    expect(controller.items.single.id, 2);
    controller.dispose();
  });

  test(
    'case pagination appends and exposes failures without discarding loaded pages',
    () async {
      final repository = FakePortalRepository()
        ..pageLoader = (page, _, __) async {
          if (page == 3) throw ApiException('Sin conexión');
          return CasePage([
            PortalCase({'id': page}),
          ], 3);
        };
      final controller = CaseListController(repository);
      await controller.load();
      await controller.load(reset: false);
      await controller.load(reset: false);
      expect(controller.items.map((item) => item.id), [1, 2]);
      expect(controller.error, 'Sin conexión');
      expect(controller.page, 2);
      controller.dispose();
    },
  );

  test(
    'client change clears old employment and ignores an in-flight result',
    () async {
      final slow = Completer<Employment>();
      final repository = FakePortalRepository()
        ..employmentLoader = (id) async =>
            id == 10 ? await slow.future : const Employment();
      final controller = CaseEditorController(
        repository: repository,
        role: PortalRole.administrator,
        actorOfficeId: 1,
      );
      final first = controller.selectClient(
        const DirectoryOption(id: 10, name: 'Uno'),
      );
      expect(controller.canSave, false);
      await controller.selectClient(const DirectoryOption(id: 11, name: 'Dos'));
      slow.complete(
        const Employment(
          maquilaId: 4,
          employeeNumber: '0001',
          shiftName: 'Primero',
        ),
      );
      await first;
      expect(controller.selectedClient!.id, 11);
      expect(controller.employment.maquilaId, isNull);
      controller.dispose();
    },
  );

  test('failed employment prevents saves until retry succeeds', () async {
    final repository = FakePortalRepository()
      ..employmentLoader = (_) async => throw ApiException('No disponible');
    final controller = CaseEditorController(
      repository: repository,
      role: PortalRole.administrator,
      actorOfficeId: 1,
    );
    await controller.selectClient(const DirectoryOption(id: 10, name: 'Uno'));
    expect(controller.canSave, false);
    expect(controller.employmentError, isNotNull);
    repository.employmentLoader = (_) async => const Employment();
    await controller.selectClient(controller.selectedClient!);
    expect(controller.canSave, true);
    controller.dispose();
  });

  test(
    'new client save sends snapshot, leading zeroes and office independently',
    () async {
      final repository = FakePortalRepository();
      final controller = CaseEditorController(
        repository: repository,
        role: PortalRole.administrator,
        actorOfficeId: 1,
      );
      await controller.loadOffices();
      expect(controller.offices.map((office) => office.id), [1]);
      controller.changeClientMode(true);
      final ok = await controller.save(
        title: 'Divorcios',
        category: 'Familiar',
        description: 'Apoyo',
        currentEmployment: const Employment(
          maquilaId: 5,
          employeeNumber: '0001',
          shiftName: 'Tercero',
          shiftStart: '22:00',
          shiftEnd: '06:00',
        ),
        firstName: 'María',
        lastName: 'García',
        email: 'maria@example.test',
        fee: '250',
      );
      expect(ok, true);
      expect(repository.saved!['officeId'], 1);
      expect(repository.saved!['fee'], 250);
      expect(repository.saved!['employment']['employeeNumber'], '0001');
      expect(repository.saved!.containsKey('clientId'), false);
      controller.dispose();
    },
  );

  test(
    'metadata edits omit employment; explicit unlink clears only the case snapshot',
    () async {
      final repository = FakePortalRepository();
      final record = PortalCase(const {
        'id': 8,
        'officeId': 1,
        'maquilaId': 5,
        'employeeNumber': '0001',
        'shiftName': 'Primero',
      });
      final controller = CaseEditorController(
        repository: repository,
        role: PortalRole.lawyer,
        actorOfficeId: 1,
        initial: record,
      );
      await controller.save(
        title: 'Cambio',
        category: 'Familiar',
        description: 'Apoyo',
        currentEmployment: record.employment,
      );
      expect(repository.saved!.containsKey('employment'), false);
      expect(repository.saved!.containsKey('officeId'), false);
      expect(repository.updatedId, 8);
      await controller.save(
        title: 'Cambio',
        category: 'Familiar',
        description: 'Apoyo',
        currentEmployment: const Employment(),
        firstName: 'Persona',
        lastName: 'Prueba',
        email: 'persona@example.test',
      );
      expect(repository.saved!['employment']['maquilaId'], isNull);
      controller.dispose();
    },
  );

  test('save failures remain actionable and do not report success', () async {
    final repository = FakePortalRepository()..failSave = true;
    final controller = CaseEditorController(
      repository: repository,
      role: PortalRole.executiveDirector,
    );
    controller.changeClientMode(true);
    controller.officeId = 2;
    final ok = await controller.save(
      title: 'Divorcios',
      category: 'Familiar',
      description: 'Apoyo',
      currentEmployment: const Employment(),
      firstName: 'Persona',
      lastName: 'Prueba',
      email: 'persona@example.test',
    );
    expect(ok, false);
    expect(controller.saving, false);
    expect(controller.saveError, contains('Intente nuevamente'));
    controller.dispose();
  });
}
