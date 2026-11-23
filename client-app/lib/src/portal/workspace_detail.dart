import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../app_state.dart';
import 'catalog_forms.dart';
import 'access.dart';
import 'controllers.dart';
import 'models.dart';
import 'record_editor.dart';
import 'scheduling.dart';
import 'ui.dart';
import 'session_refresh.dart';
import 'workspace_list.dart';
import 'workspace_repository.dart';
import 'case_detail.dart';
import 'repository.dart';

class WorkspaceDetail extends StatefulWidget {
  const WorkspaceDetail({
    super.key,
    required this.repository,
    required this.resource,
    required this.record,
  });
  final WorkspaceRepository repository;
  final WorkspaceResource resource;
  final Json record;
  @override
  State<WorkspaceDetail> createState() => _WorkspaceDetailState();
}

class _WorkspaceDetailState extends State<WorkspaceDetail> {
  int _loadRevision = 0;
  late final EmployeeRefreshBinding _refreshBinding;
  Json? _data;
  String? _error;
  bool _loading = true, _busy = false;
  final _message = TextEditingController();
  int _clientPage = 1, _casePage = 1;
  String _clientQuery = '';
  int get _id => intValue(widget.record['id'])!;
  bool get _archive => {
    WorkspaceResource.archivedCases,
    WorkspaceResource.archivedAppointments,
  }.contains(widget.resource);
  @override
  void initState() {
    super.initState();
    _refreshBinding = EmployeeRefreshBinding(context.read<AppState>(), _load);
    _load();
  }

  @override
  void dispose() {
    _refreshBinding.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final revision = ++_loadRevision;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = widget.resource == WorkspaceResource.meetings
          ? await _meeting()
          : {
              WorkspaceResource.users,
              WorkspaceResource.offices,
              WorkspaceResource.factories,
              WorkspaceResource.contractors,
              WorkspaceResource.appointments,
            }.contains(widget.resource)
          ? await widget.repository.detail(
              widget.resource,
              _id,
              filters: {
                'clientPage': _clientPage,
                'casePage': _casePage,
                'clientQ': _clientQuery,
              },
            )
          : widget.resource == WorkspaceResource.tasks
          ? await widget.repository.taskDetail(_id)
          : widget.record;
      if (mounted && revision == _loadRevision) setState(() => _data = data);
    } catch (error) {
      if (mounted && revision == _loadRevision) {
        setState(() => _error = portalError(error));
      }
    } finally {
      if (mounted && revision == _loadRevision) {
        setState(() => _loading = false);
      }
    }
  }

  Future<Json> _meeting() async {
    final center =
        DateTime.tryParse(textValue(widget.record['startTime'])) ??
        DateTime.now();
    final page = await widget.repository.list(
      WorkspaceResource.meetings,
      filters: {
        'dateFrom': center
            .subtract(const Duration(days: 180))
            .toUtc()
            .toIso8601String(),
        'dateTo': center
            .add(const Duration(days: 180))
            .toUtc()
            .toIso8601String(),
      },
    );
    final event = page.items
        .where((row) => intValue(row['id']) == _id)
        .firstOrNull;
    if (event == null) {
      throw ApiException('La reunión ya no está disponible en este rango.');
    }
    return event;
  }

  Json get _record {
    final data = _data ?? widget.record;
    final key = switch (widget.resource) {
      WorkspaceResource.users => 'user',
      WorkspaceResource.offices => 'office',
      WorkspaceResource.factories ||
      WorkspaceResource.contractors => 'organization',
      WorkspaceResource.tasks => 'task',
      WorkspaceResource.appointments => 'appointment',
      _ => '',
    };
    return data[key] is Map ? jsonObject(data[key]) : data;
  }

  Future<void> _openCase(Json row) async {
    final session = context.read<AppState>();
    final id = intValue(row['id']);
    if (id == null) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CaseDetailScreen(
          id: id,
          repository: HttpPortalRepository(session.apiClient, session.role!),
          role: session.role!,
          officeId: session.profile?.officeId,
          workspace: widget.repository,
        ),
      ),
    );
  }

  Widget _pages(String type) {
    final current = type == 'client' ? _clientPage : _casePage;
    final total = intValue(_data?['${type}Total']) ?? 0;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        IconButton(
          tooltip: 'Página anterior',
          onPressed: current <= 1 || _loading
              ? null
              : () {
                  if (type == 'client') {
                    _clientPage--;
                  } else {
                    _casePage--;
                  }
                  _load();
                },
          icon: const Icon(Icons.chevron_left),
        ),
        Expanded(
          child: Text(
            'Página $current · $total registros',
            textAlign: TextAlign.center,
          ),
        ),
        IconButton(
          tooltip: 'Página siguiente',
          onPressed: current * 20 >= total || _loading
              ? null
              : () {
                  if (type == 'client') {
                    _clientPage++;
                  } else {
                    _casePage++;
                  }
                  _load();
                },
          icon: const Icon(Icons.chevron_right),
        ),
      ],
    );
  }

  bool get _editable {
    if (_error != null || _loading) return false;
    final session = context.read<AppState>();
    if (_archive || _record['_broadcast'] == true) return false;
    if (widget.resource == WorkspaceResource.announcements) {
      return widget.repository.role.canManageWebsite;
    }
    if (widget.resource == WorkspaceResource.tasks) {
      return canManageCase(
        widget.repository.role,
        session.authUser?.id,
        jsonObject(_record['case'] ?? _data?['case']),
      );
    }
    if (widget.resource == WorkspaceResource.users) {
      return canEditUser(
        widget.repository.role,
        session.profile?.officeId,
        _record,
      );
    }
    if (widget.resource == WorkspaceResource.meetings) {
      return widget.repository.role.isManagement ||
          intValue(_record['organizerId']) == session.authUser?.id;
    }
    return true;
  }

  Future<void> _edit() async {
    final session = context.read<AppState>();
    bool changed;
    if (widget.resource == WorkspaceResource.appointments) {
      changed = await editAppointment(
        context,
        widget.repository,
        record: _record,
        officeId: session.profile?.officeId,
      );
    } else {
      changed = await openRecordEditor(context, () async {
        final record = widget.resource == WorkspaceResource.users
            ? jsonObject(
                (await widget.repository.detail(widget.resource, _id))['user'],
              )
            : _record;
        return CatalogForms(
          widget.repository,
          officeId: session.profile?.officeId,
          actorId: session.authUser!.id,
          ownPasswordChanged: session.logout,
        ).build(widget.resource, record: record);
      });
    }
    if (changed && mounted) {
      Navigator.pop(context, true);
    }
  }

  Future<void> _action(
    Future<void> Function() action, {
    bool close = false,
  }) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      if (!mounted) return;

      if (close) {
        Navigator.pop(context, true);
      } else {
        await _load();
      }
    } catch (error) {
      if (mounted) setState(() => _error = portalError(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete({bool permanent = false}) async {
    if (!await confirmAction(
      context,
      permanent ? '¿Eliminar permanentemente?' : '¿Eliminar registro?',
      permanent
          ? 'Esta acción es irreversible y elimina el registro y sus relaciones.'
          : 'Confirme que desea eliminar este registro.',
      action: 'Eliminar',
    )) {
      return;
    }
    if (!mounted) return;
    await _action(
      () =>
          widget.repository.delete(widget.resource, _id, permanent: permanent),
      close: true,
    );
  }

  Future<void> _link() async {
    final client = await chooseRecord(
      context,
      title: 'Vincular cliente',
      load: (q) async => (await widget.repository.clients(
        query: q,
      )).map(DirectoryOption.fromJson).toList(),
    );
    if (client == null || !mounted) return;
    final fields = <RecordField>[
      if (widget.resource == WorkspaceResource.factories) ...[
        const RecordField(
          'employeeNumber',
          'Número de Empleado',
          required: true,
          maxLength: 100,
        ),
        const RecordField('shiftName', 'Turno', required: true, maxLength: 100),
        const RecordField('shiftStart', 'Inicio del turno (HH:mm)'),
        const RecordField('shiftEnd', 'Fin del turno (HH:mm)'),
      ],
    ];
    final saved = await openRecordEditor(
      context,
      () async => RecordForm(
        title: 'Vincular ${client.name}',
        fields: fields,
        validate: (v) => widget.resource == WorkspaceResource.factories
            ? Employment(
                maquilaId: _id,
                employeeNumber: textValue(v['employeeNumber']),
                shiftName: textValue(v['shiftName']),
                shiftStart: textValue(v['shiftStart']),
                shiftEnd: textValue(v['shiftEnd']),
              ).validate()
            : null,
        save: (v) =>
            widget.repository.linkClient(_id, {'clientId': client.id, ...v}),
      ),
    );
    if (saved && mounted) {
      await _load();
    }
  }

  Future<void> _comment({Json? comment, bool remove = false}) async {
    final commentId = intValue(comment?['id']);
    if (remove) {
      if (await confirmAction(
            context,
            '¿Eliminar comentario?',
            'Se quitará este comentario.',
            action: 'Eliminar',
          ) &&
          mounted) {
        await _action(
          () => widget.repository.taskComment(
            _id,
            '',
            commentId: commentId,
            remove: true,
          ),
        );
      }
      return;
    }
    final changed = await openRecordEditor(
      context,
      () async => RecordForm(
        title: commentId == null ? 'Agregar comentario' : 'Editar comentario',
        initial: {
          'comment': comment?['comment'] ?? comment?['commentText'] ?? '',
        },
        fields: const [
          RecordField(
            'comment',
            'Comentario',
            kind: InputKind.multiline,
            required: true,
          ),
        ],
        save: (v) => widget.repository.taskComment(
          _id,
          v['comment'],
          commentId: commentId,
        ),
      ),
    );
    if (changed && mounted) {
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final record = _record, session = context.read<AppState>();
    final hasDelete =
        !{
          WorkspaceResource.factories,
          WorkspaceResource.contractors,
        }.contains(widget.resource) &&
        _editable &&
        !(widget.resource == WorkspaceResource.offices &&
            !widget.repository.role.allOffices) &&
        !(widget.resource == WorkspaceResource.users &&
            (record['role'] == 'technical_support' ||
                record['clientType'] == 'organization' ||
                _id == 1));
    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, _) {},
      child: Scaffold(
        appBar: AppBar(
          title: Text(resourceTitle(widget.resource)),
          actions: [
            if (_data != null && _editable)
              IconButton(
                tooltip: 'Editar',
                onPressed: _busy ? null : _edit,
                icon: const Icon(Icons.edit_outlined),
              ),
          ],
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : PortalContent(
                onRefresh: _load,
                children: [
                  if (_error != null) PortalError(_error!, onRetry: _load),
                  if (_busy) const LinearProgressIndicator(),
                  Text(
                    recordTitle(record),
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 20),
                  PortalSection(
                    title: 'Información',
                    children: [
                      PortalFields(
                        children: [
                          for (final entry in _labels.entries)
                            if (record[entry.key] != null &&
                                textValue(record[entry.key]).isNotEmpty)
                              _value(entry.value, record[entry.key], entry.key),
                          if (widget.resource ==
                              WorkspaceResource.appointments) ...[
                            _value(
                              'Cliente',
                              personName(
                                jsonObject(
                                  _data?['client'] ??
                                      record['client'] ??
                                      jsonObject(record['case'])['client'],
                                ),
                              ),
                              'name',
                            ),
                            _value(
                              'Profesional',
                              personName(
                                jsonObject(_data?['staff'] ?? record['staff']),
                              ),
                              'name',
                            ),
                          ],
                          if (widget.resource == WorkspaceResource.tasks)
                            _value(
                              'Asignado a',
                              personName(jsonObject(record['assignedTo'])),
                              'name',
                            ),
                          if (record['office'] != null)
                            _value(
                              'Oficina',
                              jsonObject(record['office'])['name'],
                              'name',
                            ),
                          if (record['organizationInfo'] != null ||
                              _data?['organizationInfo'] != null) ...[
                            for (final e in jsonObject(
                              record['organizationInfo'] ??
                                  _data?['organizationInfo'],
                            ).entries)
                              if (e.value != null)
                                _value(
                                  e.key == 'department'
                                      ? 'Departamento'
                                      : 'Especialidad',
                                  e.value,
                                  'name',
                                ),
                          ],
                        ],
                      ),
                    ],
                  ),
                  if (widget.resource == WorkspaceResource.users &&
                      jsonRows(_data?['contactSubmissions']).isNotEmpty)
                    PortalSection(
                      title: 'Solicitudes de contacto',
                      children: [
                        for (final inquiry in jsonRows(
                          _data?['contactSubmissions'],
                        ))
                          Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Formulario de contacto',
                                  style: Theme.of(
                                    context,
                                  ).textTheme.titleMedium,
                                ),
                                for (final entry in const {
                                  'name': 'Nombre registrado',
                                  'email': 'Correo registrado',
                                  'phone': 'Teléfono registrado',
                                }.entries)
                                  if (textValue(inquiry[entry.key]).isNotEmpty)
                                    Padding(
                                      padding: const EdgeInsets.only(bottom: 8),
                                      child: _value(
                                        entry.value,
                                        inquiry[entry.key],
                                        entry.key,
                                      ),
                                    ),
                                if (inquiry['officeId'] != null)
                                  TextButton(
                                    onPressed: () => Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (_) => WorkspaceDetail(
                                          repository: widget.repository,
                                          resource: WorkspaceResource.offices,
                                          record: {'id': inquiry['officeId']},
                                        ),
                                      ),
                                    ),
                                    child: const Text('Ver oficina solicitada'),
                                  ),
                                if (textValue(inquiry['message']).isNotEmpty)
                                  Text(textValue(inquiry['message'])),
                                Text(
                                  localDate(textValue(inquiry['createdAt'])),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  if (widget.resource == WorkspaceResource.tasks) ...[
                    PortalSection(
                      title: 'Comentarios',
                      children: [
                        if (!_editable &&
                            (intValue(record['assignedToId']) ??
                                    intValue(
                                      jsonObject(record['assignedTo'])['id'],
                                    )) ==
                                session.authUser?.id &&
                            record['status'] != 'completed')
                          FilledButton(
                            onPressed: _busy
                                ? null
                                : () => _action(
                                    () => widget.repository.save(
                                      WorkspaceResource.tasks,
                                      {'status': 'completed'},
                                      id: _id,
                                    ),
                                  ),
                            child: const Text('Completar Tarea'),
                          ),
                        for (final c in jsonRows(_data?['comments']))
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(
                              textValue(c['comment'] ?? c['commentText']),
                            ),
                            subtitle: Text(
                              '${personName(jsonObject(c['user']))} · ${localDate(textValue(c['createdAt']))}',
                            ),
                            trailing:
                                intValue(c['userId']) == session.authUser?.id
                                ? PopupMenuButton<String>(
                                    onSelected: (a) => _comment(
                                      comment: c,
                                      remove: a == 'delete',
                                    ),
                                    itemBuilder: (_) => const [
                                      PopupMenuItem(
                                        value: 'edit',
                                        child: Text('Editar'),
                                      ),
                                      PopupMenuItem(
                                        value: 'delete',
                                        child: Text('Eliminar'),
                                      ),
                                    ],
                                  )
                                : null,
                          ),
                        OutlinedButton.icon(
                          onPressed: _busy ? null : () => _comment(),
                          icon: const Icon(Icons.add_comment_outlined),
                          label: const Text('Agregar comentario'),
                        ),
                      ],
                    ),
                  ],
                  if (widget.resource == WorkspaceResource.meetings) ...[
                    PortalSection(
                      title: 'Clientes relacionados',
                      children: [
                        for (final relation in jsonRows(
                          record['relatedClients'],
                        ))
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(
                              personName(jsonObject(relation['client'])),
                            ),
                          ),
                      ],
                    ),
                    PortalSection(
                      title: 'Participantes',
                      children: [
                        for (final attendee in jsonRows(record['attendees']))
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(
                              personName(jsonObject(attendee['user'])),
                            ),
                            subtitle: Text(
                              statusLabel(
                                textValue(attendee['responseStatus']),
                              ),
                            ),
                          ),
                      ],
                    ),
                    if (jsonRows(
                      record['attendees'],
                    ).any((a) => intValue(a['userId']) == session.authUser?.id))
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final choice in const [
                            FieldChoice('accepted', 'Aceptar'),
                            FieldChoice('tentative', 'Tentativo'),
                            FieldChoice('declined', 'Rechazar'),
                          ])
                            OutlinedButton(
                              onPressed: _busy
                                  ? null
                                  : () => _action(
                                      () => widget.repository.respond(
                                        _id,
                                        '${choice.value}',
                                      ),
                                    ),
                              child: Text(choice.label),
                            ),
                        ],
                      ),
                  ],
                  if (widget.resource == WorkspaceResource.factories ||
                      widget.resource == WorkspaceResource.contractors) ...[
                    PortalSection(
                      title: 'Clientes relacionados',
                      children: [
                        TextField(
                          decoration: const InputDecoration(
                            labelText: 'Buscar cliente relacionado',
                          ),
                          onSubmitted: (q) {
                            _clientQuery = q.trim();
                            _clientPage = 1;
                            _load();
                          },
                        ),
                        _pages('client'),
                        OutlinedButton.icon(
                          onPressed: _busy ? null : _link,
                          icon: const Icon(Icons.person_add_alt),
                          label: const Text('Vincular cliente'),
                        ),
                        for (final row in jsonRows(_data?['clients']))
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(personName(jsonObject(row['client']))),
                            subtitle: Text(
                              row['historical'] == true
                                  ? 'Relación histórica'
                                  : 'Vinculado',
                            ),
                            trailing:
                                row['historical'] != true &&
                                    jsonObject(row['client'])['id'] !=
                                        record['accountClientId']
                                ? IconButton(
                                    tooltip: 'Desvincular',
                                    icon: const Icon(Icons.link_off),
                                    onPressed: _busy
                                        ? null
                                        : () async {
                                            if (await confirmAction(
                                                  context,
                                                  '¿Desvincular cliente?',
                                                  'Los expedientes conservarán su información histórica.',
                                                ) &&
                                                mounted) {
                                              await _action(
                                                () => widget.repository
                                                    .linkClient(
                                                      _id,
                                                      {},
                                                      removeClientId: intValue(
                                                        jsonObject(
                                                          row['client'],
                                                        )['id'],
                                                      ),
                                                    ),
                                              );
                                            }
                                          },
                                  )
                                : null,
                          ),
                      ],
                    ),
                    PortalSection(
                      title: 'Expedientes relacionados',
                      children: [
                        _pages('case'),
                        for (final row in jsonRows(_data?['cases']))
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(textValue(row['title'])),
                            onTap: () => _openCase(row),
                            subtitle: Text(
                              statusLabel(textValue(row['status'])),
                            ),
                          ),
                      ],
                    ),
                  ],
                  if (widget.resource == WorkspaceResource.offices)
                    for (final key in ['staff', 'clients'])
                      PortalSection(
                        title: key == 'staff' ? 'Personal' : 'Clientes',
                        children: [
                          for (final user in jsonRows(_data?[key]))
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(personName(user)),
                              subtitle: Text(textValue(user['email'])),
                            ),
                        ],
                      ),
                  if (widget.resource == WorkspaceResource.announcements)
                    OutlinedButton(
                      onPressed: _busy
                          ? null
                          : () => _action(
                              () => widget.repository.dismissAnnouncement(_id),
                              close: true,
                            ),
                      child: const Text('Descartar anuncio'),
                    ),
                  if (_archive) ...[
                    FilledButton.icon(
                      onPressed: _busy
                          ? null
                          : () async {
                              if (await confirmAction(
                                    context,
                                    '¿Restaurar registro?',
                                    'Volverá a estar disponible en su sección original.',
                                  ) &&
                                  mounted) {
                                await _action(
                                  () => widget.repository.restore(
                                    widget.resource,
                                    _id,
                                  ),
                                  close: true,
                                );
                              }
                            },
                      icon: const Icon(Icons.restore),
                      label: const Text('Restaurar'),
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton(
                      onPressed: _busy ? null : () => _delete(permanent: true),
                      child: const Text('Eliminar permanentemente'),
                    ),
                  ] else if (hasDelete)
                    OutlinedButton.icon(
                      onPressed: _busy ? null : () => _delete(),
                      icon: const Icon(Icons.delete_outline),
                      label: const Text('Eliminar'),
                    ),
                  if (hasDelete && widget.resource == WorkspaceResource.users)
                    TextButton(
                      onPressed: _busy ? null : () => _delete(permanent: true),
                      child: const Text('Eliminar permanentemente'),
                    ),
                  const SizedBox(height: 24),
                ],
              ),
      ),
    );
  }

  Widget _value(String label, dynamic value, String key) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: Theme.of(context).textTheme.labelMedium),
      const SizedBox(height: 4),
      SelectableText(
        key.endsWith('Time') || key.endsWith('At') || key == 'dueDate'
            ? localDate('$value')
            : key == 'status' || key == 'archiveReason'
            ? statusLabel('$value')
            : key == 'role'
            ? portalRoleLabel('$value')
            : value is bool
            ? value
                  ? 'Sí'
                  : 'No'
            : value is List
            ? value.join('\n')
            : '$value',
      ),
    ],
  );
}

String portalRoleLabel(String value) => PortalRole.parse(value)?.label ?? value;
const _labels = {
  'firstName': 'Nombre(s)',
  'lastName': 'Apellidos',
  'email': 'Correo Electrónico',
  'phone': 'Teléfono',
  'role': 'Rol',
  'isActive': 'Cuenta activa',
  'createdAt': 'Creado',
  'lastLogin': 'Último acceso',
  'name': 'Nombre',
  'address': 'Dirección',
  'phoneOffice': 'Teléfono de Oficina',
  'phoneCell': 'Teléfono Celular',
  'latitude': 'Latitud',
  'longitude': 'Longitud',
  'legalRepresentative': 'Representante Legal',
  'legalAddress': 'Domicilio Legal',
  'boardPresident': 'Presidente de Mesa Directiva',
  'neighborhood': 'Colonia',
  'title': 'Título',
  'description': 'Descripción',
  'status': 'Estado',
  'startTime': 'Inicio',
  'endTime': 'Fin',
  'dueDate': 'Fecha límite',
  'location': 'Ubicación',
  'bodyText': 'Nota',
  'bodyHtml': 'Contenido',
  'contentValue': 'Contenido',
  'section': 'Sección',
  'contentKey': 'Identificador',
  'imageUrl': 'Imagen',
  'altText': 'Texto alternativo',
  'details': 'Detalles',
  'archiveReason': 'Motivo de archivo',
  'archivedAt': 'Archivado',
};
