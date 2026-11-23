import 'package:client_app/src/app_state.dart';
import 'package:client_app/src/portal/models.dart';
import 'package:client_app/src/portal/repository.dart';

class MemoryTokens extends TokenStorage {
  String? value;
  @override
  Future<String?> readToken() async => value;
  @override
  Future<void> writeToken(String token) async {
    value = token;
  }

  @override
  Future<void> clear() async {
    value = null;
  }
}

class OfflineRealtime extends RealtimeService {
  OfflineRealtime()
    : super(onNotificationMessage: (_) {}, onConnectionChanged: (_) {});
  @override
  void connect(String token) {}
}

class FakePortalRepository implements PortalRepository {
  Json? saved;
  int? updatedId;
  List<DirectoryOption> availableOffices = const [
    DirectoryOption(id: 1, name: 'Oficina Central'),
    DirectoryOption(id: 2, name: 'Oficina Norte'),
  ];
  Future<Employment> Function(int)? employmentLoader;
  Future<CasePage> Function(int, String, String?)? pageLoader;
  bool failSave = false;
  @override
  Future<CasePage> cases({
    int page = 1,
    String query = '',
    String? status,
  }) async => pageLoader != null
      ? await pageLoader!(page, query, status)
      : CasePage([
          PortalCase(const {
            'id': 1,
            'title': 'Divorcios',
            'status': 'open',
            'category': 'Familiar',
            'officeId': 1,
            'office': {'name': 'Oficina Central'},
            'client': {'firstName': 'María', 'lastName': 'García'},
          }),
        ], 1);
  @override
  Future<PortalCase> caseDetail(int id) async => PortalCase({
    'id': id,
    'title': 'Divorcios',
    'description': 'Apoyo familiar',
    'category': 'Familiar',
    'officeId': 1,
    'clientId': 10,
    'status': 'open',
  });
  @override
  Future<void> saveCase(Json payload, {int? id}) async {
    if (failSave) throw ApiException('No se pudo guardar. Intente nuevamente.');
    saved = payload;
    updatedId = id;
  }

  @override
  Future<List<DirectoryOption>> clients(String query) async => const [
    DirectoryOption(
      id: 10,
      name: 'María García',
      email: 'maria@example.test',
      officeId: 1,
    ),
  ];
  @override
  Future<List<DirectoryOption>> offices() async => availableOffices;
  @override
  Future<List<DirectoryOption>> factories(String query, {int? id}) async =>
      const [DirectoryOption(id: 5, name: 'Maquila Frontera')];
  @override
  Future<Employment> clientEmployment(int clientId) async =>
      employmentLoader != null
      ? await employmentLoader!(clientId)
      : const Employment();
  @override
  Future<Json> dashboard() async => {
    'totalCases': 12,
    'openCases': 8,
    'appointmentsToday': 3,
    'pendingTasks': 4,
    'myCases': 5,
    'myOpenCases': 2,
    'myAppointmentsToday': 1,
    'myPendingTasks': 3,
  };
  @override
  Future<List<Json>> appointments() async => [
    {
      'id': 1,
      'title': 'Consulta inicial',
      'startTime': '2030-01-07T15:00:00Z',
      'status': 'confirmed',
    },
  ];
  @override
  Future<List<Json>> notifications() async => [];
  @override
  Future<void> markRead(List<int> ids) async {}
  @override
  Future<void> comment(int caseId, String text, String visibility) async {}
}
