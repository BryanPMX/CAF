import 'package:flutter/material.dart';
import 'catalog_forms.dart';
import 'agenda.dart';
import 'controllers.dart';
import 'models.dart';
import 'record_editor.dart';
import 'scheduling.dart';
import 'session_refresh.dart';
import 'ui.dart';
import 'workspace_detail.dart';
import 'workspace_repository.dart';
import '../app_state.dart';
import 'package:provider/provider.dart';

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key, required this.repository});
  final WorkspaceRepository repository;
  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  late final EmployeeRefreshBinding _refresh;
  DateTime _day = DateTime.now(), _month = DateTime.now();
  bool _daily = false, _loading = true;
  String? _error;
  List<Json> _items = [];
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
    final from = _daily
        ? DateTime(_day.year, _day.month, _day.day)
        : DateTime(_month.year, _month.month);
    final to = _daily
        ? DateTime(_day.year, _day.month, _day.day + 1)
        : DateTime(_month.year, _month.month + 1);
    setState(() {
      _loading = true;
      _error = null;
      _items = [];
    });
    try {
      final rows = await loadAgenda(widget.repository, from, to);
      if (mounted && revision == _revision) setState(() => _items = rows);
    } catch (error) {
      if (mounted && revision == _revision) {
        setState(() => _error = portalError(error));
      }
    } finally {
      if (mounted && revision == _revision) setState(() => _loading = false);
    }
  }

  Future<void> _create(bool meeting) async {
    final session = context.read<AppState>();
    bool changed;
    if (meeting) {
      changed = await openRecordEditor(
        context,
        () => CatalogForms(
          widget.repository,
          actorId: session.authUser!.id,
          officeId: session.profile?.officeId,
        ).build(WorkspaceResource.meetings),
      );
    } else {
      changed = await editAppointment(
        context,
        widget.repository,
        officeId: session.profile?.officeId,
      );
    }
    if (changed && mounted) await _load();
  }

  Future<void> _open(Json row) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => WorkspaceDetail(
          repository: widget.repository,
          resource: row['_meeting'] == true
              ? WorkspaceResource.meetings
              : WorkspaceResource.appointments,
          record: row,
        ),
      ),
    );
    if (mounted) await _load();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Calendario')),
    body: SafeArea(
      child: PortalContent(
        onRefresh: _load,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton.icon(
                onPressed: () => _create(true),
                icon: const Icon(Icons.groups_outlined),
                label: const Text('Crear Reunión'),
              ),
              OutlinedButton.icon(
                onPressed: () => _create(false),
                icon: const Icon(Icons.event_outlined),
                label: const Text('Crear Cita'),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Card(
            child: SizedBox(
              height: MediaQuery.textScalerOf(context).scale(14) > 21
                  ? 410
                  : 350,
              child: CalendarDatePicker(
                key: ValueKey('${_month.year}-${_month.month}'),
                initialDate:
                    _day.year == _month.year && _day.month == _month.month
                    ? _day
                    : DateTime(_month.year, _month.month),
                firstDate: DateTime(2000),
                lastDate: DateTime(2100),
                onDateChanged: (date) {
                  setState(() {
                    _day = date;
                    _daily = true;
                  });
                  _load();
                },
                onDisplayedMonthChanged: (date) {
                  setState(() {
                    _month = date;
                    _day = DateTime(date.year, date.month);
                    _daily = false;
                  });
                  _load();
                },
              ),
            ),
          ),
          const SizedBox(height: 20),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ChoiceChip(
                label: const Text('Agenda del mes'),
                selected: !_daily,
                onSelected: (_) {
                  setState(() => _daily = false);
                  _load();
                },
              ),
              ChoiceChip(
                label: const Text('Agenda del día'),
                selected: _daily,
                onSelected: (_) {
                  setState(() => _daily = true);
                  _load();
                },
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_error != null) PortalError(_error!, onRetry: _load),
          if (_loading) const LinearProgressIndicator(),
          if (!_loading && _error == null && _items.isEmpty)
            const PortalEmpty(
              title: 'Sin compromisos',
              description:
                  'No hay citas ni reuniones en el periodo seleccionado.',
              icon: Icons.event_available_outlined,
            ),
          for (final row in _items)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Card(
                child: ListTile(
                  contentPadding: const EdgeInsets.all(16),
                  leading: Icon(
                    row['_meeting'] == true
                        ? Icons.groups_outlined
                        : Icons.event_outlined,
                  ),
                  title: Text(textValue(row['title'])),
                  subtitle: Text(
                    '${row['_meeting'] == true ? 'Reunión' : 'Cita'}${row['_meeting'] == true ? '' : ' · ${statusLabel(textValue(row['status']))}'} · ${localDate(textValue(row['startTime']))}\n${localDate(textValue(row['endTime']))}',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _open(row),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}
