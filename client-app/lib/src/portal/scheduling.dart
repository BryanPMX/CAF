import 'package:flutter/material.dart';
import '../app_state.dart';
import 'catalog_forms.dart';
import 'controllers.dart';
import 'models.dart';
import 'record_editor.dart';
import 'ui.dart';
import 'workspace_repository.dart';
import 'availability_picker.dart';

Future<bool> editAppointment(
  BuildContext context,
  WorkspaceRepository repository, {
  int? officeId,
  Json? record,
}) async {
  if (record == null) {
    return await Navigator.of(context).push<bool>(
          MaterialPageRoute(
            builder: (_) =>
                AppointmentSetup(repository: repository, officeId: officeId),
          ),
        ) ==
        true;
  }
  return openRecordEditor(context, () async {
    final fields = await _appointmentFields(repository, officeId: officeId);
    return RecordForm(
      title: 'Editar Cita',
      initial: record,
      fields: fields,
      validate: intervalError,
      save: (values) async {
        values['startTime'] = localApiTime(values['startTime']);
        values['endTime'] = localApiTime(values['endTime']);
        await repository.save(
          WorkspaceResource.appointments,
          values,
          id: intValue(record['id']),
        );
      },
    );
  });
}

Future<List<RecordField>> _appointmentFields(
  WorkspaceRepository repository, {
  int? officeId,
}) async => [
  const RecordField('title', 'Título', required: true),
  RecordField(
    'staffId',
    'Profesional',
    kind: InputKind.choice,
    required: true,
    choices: namedChoices(
      (await repository.employees())
          .where(
            (row) =>
                repository.role.allOffices ||
                intValue(row['officeId']) == officeId,
          )
          .toList(),
      key: 'person',
    ),
  ),
  const RecordField(
    'startTime',
    'Inicio',
    kind: InputKind.dateTime,
    required: true,
    section: 'Horario local',
  ),
  const RecordField(
    'endTime',
    'Fin',
    kind: InputKind.dateTime,
    required: true,
    section: 'Horario local',
  ),
  const RecordField(
    'status',
    'Estado',
    kind: InputKind.choice,
    required: true,
    choices: appointmentStatuses,
    section: 'Horario local',
  ),
];

class AppointmentSetup extends StatefulWidget {
  const AppointmentSetup({super.key, required this.repository, this.officeId});
  final WorkspaceRepository repository;
  final int? officeId;
  @override
  State<AppointmentSetup> createState() => _AppointmentSetupState();
}

class _AppointmentSetupState extends State<AppointmentSetup> {
  DirectoryOption? _client;
  String _mode = 'person';
  String? _error;
  final _first = TextEditingController(),
      _last = TextEditingController(),
      _email = TextEditingController();
  bool _loading = false;
  @override
  void dispose() {
    _first.dispose();
    _last.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _select() async {
    final value = await chooseRecord(
      context,
      title: 'Seleccionar cliente',
      load: (query) async => (await widget.repository.clients(
        query: query,
        companies: _mode == 'organization',
      )).map(DirectoryOption.fromJson).toList(),
    );
    if (value != null && mounted) setState(() => _client = value);
  }

  Future<void> _continue() async {
    if (_loading) return;
    if (_mode == 'new' &&
            (_first.text.trim().isEmpty ||
                _last.text.trim().isEmpty ||
                !RegExp(
                  r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                ).hasMatch(_email.text.trim())) ||
        _mode != 'new' && _client == null) {
      setState(() => _error = 'Complete los datos del cliente.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final repository = widget.repository;
    try {
      final cases = _client != null && _mode != 'organization'
          ? await repository.clientCases(_client!.id)
          : <Json>[];
      final offices = repository.role.isManagement
          ? (await repository.list(WorkspaceResource.offices)).items
          : <Json>[];
      final base = await _appointmentFields(
        repository,
        officeId: widget.officeId,
      );
      if (!mounted) return;
      final created = await openRecordEditor(
        context,
        () async => RecordForm(
          title: 'Crear Cita',
          supplement: (context, values, apply) => AvailabilityPicker(
            repository: repository,
            staffId: intValue(values['staffId']),
            value: DateTime.tryParse(textValue(values['startTime'])),
            onSelect: (from, to) => apply({
              'startTime': localApiTime(from.toIso8601String()),
              'endTime': localApiTime(to.toIso8601String()),
            }),
          ),
          description:
              'Las horas se muestran en la zona local del dispositivo. Seleccione un horario futuro. L–V 09:00–18:00; sábado 08:00–15:00.',
          initial: {
            'status': 'pending',
            'caseMode': cases.isEmpty ? 'new' : 'existing',
            'officeId': widget.officeId,
            'category': 'General',
          },
          fields: [
            ...base,
            if (_mode != 'organization')
              RecordField(
                'caseMode',
                'Expediente',
                kind: InputKind.choice,
                required: true,
                section: 'Expediente',
                choices: [
                  if (cases.isNotEmpty)
                    const FieldChoice('existing', 'Expediente existente'),
                  const FieldChoice('new', 'Crear expediente'),
                ],
              ),
            if (_mode != 'organization')
              RecordField(
                'caseId',
                'Caso',
                kind: InputKind.choice,
                required: true,
                section: 'Expediente',
                choices: namedChoices(cases, key: 'title'),
                visible: (v) => v['caseMode'] == 'existing',
              ),
            if (_mode != 'organization')
              RecordField(
                'newCaseTitle',
                'Tipo de Caso',
                kind: InputKind.choice,
                required: true,
                section: 'Expediente',
                choices: caseTypes.values
                    .expand((e) => e)
                    .map((e) => FieldChoice(e, e))
                    .toList(),
                visible: (v) => v['caseMode'] == 'new',
              ),
            if (_mode != 'organization')
              RecordField(
                'newCaseDescription',
                'Descripción Inicial',
                kind: InputKind.multiline,
                required: true,
                section: 'Expediente',
                visible: (v) => v['caseMode'] == 'new',
              ),
            RecordField(
              'officeId',
              'Oficina responsable',
              kind: InputKind.choice,
              required: repository.role.allOffices,
              readOnly: !repository.role.allOffices,
              choices: namedChoices(offices),
              section: 'Expediente',
              visible: (v) => _mode == 'organization' || v['caseMode'] == 'new',
            ),
            if (_mode == 'organization')
              RecordField(
                'category',
                'Departamento',
                kind: InputKind.choice,
                required: true,
                choices: caseTypes.keys.map((e) => FieldChoice(e, e)).toList(),
                section: 'Expediente',
              ),
          ],
          validate: intervalError,
          save: (values) async {
            final from = DateTime.parse(values['startTime']),
                to = DateTime.parse(values['endTime']);
            if (!from.isAfter(DateTime.now())) {
              throw ApiException('Seleccione un horario futuro.');
            }
            final busy = await repository.availability(
              values['staffId'],
              from,
              to,
            );
            if (busy.any(
              (slot) =>
                  DateTime.parse(slot['startTime']).isBefore(to) &&
                  DateTime.parse(slot['endTime']).isAfter(from),
            )) {
              throw ApiException(
                'El profesional ya tiene una cita o reunión en este horario. Seleccione otro.',
              );
            }
            final category = _mode == 'organization'
                ? values['category']
                : values['caseMode'] == 'new'
                ? departmentFor(values['newCaseTitle'])
                : cases.firstWhere(
                    (e) => e['id'] == values['caseId'],
                  )['category'];
            await repository.save(WorkspaceResource.appointments, {
              'title': values['title'],
              'staffId': values['staffId'],
              'startTime': localApiTime(values['startTime']),
              'endTime': localApiTime(values['endTime']),
              'status': values['status'],
              'category': category,
              'department': category,
              if (_mode == 'new')
                'newClient': {
                  'firstName': _first.text.trim(),
                  'lastName': _last.text.trim(),
                  'email': _email.text.trim(),
                }
              else
                'clientId': _client!.id,
              if (_mode == 'organization') ...{
                'withoutCase': true,
                'officeId': values['officeId'] ?? widget.officeId,
              } else if (values['caseMode'] == 'existing')
                'caseId': values['caseId']
              else
                'newCase': {
                  'title': values['newCaseTitle'],
                  'description': values['newCaseDescription'],
                  'officeId': values['officeId'] ?? widget.officeId,
                },
            });
          },
        ),
      );
      if (created && mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) setState(() => _error = portalError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Crear Cita')),
    body: SafeArea(
      child: PortalContent(
        children: [
          const Text(
            'Seleccione a quién atenderá antes de elegir el expediente y el horario.',
          ),
          const SizedBox(height: 20),
          if (_error != null) PortalError(_error!),
          PortalSection(
            title: 'Cliente',
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final option in const [
                    FieldChoice('person', 'Cliente Existente'),
                    FieldChoice('new', 'Cliente Nuevo'),
                    FieldChoice('organization', 'Constructora'),
                  ])
                    ChoiceChip(
                      label: Text(option.label),
                      selected: _mode == option.value,
                      onSelected: _loading
                          ? null
                          : (_) => setState(() {
                              _mode = '${option.value}';
                              _client = null;
                            }),
                    ),
                ],
              ),
              const SizedBox(height: 20),
              if (_mode == 'new')
                PortalFields(
                  children: [
                    TextField(
                      controller: _first,
                      decoration: const InputDecoration(
                        labelText: 'Nombre(s) *',
                      ),
                    ),
                    TextField(
                      controller: _last,
                      decoration: const InputDecoration(
                        labelText: 'Apellidos *',
                      ),
                    ),
                    TextField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Correo Electrónico *',
                      ),
                    ),
                  ],
                )
              else
                OutlinedButton.icon(
                  onPressed: _loading ? null : _select,
                  icon: const Icon(Icons.person_search_outlined),
                  label: Text(_client?.label ?? 'Seleccionar cliente'),
                ),
            ],
          ),
        ],
      ),
    ),
    bottomNavigationBar: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: FilledButton(
          onPressed: _loading ? null : _continue,
          child: Text(_loading ? 'Cargando…' : 'Continuar'),
        ),
      ),
    ),
  );
}
