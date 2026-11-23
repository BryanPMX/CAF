import 'package:flutter/material.dart';
import 'catalog_forms.dart';
import 'controllers.dart';
import 'models.dart';
import 'private_files.dart';
import 'record_editor.dart';
import 'ui.dart';
import 'workspace_repository.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key, required this.repository});
  final WorkspaceRepository repository;
  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  Json _filters = {'period': 'monthly'}, _summary = {};
  List<Json> _rows = [];
  String _type = 'summary';
  String? _error;
  bool _loading = true, _exporting = false;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await widget.repository.report(_filters, _type);
      if (mounted) {
        setState(() {
          _summary = data;
          _rows = jsonRows(data['data']);
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = portalError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _filter() async {
    final changed = await openRecordEditor(
      context,
      () async => RecordForm(
        title: 'Filtros del reporte',
        initial: _filters,
        fields: [
          const RecordField(
            'period',
            'Periodo',
            kind: InputKind.choice,
            choices: [
              FieldChoice('weekly', 'Esta semana'),
              FieldChoice('monthly', 'Este mes'),
              FieldChoice('yearly', 'Este año'),
            ],
          ),
          const RecordField('dateFrom', 'Desde', kind: InputKind.dateTime),
          const RecordField('dateTo', 'Hasta', kind: InputKind.dateTime),
          RecordField(
            'department',
            'Departamento',
            kind: InputKind.choice,
            choices: caseTypes.keys.map((v) => FieldChoice(v, v)).toList(),
          ),
          if (widget.repository.role.allOffices)
            RecordField(
              'officeId',
              'Oficina',
              kind: InputKind.choice,
              choices: namedChoices(
                (await widget.repository.list(WorkspaceResource.offices)).items,
              ),
            ),
        ],
        validate: (v) {
          final from = DateTime.tryParse(textValue(v['dateFrom'])),
              to = DateTime.tryParse(textValue(v['dateTo']));
          return (from == null) != (to == null) ||
                  from != null && to != null && !to.isAfter(from)
              ? 'Seleccione un rango completo y válido.'
              : null;
        },
        save: (v) async {
          _filters = v;
        },
      ),
    );
    if (changed && mounted) await _load();
  }

  Future<void> _export() async {
    if (_exporting) return;
    setState(() => _exporting = true);
    try {
      final data = await widget.repository.exportReport(_filters, _type);
      if (!mounted) return;
      await PrivateFiles.open(data.bytes, 'caf-reporte-$_type.csv');
    } catch (error) {
      if (mounted) setState(() => _error = portalError(error));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Reportes'),
      actions: [
        IconButton(
          tooltip: 'Filtros',
          onPressed: _loading ? null : _filter,
          icon: const Icon(Icons.filter_list),
        ),
        IconButton(
          tooltip: 'Exportar CSV',
          onPressed: _loading || _exporting ? null : _export,
          icon: const Icon(Icons.download_outlined),
        ),
      ],
    ),
    body: PortalContent(
      onRefresh: _load,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final type in const [
              FieldChoice('summary', 'Resumen'),
              FieldChoice('cases', 'Casos'),
              FieldChoice('appointments', 'Citas'),
            ])
              ChoiceChip(
                label: Text(type.label),
                selected: _type == type.value,
                onSelected: _loading
                    ? null
                    : (_) {
                        _type = '${type.value}';
                        _load();
                      },
              ),
          ],
        ),
        const SizedBox(height: 20),
        if (_error != null) PortalError(_error!, onRetry: _load),
        if (_loading || _exporting) const LinearProgressIndicator(),
        if (!_loading && _error == null && _type == 'summary') ...[
          PortalSection(
            title: 'Resumen',
            children: [
              Text(
                'Casos: ${_summary['totalCases'] ?? 0}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              Text(
                'Citas: ${_summary['totalAppointments'] ?? 0}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ],
          ),
          for (final key in const [
            'casesByStatus',
            'casesByDepartment',
            'casesByStage',
            'appointmentsByStatus',
            'appointmentsByDepartment',
          ])
            PortalSection(
              title: _reportLabels[key]!,
              children: [
                for (final row in jsonRows(_summary[key]))
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      statusLabel(
                        textValue(
                          row['Status'] ?? row['Department'] ?? row['Stage'],
                        ),
                      ),
                    ),
                    trailing: Text(textValue(row['Count'])),
                  ),
              ],
            ),
        ],
        if (!_loading && _error == null && _type != 'summary')
          for (final row in _rows)
            PortalSection(
              title: textValue(row['title']),
              children: [
                Text(
                  [
                    textValue(row['clientName']),
                    textValue(row['staffName']),
                    textValue(row['officeName']),
                    statusLabel(textValue(row['status'])),
                    localDate(textValue(row['startTime'] ?? row['createdAt'])),
                  ].where((v) => v.isNotEmpty).join('\n'),
                ),
              ],
            ),
      ],
    ),
  );
}

const _reportLabels = {
  'casesByStatus': 'Casos por estado',
  'casesByDepartment': 'Casos por departamento',
  'casesByStage': 'Casos por etapa',
  'appointmentsByStatus': 'Citas por estado',
  'appointmentsByDepartment': 'Citas por departamento',
};
