import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../app_state.dart';
import 'access.dart';
import 'catalog_forms.dart';
import 'controllers.dart';
import 'models.dart';
import 'record_editor.dart';
import 'scheduling.dart';
import 'ui.dart';
import 'session_refresh.dart';
import 'workspace_repository.dart';
import 'workspace_detail.dart';

String resourceTitle(WorkspaceResource resource) => switch (resource) {
  WorkspaceResource.users => 'Usuarios',
  WorkspaceResource.offices => 'Oficinas',
  WorkspaceResource.factories => 'Maquilas',
  WorkspaceResource.contractors => 'Constructoras',
  WorkspaceResource.appointments => 'Citas',
  WorkspaceResource.meetings => 'Calendario',
  WorkspaceResource.tasks => 'Tareas',
  WorkspaceResource.notes => 'Mis notas',
  WorkspaceResource.announcements => 'Anuncios',
  WorkspaceResource.siteContent => 'Contenido',
  WorkspaceResource.siteServices => 'Servicios del sitio',
  WorkspaceResource.siteEvents => 'Eventos del sitio',
  WorkspaceResource.siteImages => 'Galería',
  WorkspaceResource.archivedCases => 'Casos archivados',
  WorkspaceResource.archivedAppointments => 'Citas archivadas',
};
String recordTitle(Json row) => personName(row).isNotEmpty
    ? personName(row)
    : textValue(
        row['name'] ??
            row['title'] ??
            row['bodyText'] ??
            row['contentKey'] ??
            row['altText'],
      );

class WorkspaceList extends StatefulWidget {
  const WorkspaceList({
    super.key,
    required this.repository,
    required this.resource,
    this.embedded = false,
  });
  final WorkspaceRepository repository;
  final WorkspaceResource resource;
  final bool embedded;
  @override
  State<WorkspaceList> createState() => _WorkspaceListState();
}

class _WorkspaceListState extends State<WorkspaceList> {
  late final EmployeeRefreshBinding _refreshBinding;
  List<Json> _items = [];
  int _page = 1, _total = 0, _revision = 0;
  Json _filters = {};
  String _query = '', _status = '';
  bool _loading = true;
  String? _error;
  final _search = TextEditingController();
  @override
  void initState() {
    super.initState();
    _refreshBinding = EmployeeRefreshBinding(context.read<AppState>(), _load);
    _load();
  }

  @override
  void dispose() {
    _refreshBinding.dispose();
    _revision++;
    _search.dispose();
    super.dispose();
  }

  Future<void> _load({bool next = false}) async {
    final revision = ++_revision;
    setState(() {
      _loading = true;
      _error = null;
      if (!next) {
        _items = [];
        _page = 1;
      }
    });
    try {
      final page = await widget.repository.list(
        widget.resource,
        page: next ? _page + 1 : 1,
        query: _query,
        filters: {..._filters, if (_status.isNotEmpty) 'status': _status},
      );
      if (!mounted || revision != _revision) return;
      setState(() {
        _items = next ? [..._items, ...page.items] : page.items;
        _total = page.total;
        if (next) _page++;
      });
    } catch (error) {
      if (mounted && revision == _revision) {
        setState(() => _error = portalError(error));
      }
    } finally {
      if (mounted && revision == _revision) setState(() => _loading = false);
    }
  }

  Future<void> _filter() async {
    final changed = await openRecordEditor(context, () async {
      final fields = <RecordField>[];
      if (widget.resource == WorkspaceResource.users) {
        fields.addAll([
          RecordField(
            'role',
            'Rol',
            kind: InputKind.choice,
            choices: PortalRole.values
                .map((role) => FieldChoice(role.value, role.label))
                .toList(),
          ),
          const RecordField(
            'activity',
            'Actividad',
            kind: InputKind.choice,
            choices: [
              FieldChoice('active', 'Últimas 24 horas'),
              FieldChoice('inactive', 'Sin acceso reciente'),
            ],
          ),
        ]);
        if (widget.repository.role.allOffices) {
          fields.add(
            RecordField(
              'officeId',
              'Oficina',
              kind: InputKind.choice,
              choices: namedChoices(
                (await widget.repository.list(WorkspaceResource.offices)).items,
              ),
            ),
          );
        }
      }
      if ([
        WorkspaceResource.appointments,
        WorkspaceResource.meetings,
      ].contains(widget.resource)) {
        fields.addAll(const [
          RecordField('dateFrom', 'Desde', kind: InputKind.dateTime),
          RecordField('dateTo', 'Hasta', kind: InputKind.dateTime),
        ]);
      }
      if (widget.resource == WorkspaceResource.appointments) {
        fields.add(
          RecordField(
            'department',
            'Departamento',
            kind: InputKind.choice,
            choices: caseTypes.keys
                .map((value) => FieldChoice(value, value))
                .toList(),
          ),
        );
      }
      if (widget.resource == WorkspaceResource.archivedCases) {
        fields.add(
          const RecordField(
            'type',
            'Tipo de archivo',
            kind: InputKind.choice,
            choices: [
              FieldChoice('all', 'Todos'),
              FieldChoice('completed', 'Completados'),
              FieldChoice('deleted', 'Eliminados'),
            ],
          ),
        );
      }
      return RecordForm(
        title: 'Filtros',
        initial: _filters,
        fields: fields,
        validate: (values) {
          final from = DateTime.tryParse(textValue(values['dateFrom']));
          final to = DateTime.tryParse(textValue(values['dateTo']));
          return from != null && to != null && !to.isAfter(from)
              ? 'Seleccione un rango de fechas válido.'
              : null;
        },
        save: (values) async {
          _filters = values;
          if (widget.resource == WorkspaceResource.appointments) {
            for (final key in ['dateFrom', 'dateTo']) {
              if (values[key] != null) {
                _filters[key] = DateTime.parse(
                  values[key],
                ).toUtc().toIso8601String().substring(0, 10);
              }
            }
          }
        },
      );
    });
    if (changed && mounted) await _load();
  }

  Future<void> _create() async {
    final session = context.read<AppState>();
    bool changed;
    if (widget.resource == WorkspaceResource.appointments) {
      changed = await editAppointment(
        context,
        widget.repository,
        officeId: session.profile?.officeId,
      );
    } else {
      changed = await openRecordEditor(
        context,
        () => CatalogForms(
          widget.repository,
          officeId: session.profile?.officeId,
          actorId: session.authUser!.id,
        ).build(widget.resource),
      );
    }
    if (changed && mounted) await _load();
  }

  bool get _canCreate =>
      !(widget.resource == WorkspaceResource.announcements &&
          !widget.repository.role.canManageWebsite) &&
      !{
        WorkspaceResource.archivedCases,
        WorkspaceResource.archivedAppointments,
      }.contains(widget.resource) &&
      !(widget.resource == WorkspaceResource.offices &&
          !widget.repository.role.allOffices);
  Future<void> _uploadImage() async {
    try {
      final file = await openFile(
        acceptedTypeGroups: [
          const XTypeGroup(
            label: 'Imágenes',
            extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
            uniformTypeIdentifiers: ['public.image'],
          ),
        ],
      );
      if (file == null) return;
      if (await file.length() > 10 * 1024 * 1024) {
        throw ApiException('La imagen no puede superar 10 MB.');
      }
      final image = await widget.repository.uploadSiteImage(
        await file.readAsBytes(),
        file.name,
      );
      if (!mounted) return;
      final session = context.read<AppState>();
      final created = await openRecordEditor(
        context,
        () => CatalogForms(widget.repository, actorId: session.authUser!.id)
            .build(
              WorkspaceResource.siteImages,
              record: {
                'imageUrl': image['url'],
                'section': 'gallery',
                'isActive': true,
              },
            ),
      );
      if (created && mounted) await _load();
    } catch (error) {
      if (mounted) setState(() => _error = portalError(error));
    }
  }

  Future<void> _open(Json row) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => WorkspaceDetail(
          repository: widget.repository,
          resource: widget.resource,
          record: row,
        ),
      ),
    );
    if (changed == true && mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final localFilter = {
      WorkspaceResource.appointments,
      WorkspaceResource.offices,
      WorkspaceResource.meetings,
      WorkspaceResource.tasks,
      WorkspaceResource.notes,
      WorkspaceResource.announcements,
      WorkspaceResource.siteContent,
      WorkspaceResource.siteServices,
      WorkspaceResource.siteEvents,
      WorkspaceResource.siteImages,
    }.contains(widget.resource);
    final items = localFilter
        ? _items
              .where(
                (r) => [
                  recordTitle(r),
                  textValue(r['email']),
                  personName(jsonObject(r['client'])),
                  personName(jsonObject(r['staff'])),
                  textValue(r['description']),
                ].join(' ').toLowerCase().contains(_query.toLowerCase()),
              )
              .toList()
        : _items;
    final content = PortalContent(
      onRefresh: _load,
      children: [
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 12,
          runSpacing: 12,
          children: [
            Text(
              resourceTitle(widget.resource),
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            if (_canCreate)
              FilledButton.icon(
                onPressed: _create,
                icon: const Icon(Icons.add),
                label: const Text('Crear'),
              ),
          ],
        ),
        const SizedBox(height: 20),
        if ([
          WorkspaceResource.users,
          WorkspaceResource.appointments,
          WorkspaceResource.meetings,
          WorkspaceResource.archivedCases,
        ].contains(widget.resource))
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: _filter,
              icon: const Icon(Icons.filter_list),
              label: const Text('Filtros'),
            ),
          ),
        if (widget.resource == WorkspaceResource.siteImages)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: OutlinedButton.icon(
              onPressed: _uploadImage,
              icon: const Icon(Icons.upload_file),
              label: const Text('Subir Imagen'),
            ),
          ),
        TextField(
          controller: _search,
          decoration: InputDecoration(
            labelText: 'Buscar',
            suffixIcon: IconButton(
              tooltip: 'Buscar',
              onPressed: () {
                _query = _search.text.trim();
                _load();
              },
              icon: const Icon(Icons.search),
            ),
          ),
          onSubmitted: (q) {
            _query = q.trim();
            _load();
          },
        ),
        const SizedBox(height: 16),
        if (widget.resource == WorkspaceResource.appointments ||
            widget.resource == WorkspaceResource.tasks)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ChoiceChip(
                label: const Text('Todas'),
                selected: _status.isEmpty,
                onSelected: (_) {
                  _status = '';
                  _load();
                },
              ),
              for (final option
                  in widget.resource == WorkspaceResource.tasks
                      ? taskStatuses
                      : appointmentStatuses)
                ChoiceChip(
                  label: Text(option.label),
                  selected: _status == option.value,
                  onSelected: (_) {
                    _status = '${option.value}';
                    _load();
                  },
                ),
            ],
          ),
        const SizedBox(height: 16),
        if (_error != null)
          PortalError(_error!, onRetry: () => _load(next: _items.isNotEmpty)),
        if (_loading) const LinearProgressIndicator(),
        if (!_loading && _error == null && items.isEmpty)
          const PortalEmpty(
            title: 'Sin registros',
            description: 'No hay resultados con los filtros actuales.',
          ),
        for (final row in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Card(
              child: ListTile(
                contentPadding: const EdgeInsets.all(16),
                title: Text(recordTitle(row)),
                subtitle: Text(
                  [
                    if (row['role'] != null)
                      PortalRole.parse(textValue(row['role']))?.label ?? '',
                    if (row['email'] != null) textValue(row['email']),
                    if (row['startTime'] != null)
                      localDate(textValue(row['startTime'])),
                    if (row['status'] != null)
                      statusLabel(textValue(row['status'])),
                    if (row['office'] != null)
                      textValue(jsonObject(row['office'])['name']),
                  ].where((s) => s.isNotEmpty).join(' · '),
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _open(row),
              ),
            ),
          ),
        if (_items.length < _total && !_loading)
          OutlinedButton(
            onPressed: () => _load(next: true),
            child: const Text('Cargar más'),
          ),
        const SizedBox(height: 70),
      ],
    );
    return widget.embedded
        ? content
        : Scaffold(
            appBar: AppBar(title: Text(resourceTitle(widget.resource))),
            body: SafeArea(child: content),
          );
  }
}
