import 'dart:typed_data';
import '../app_state.dart';
import 'access.dart';
import 'models.dart';

enum WorkspaceResource {
  users,
  offices,
  factories,
  contractors,
  appointments,
  meetings,
  tasks,
  notes,
  announcements,
  siteContent,
  siteServices,
  siteEvents,
  siteImages,
  archivedCases,
  archivedAppointments,
}

class RecordPage {
  const RecordPage(this.items, this.total);
  final List<Json> items;
  final int total;
}

abstract interface class WorkspaceRepository {
  PortalRole get role;
  Future<RecordPage> list(
    WorkspaceResource resource, {
    int page = 1,
    String query = '',
    Json filters = const {},
  });
  Future<Json> detail(
    WorkspaceResource resource,
    int id, {
    Json filters = const {},
  });
  Future<void> save(WorkspaceResource resource, Json data, {int? id});
  Future<void> delete(
    WorkspaceResource resource,
    int id, {
    bool permanent = false,
  });
  Future<void> restore(WorkspaceResource resource, int id);
  Future<List<Json>> employees();
  Future<List<Json>> clients({String query = '', bool companies = false});
  Future<List<Json>> clientCases(int clientId);
  Future<List<Json>> caseOptions(String query);
  Future<List<Json>> availability(int staffId, DateTime from, DateTime to);
  Future<void> respond(int eventId, String response);
  Future<void> caseAction(int id, String action, Json payload);
  Future<void> updateEvent(int id, bool document, Json payload);
  Future<void> deleteEvent(int id, bool document);
  Future<Json> taskDetail(int id);
  Future<void> taskComment(
    int id,
    String comment, {
    int? commentId,
    bool remove = false,
  });
  Future<void> linkClient(int organizationId, Json data, {int? removeClientId});
  Future<Json> profile();
  Future<ApiBinaryResponse> avatarImage();
  Future<Json> uploadSiteImage(Uint8List bytes, String filename);
  Future<void> avatar({Uint8List? bytes, String? filename, String? url});
  Future<void> uploadDocument(
    int caseId,
    Uint8List bytes,
    String filename,
    String visibility,
  );
  Future<ApiBinaryResponse> document(int id);
  Future<Json> report(Json filters, String type);
  Future<ApiBinaryResponse> exportReport(Json filters, String type);
  Future<Json> dashboard(Json filters);
  Future<Json> metrics();
  Future<void> dismissAnnouncement(int id);
}

class HttpWorkspaceRepository implements WorkspaceRepository {
  HttpWorkspaceRepository(this.api, this.role);
  final ApiClient api;
  @override
  final PortalRole role;
  String get _prefix => role.endpointPrefix;
  String _path(WorkspaceResource resource) => switch (resource) {
    WorkspaceResource.users => '$_prefix/users',
    WorkspaceResource.offices =>
      role.isManagement ? '/admin/offices' : '/offices',
    WorkspaceResource.factories ||
    WorkspaceResource.contractors => '/organizations',
    WorkspaceResource.appointments => '$_prefix/appointments',
    WorkspaceResource.meetings => '/calendar/events',
    WorkspaceResource.tasks => '/tasks',
    WorkspaceResource.notes => '/notes',
    WorkspaceResource.announcements => '/admin/announcements',
    WorkspaceResource.siteContent => '/admin/site-content',
    WorkspaceResource.siteServices => '/admin/site-services',
    WorkspaceResource.siteEvents => '/admin/site-events',
    WorkspaceResource.siteImages => '/admin/site-images',
    WorkspaceResource.archivedCases => '/admin/records/cases',
    WorkspaceResource.archivedAppointments => '/admin/records/appointments',
  };
  void _require(WorkspaceResource resource, {bool mutation = false}) {
    if (!role.isEmployee) {
      throw ApiException(
        'Esta función es exclusiva del personal.',
        statusCode: 403,
      );
    }
    final management = {
      WorkspaceResource.users,
      WorkspaceResource.offices,
      WorkspaceResource.factories,
      WorkspaceResource.contractors,
      WorkspaceResource.archivedCases,
      WorkspaceResource.archivedAppointments,
    };
    final website = {
      WorkspaceResource.siteContent,
      WorkspaceResource.siteServices,
      WorkspaceResource.siteEvents,
      WorkspaceResource.siteImages,
      WorkspaceResource.announcements,
    };
    if (management.contains(resource) &&
            !role.isManagement &&
            !(resource == WorkspaceResource.offices && !mutation) ||
        website.contains(resource) &&
            !role.canManageWebsite &&
            !(resource == WorkspaceResource.announcements && !mutation)) {
      throw ApiException(
        'No tiene permiso para esta función.',
        statusCode: 403,
      );
    }
  }

  String queryPath(String path, Json values) => Uri(
    path: path,
    queryParameters: {
      for (final e in values.entries)
        if (e.value != null && '${e.value}'.isNotEmpty) e.key: '${e.value}',
    },
  ).toString();
  List<Json> _rows(dynamic value) {
    if (value is! List) {
      throw ApiException(
        'La respuesta del servidor no es válida. Intente nuevamente.',
      );
    }
    return jsonRows(value);
  }

  @override
  Future<RecordPage> list(
    WorkspaceResource resource, {
    int page = 1,
    String query = '',
    Json filters = const {},
  }) async {
    _require(resource);
    var path = _path(resource);
    if (resource == WorkspaceResource.notes) path = '/dashboard/notes';
    if (resource == WorkspaceResource.announcements) {
      path = '/dashboard/announcements';
    }
    final raw = await api.get(
      queryPath(path, {
        'page': page,
        'limit': 20,
        'pageSize': 20,
        if (query.isNotEmpty) ...{'search': query, 'q': query},
        if (resource == WorkspaceResource.factories) 'kind': 'maquila',
        if (resource == WorkspaceResource.contractors) 'kind': 'contractor',
        ...filters,
      }),
    );
    final map = jsonObject(raw);
    final key = switch (resource) {
      WorkspaceResource.notes => 'userNotes',
      WorkspaceResource.announcements => 'announcements',
      WorkspaceResource.siteContent => 'content',
      WorkspaceResource.siteServices => 'services',
      WorkspaceResource.siteEvents => 'events',
      WorkspaceResource.siteImages => 'images',
      WorkspaceResource.archivedCases => 'cases',
      WorkspaceResource.archivedAppointments => 'appointments',
      _ => 'data',
    };
    final rows = [..._rows(raw is List ? raw : map[key])];
    if (resource == WorkspaceResource.notes) {
      rows.insertAll(
        0,
        jsonRows(map['adminNotes']).map((r) => {...r, '_broadcast': true}),
      );
    }
    return RecordPage(
      rows,
      intValue(jsonObject(map['pagination'])['total']) ??
          intValue(map['total']) ??
          rows.length,
    );
  }

  @override
  Future<Json> detail(
    WorkspaceResource resource,
    int id, {
    Json filters = const {},
  }) async {
    _require(resource);
    final raw = jsonObject(
      await api.get(
        queryPath(
          '${_path(resource)}/$id${resource == WorkspaceResource.offices ? '/detail' : ''}',
          filters,
        ),
      ),
    );
    if (resource == WorkspaceResource.contractors &&
        raw['organization'] is Map &&
        raw['accountClient'] is Map) {
      final account = jsonObject(raw['accountClient']);
      raw['organization'] = {
        ...jsonObject(raw['organization']),
        'email': account['email'],
        'phone': account['phone'],
      };
    }
    return raw;
  }

  @override
  Future<void> save(WorkspaceResource resource, Json data, {int? id}) async {
    _require(resource, mutation: true);
    if (id == null || resource == WorkspaceResource.siteContent) {
      await api.post(_path(resource), body: data);
    } else if (resource == WorkspaceResource.tasks) {
      await api.put('${_path(resource)}/$id', body: data);
    } else if (resource == WorkspaceResource.appointments &&
        !role.isManagement) {
      await api.put('${_path(resource)}/$id', body: data);
    } else {
      await api.patch('${_path(resource)}/$id', body: data);
    }
  }

  @override
  Future<void> delete(
    WorkspaceResource resource,
    int id, {
    bool permanent = false,
  }) async {
    _require(resource, mutation: true);
    if (resource == WorkspaceResource.offices && !role.allOffices) {
      throw ApiException('Solo puede editar su oficina.', statusCode: 403);
    }
    await api.delete(
      '${_path(resource)}/$id${permanent && resource == WorkspaceResource.users ? '/permanent' : ''}',
    );
  }

  @override
  Future<void> restore(WorkspaceResource resource, int id) async {
    _require(resource, mutation: true);
    await api.post('${_path(resource)}/$id/restore');
  }

  @override
  Future<List<Json>> employees() async =>
      _rows(jsonObject(await api.get('/calendar/staff'))['data']);
  @override
  Future<List<Json>> clients({
    String query = '',
    bool companies = false,
  }) async => _rows(
    jsonObject(
      await api.get(
        queryPath('/client-options', {
          'q': query,
          'clientType': companies ? 'organization' : 'person',
        }),
      ),
    )['data'],
  );
  @override
  Future<List<Json>> caseOptions(String query) async => _rows(
    jsonObject(
      await api.get(
        queryPath('$_prefix/cases', {'search': query, 'limit': 20}),
      ),
    )['data'],
  );
  @override
  Future<List<Json>> clientCases(int clientId) async {
    final raw = await api.get(
      '$_prefix/clients/$clientId/cases-for-appointment',
    );
    return _rows(raw is List ? raw : jsonObject(raw)['cases'] ?? const []);
  }

  @override
  Future<List<Json>> availability(
    int staffId,
    DateTime from,
    DateTime to,
  ) async => _rows(
    jsonObject(
      await api.get(
        queryPath('/appointment-availability', {
          'staffId': staffId,
          'from': from.toUtc().toIso8601String(),
          'to': to.toUtc().toIso8601String(),
        }),
      ),
    )['busy'],
  );
  @override
  Future<void> respond(int eventId, String response) async {
    await api.patch(
      '/calendar/events/$eventId/response',
      body: {'responseStatus': response},
    );
  }

  @override
  Future<void> caseAction(int id, String action, Json payload) async {
    if (action == 'delete') {
      await api.delete('$_prefix/cases/$id');
      return;
    }
    if (!role.isManagement) {
      throw ApiException(
        'Esta acción requiere administración.',
        statusCode: 403,
      );
    }
    if (action == 'stage') {
      await api.patch('/admin/cases/$id/stage', body: payload);
    } else if (action == 'assign' || action == 'complete') {
      await api.post('/admin/cases/$id/$action', body: payload);
    } else {
      throw ArgumentError('Acción de caso no válida');
    }
  }

  @override
  Future<void> updateEvent(int id, bool document, Json payload) async {
    await api.put(
      '/cases/${document ? 'documents' : 'comments'}/$id',
      body: payload,
    );
  }

  @override
  Future<void> deleteEvent(int id, bool document) async {
    await api.delete('/cases/${document ? 'documents' : 'comments'}/$id');
  }

  @override
  Future<Json> taskDetail(int id) async =>
      jsonObject(await api.get('/tasks/$id'));
  @override
  Future<void> taskComment(
    int id,
    String comment, {
    int? commentId,
    bool remove = false,
  }) async {
    final path = '/tasks/$id/comments${commentId == null ? '' : '/$commentId'}';
    if (remove) {
      await api.delete(path);
    } else if (commentId != null) {
      await api.put(path, body: {'comment': comment});
    } else {
      await api.post(path, body: {'comment': comment});
    }
  }

  @override
  Future<void> linkClient(
    int organizationId,
    Json data, {
    int? removeClientId,
  }) async {
    _require(WorkspaceResource.factories, mutation: true);
    if (removeClientId != null) {
      await api.delete(
        '/organizations/$organizationId/clients/$removeClientId',
      );
    } else {
      await api.post('/organizations/$organizationId/clients', body: data);
    }
  }

  String get _profile =>
      role == PortalRole.client ? '/client/profile' : '/profile';
  @override
  Future<Json> profile() async => jsonObject(await api.get(_profile));
  @override
  Future<ApiBinaryResponse> avatarImage() =>
      api.getBytes(role == PortalRole.client ? '/client/avatar' : '/avatar');
  @override
  Future<Json> uploadSiteImage(Uint8List bytes, String filename) async {
    _require(WorkspaceResource.siteImages, mutation: true);
    return jsonObject(
      await api.upload(
        '/admin/site-images/upload',
        field: 'file',
        filename: filename,
        bytes: bytes,
      ),
    );
  }

  @override
  Future<void> avatar({Uint8List? bytes, String? filename, String? url}) async {
    if (bytes != null) {
      await api.upload(
        '$_profile/avatar',
        field: 'avatar',
        filename: filename!,
        bytes: bytes,
      );
    } else {
      await api.patch(_profile, body: {'avatarUrl': url ?? ''});
    }
  }

  @override
  Future<void> uploadDocument(
    int caseId,
    Uint8List bytes,
    String filename,
    String visibility,
  ) async {
    await api.upload(
      '/cases/$caseId/documents',
      field: 'file',
      filename: filename,
      bytes: bytes,
      fields: {'visibility': visibility},
    );
  }

  @override
  Future<ApiBinaryResponse> document(int id) => api.getBytes(
    '${role == PortalRole.client ? '/client' : ''}/documents/$id',
  );
  @override
  Future<Json> report(Json filters, String type) async {
    _require(WorkspaceResource.archivedCases);
    return jsonObject(
      await api.get(queryPath('/admin/reports/$type-report', filters)),
    );
  }

  @override
  Future<ApiBinaryResponse> exportReport(Json filters, String type) {
    _require(WorkspaceResource.archivedCases);
    return api.getBytes(
      queryPath('/admin/reports/export', {
        ...filters,
        'reportType': type,
        'format': 'csv',
      }),
    );
  }

  @override
  Future<Json> dashboard(Json filters) async => jsonObject(
    await api.get(
      queryPath(
        role.isManagement ? '/dashboard-summary' : '/staff/dashboard-summary',
        filters,
      ),
    ),
  );
  @override
  Future<Json> metrics() async {
    if (!role.allOffices) {
      throw ApiException(
        'Estos indicadores son exclusivos de dirección y soporte.',
        statusCode: 403,
      );
    }
    final data = jsonObject(await api.get('/admin/dashboard/stats'));
    if (intValue(data['totalUsers']) == null) {
      throw ApiException('No fue posible verificar los indicadores.');
    }
    return data;
  }

  @override
  Future<void> dismissAnnouncement(int id) async {
    await api.post('/dashboard/announcements/$id/dismiss');
  }
}
