import '../app_state.dart';
import 'access.dart';
import 'models.dart';

abstract interface class PortalRepository {
  Future<CasePage> cases({int page = 1, String query = '', String? status});
  Future<PortalCase> caseDetail(int id);
  Future<void> saveCase(Json payload, {int? id});
  Future<List<DirectoryOption>> clients(String query);
  Future<List<DirectoryOption>> offices();
  Future<List<DirectoryOption>> factories(String query, {int? id});
  Future<Employment> clientEmployment(int clientId);
  Future<Json> dashboard();
  Future<List<Json>> appointments();
  Future<List<Json>> notifications();
  Future<void> markRead(List<int> ids);
  Future<void> comment(int caseId, String text, String visibility);
}

/// All role-specific routing is confined to this API boundary. Server-side
/// checks enforce office/record access independently of the visible controls.
class HttpPortalRepository implements PortalRepository {
  HttpPortalRepository(this.api, this.role) {
    if (!role.isEmployee) throw ArgumentError('Se requiere un empleado.');
  }
  final ApiClient api;
  final PortalRole role;
  String get prefix => role.endpointPrefix;
  String _path(String path, Map<String, String?> query) => Uri(
    path: path,
    queryParameters: Map.fromEntries(
      query.entries.where(
        (entry) => entry.value != null && entry.value!.isNotEmpty,
      ),
    ),
  ).toString();

  @override
  Future<CasePage> cases({
    int page = 1,
    String query = '',
    String? status,
  }) async {
    final raw = jsonObject(
      await api.get(
        _path('$prefix/cases', {
          'page': '$page',
          'limit': '20',
          'search': query,
          'status': status,
        }),
      ),
    );
    if (raw['data'] is! List) {
      throw ApiException(
        'La respuesta de expedientes no es válida. Intente nuevamente.',
      );
    }
    final rows = jsonRows(
      raw['data'],
    ).map(PortalCase.new).toList(growable: false);
    return CasePage(
      rows,
      intValue(jsonObject(raw['pagination'])['total']) ??
          intValue(raw['total']) ??
          rows.length,
    );
  }

  @override
  Future<PortalCase> caseDetail(int id) async {
    final raw = jsonObject(await api.get('$prefix/cases/$id'));
    final record = PortalCase(
      raw['data'] is Map ? jsonObject(raw['data']) : raw,
    );
    if (record.id != id) {
      throw ApiException('El expediente recibido no es válido.');
    }
    return record;
  }

  @override
  Future<void> saveCase(Json payload, {int? id}) async {
    if (id == null) {
      await api.post('$prefix/cases', body: payload);
    } else {
      await api.put('$prefix/cases/$id', body: payload);
    }
  }

  @override
  Future<List<DirectoryOption>> clients(String query) async {
    final raw = jsonObject(
      await api.get(
        _path('/client-options', {'q': query, 'clientType': 'person'}),
      ),
    );
    return jsonRows(raw['data'])
        .map(DirectoryOption.fromJson)
        .where((item) => !item.company)
        .toList(growable: false);
  }

  @override
  Future<List<DirectoryOption>> offices() async {
    final raw = await api.get(
      role.isManagement ? '/admin/offices' : '/offices',
    );
    return jsonRows(
      raw is List ? raw : jsonObject(raw)['data'],
    ).map(DirectoryOption.fromJson).toList(growable: false);
  }

  @override
  Future<List<DirectoryOption>> factories(String query, {int? id}) async {
    final raw = jsonObject(
      await api.get(
        _path('/maquila-options', {'q': query, 'id': id?.toString()}),
      ),
    );
    return jsonRows(
      raw['data'],
    ).map(DirectoryOption.fromJson).toList(growable: false);
  }

  @override
  Future<Employment> clientEmployment(int clientId) async {
    final raw = jsonObject(await api.get('/client-organizations/$clientId'));
    final rows = jsonRows(raw['data']);
    final factory = rows
        .where((row) => jsonObject(row['organization'])['kind'] == 'maquila')
        .firstOrNull;
    return factory == null ? const Employment() : Employment.fromJson(factory);
  }

  @override
  Future<Json> dashboard() async {
    final raw = jsonObject(
      await api.get(
        role.isManagement ? '/dashboard-summary' : '/staff/dashboard-summary',
      ),
    );
    if (intValue(raw[role.isManagement ? 'totalCases' : 'myCases']) == null) {
      throw ApiException('No se pudieron verificar los indicadores del panel.');
    }
    return raw;
  }

  @override
  Future<List<Json>> appointments() async {
    final raw = jsonObject(
      await api.get(
        role.isManagement
            ? '/admin/appointments?pageSize=100'
            : '/staff/appointments/my?pageSize=100',
      ),
    );
    return jsonRows(raw['data']);
  }

  @override
  Future<List<Json>> notifications() async =>
      jsonRows(jsonObject(await api.get('/notifications'))['notifications']);
  @override
  Future<void> markRead(List<int> ids) async {
    await api.post('/notifications/mark-read', body: {'notificationIds': ids});
  }

  @override
  Future<void> comment(int caseId, String text, String visibility) async {
    await api.post(
      '/cases/$caseId/comments',
      body: {'comment': text.trim(), 'visibility': visibility},
    );
  }
}
