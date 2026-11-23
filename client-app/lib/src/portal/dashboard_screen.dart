import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../app_state.dart';
import 'session_refresh.dart';
import 'controllers.dart';
import 'models.dart';
import 'record_editor.dart';
import 'ui.dart';
import 'workspace_list.dart';
import 'workspace_detail.dart';
import 'workspace_repository.dart';
import 'calendar_screen.dart';
import 'agenda.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    super.key,
    required this.repository,
    required this.name,
    required this.onCreate,
    required this.onCases,
    required this.onAppointments,
  });
  final WorkspaceRepository repository;
  final String name;
  final VoidCallback onCreate, onCases, onAppointments;
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late final EmployeeRefreshBinding _refresh;
  Json? _summary;
  List<Json> _agenda = [];
  String? _error, _agendaError;
  int? _officeId;
  bool _loading = true;
  int _revision = 0;
  @override
  void initState() {
    super.initState();
    _refresh = EmployeeRefreshBinding(context.read<AppState>(), _load);
    _load();
  }

  @override
  void dispose() {
    _refresh.dispose();
    _revision++;
    super.dispose();
  }

  Future<void> _load() async {
    final revision = ++_revision;
    setState(() {
      _loading = true;
      _error = null;
      _agendaError = null;
    });
    final filters = <String, dynamic>{
      if (_officeId != null) 'officeId': _officeId,
    };
    final results = await Future.wait([
      widget.repository
          .dashboard(filters)
          .then<Object>((v) => v)
          .catchError((Object e) => e),
      _loadAgenda(_officeId).then<Object>((v) => v).catchError((Object e) => e),
    ]);
    if (!mounted || revision != _revision) return;
    setState(() {
      _loading = false;
      if (results[0] is Map) {
        _summary = jsonObject(results[0]);
      } else {
        _summary = null;
        _error = portalError(results[0]);
      }
      if (results[1] is List) {
        _agenda = jsonRows(results[1]);
      } else {
        _agenda = [];
        _agendaError = portalError(results[1]);
      }
    });
  }

  Future<List<Json>> _loadAgenda(int? officeId) async {
    final now = DateTime.now();
    return (await loadAgenda(
      widget.repository,
      now,
      now.add(const Duration(days: 30)),
      officeId: officeId,
    )).take(6).toList();
  }

  Future<void> _office() async {
    final changed = await openRecordEditor(
      context,
      () async => RecordForm(
        title: 'Filtrar por Oficina',
        initial: {'officeId': _officeId},
        fields: [
          RecordField(
            'officeId',
            'Oficina',
            kind: InputKind.choice,
            choices: (await widget.repository.list(WorkspaceResource.offices))
                .items
                .map(
                  (r) => FieldChoice(intValue(r['id'])!, textValue(r['name'])),
                )
                .toList(),
          ),
        ],
        save: (v) async {
          _officeId = intValue(v['officeId']);
        },
      ),
    );
    if (changed && mounted) await _load();
  }

  Widget _agendaSection() => PortalSection(
    title: 'Próximos compromisos',
    children: [
      if (_agendaError != null) PortalError(_agendaError!, onRetry: _load),
      if (_agenda.isEmpty && _agendaError == null && !_loading)
        const Text('No hay compromisos en los próximos 30 días.'),
      for (final row in _agenda)
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(
            row['_meeting'] == true
                ? Icons.groups_outlined
                : Icons.event_outlined,
          ),
          title: Text(textValue(row['title'])),
          subtitle: Text(localDate(textValue(row['startTime']))),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => WorkspaceDetail(
                repository: widget.repository,
                resource: row['_meeting'] == true
                    ? WorkspaceResource.meetings
                    : WorkspaceResource.appointments,
                record: row,
              ),
            ),
          ),
        ),
      TextButton(
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => CalendarScreen(repository: widget.repository),
          ),
        ),
        child: const Text('Abrir calendario'),
      ),
    ],
  );
  @override
  Widget build(BuildContext context) {
    final management = widget.repository.role.isManagement, summary = _summary;
    return PortalContent(
      onRefresh: _load,
      children: [
        Text(
          'Bienvenido, ${widget.name}',
          style: Theme.of(
            context,
          ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        Text(widget.repository.role.label),
        const SizedBox(height: 20),
        if (widget.repository.role.allOffices)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: _loading ? null : _office,
              icon: const Icon(Icons.filter_alt_outlined),
              label: Text(
                _officeId == null
                    ? 'Todas las oficinas'
                    : 'Oficina seleccionada',
              ),
            ),
          ),
        if (_loading) const LinearProgressIndicator(),
        if (_error != null) PortalError(_error!, onRetry: _load),
        if (!management) _agendaSection(),
        PortalSection(
          title: 'Acciones rápidas',
          children: [
            FilledButton.icon(
              onPressed: widget.onCreate,
              icon: const Icon(Icons.add),
              label: const Text('Crear Caso'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: widget.onAppointments,
              icon: const Icon(Icons.calendar_month_outlined),
              label: const Text('Consultar citas'),
            ),
          ],
        ),
        if (summary != null)
          PortalFields(
            children: [
              _metric(
                'Expedientes',
                summary[management ? 'totalCases' : 'myCases'],
                Icons.folder_open_outlined,
                widget.onCases,
              ),
              _metric(
                'Citas de hoy',
                summary[management
                    ? 'appointmentsToday'
                    : 'myAppointmentsToday'],
                Icons.calendar_month_outlined,
                widget.onAppointments,
              ),
              _metric(
                'Casos abiertos',
                summary[management ? 'openCases' : 'myOpenCases'],
                Icons.pending_actions,
                widget.onCases,
              ),
              _metric(
                'Tareas pendientes',
                summary[management ? 'pendingTasks' : 'myPendingTasks'],
                Icons.task_alt_outlined,
                () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => WorkspaceList(
                      repository: widget.repository,
                      resource: WorkspaceResource.tasks,
                    ),
                  ),
                ),
              ),
            ],
          ),
        const SizedBox(height: 24),
        if (management) _agendaSection(),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final r in [
              WorkspaceResource.notes,
              WorkspaceResource.announcements,
            ])
              OutlinedButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => WorkspaceList(
                      repository: widget.repository,
                      resource: r,
                    ),
                  ),
                ),
                child: Text(resourceTitle(r)),
              ),
          ],
        ),
      ],
    );
  }

  Widget _metric(
    String title,
    dynamic value,
    IconData icon,
    VoidCallback tap,
  ) => Card(
    child: InkWell(
      onTap: tap,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon),
            const SizedBox(height: 18),
            Text(
              textValue(value),
              style: Theme.of(
                context,
              ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(title),
          ],
        ),
      ),
    ),
  );
}
