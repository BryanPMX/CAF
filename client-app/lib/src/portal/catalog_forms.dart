import 'dart:convert';
import '../app_state.dart';
import 'access.dart';
import 'models.dart';
import 'record_editor.dart';
import 'workspace_repository.dart';

List<FieldChoice> namedChoices(List<Json> rows, {String key = 'name'}) => rows
    .map(
      (row) => FieldChoice(
        intValue(row['id'])!,
        key == 'person'
            ? '${personName(row)} · ${textValue(row['email'])}'
            : textValue(row[key]),
      ),
    )
    .toList();
const taskStatuses = [
  FieldChoice('pending', 'Pendiente'),
  FieldChoice('in_progress', 'En progreso'),
  FieldChoice('completed', 'Completada'),
  FieldChoice('cancelled', 'Cancelada'),
];
const appointmentStatuses = [
  FieldChoice('pending', 'Pendiente'),
  FieldChoice('confirmed', 'Confirmada'),
  FieldChoice('completed', 'Completada'),
  FieldChoice('cancelled', 'Cancelada'),
  FieldChoice('no-show', 'No se presentó'),
  FieldChoice('rescheduled', 'Reprogramada'),
];
const visibilityChoices = [
  FieldChoice('internal', 'Interno — solo equipo CAF'),
  FieldChoice('client_visible', 'Visible para el cliente'),
];

bool canEditUser(PortalRole actor, int? officeId, Json target) {
  if (!actor.isManagement) return false;
  if (target['role'] == 'technical_support') {
    return actor == PortalRole.technicalSupport;
  }
  if (actor.allOffices) return true;
  if (target['role'] == 'executive_director') return false;
  return officeId != null &&
      (intValue(target['officeId']) == officeId ||
          target['role'] == 'client' &&
              target['clientType'] == 'organization' &&
              target['officeId'] == null);
}

String? passwordError(Object? value, Json _) {
  final text = textValue(value);
  if (text.isEmpty) return null;
  if (text.length < 12 ||
      utf8.encode(text).length > 72 ||
      !RegExp('[a-z]').hasMatch(text) ||
      !RegExp('[A-Z]').hasMatch(text) ||
      !RegExp('[0-9]').hasMatch(text) ||
      !RegExp(r'[^a-zA-Z0-9]').hasMatch(text)) {
    return 'Use 12+ caracteres con mayúsculas, minúsculas, número y símbolo (máximo 72 bytes).';
  }
  return null;
}

String? intervalError(Json values) {
  final start = DateTime.tryParse(textValue(values['startTime']));
  final end = DateTime.tryParse(textValue(values['endTime']));
  return start == null || end == null || !end.isAfter(start)
      ? 'El fin debe ser posterior al inicio.'
      : null;
}

/// Explicit per-resource form definitions. The shared editor handles layout and
/// state; these definitions retain each domain's field allowlist and validation.
class CatalogForms {
  CatalogForms(
    this.repository, {
    this.officeId,
    required this.actorId,
    this.ownPasswordChanged,
  });
  final WorkspaceRepository repository;
  final int? officeId;
  final int actorId;
  final Future<void> Function()? ownPasswordChanged;
  Future<RecordForm> build(
    WorkspaceResource resource, {
    Json? record,
    int? caseId,
  }) async {
    final initial = <String, dynamic>{
      'isActive': true,
      'pinned': false,
      ...?record,
    };
    if (resource == WorkspaceResource.siteContent) {
      initial['contentType'] ??= 'text';
    }
    final id = intValue(record?['id']);
    var fields = <RecordField>[];
    final role = repository.role;
    var title = id == null ? 'Crear registro' : 'Editar registro';
    String? Function(Json)? validate;
    void Function(String, Json)? onChange;
    Future<void> Function(Json) save = (values) =>
        repository.save(resource, values, id: id);
    switch (resource) {
      case WorkspaceResource.users:
        if (record != null && !canEditUser(role, officeId, record)) {
          throw ApiException(
            'No tiene permiso para modificar esta cuenta.',
            statusCode: 403,
          );
        }
        title = id == null ? 'Crear Usuario' : 'Editar Usuario';
        final offices = (await repository.list(
          WorkspaceResource.offices,
        )).items;
        initial['officeId'] ??= officeId;
        initial['role'] ??= 'client';
        final membership = jsonRows(record?['organizationMemberships'])
            .where(
              (row) => jsonObject(row['organization'])['kind'] == 'maquila',
            )
            .firstOrNull;
        final employment = membership == null
            ? const Employment()
            : Employment.fromJson(membership);
        initial.addAll(employment.toJson());
        final company = record?['clientType'] == 'organization';
        fields = [
          const RecordField('firstName', 'Nombre(s)', required: true),
          RecordField('lastName', 'Apellidos', required: !company),
          RecordField(
            'email',
            'Correo Electrónico',
            kind: InputKind.email,
            required: !company,
          ),
          RecordField(
            'phone',
            'Teléfono',
            kind: InputKind.phone,
            required: !company,
          ),
          const RecordField(
            'personalAddress',
            'Domicilio personal',
            kind: InputKind.multiline,
          ),
          RecordField(
            'role',
            'Rol',
            kind: InputKind.choice,
            required: true,
            readOnly: record?['role'] == 'technical_support' || company,
            choices: [
              for (final option in PortalRole.values.where(
                (r) =>
                    r != PortalRole.technicalSupport &&
                        (role.allOffices || !r.allOffices) ||
                    r.value == record?['role'],
              ))
                FieldChoice(option.value, option.label),
            ],
          ),
          RecordField(
            'officeId',
            'Oficina',
            kind: InputKind.choice,
            required: true,
            readOnly: !role.allOffices,
            choices: namedChoices(offices),
            visible: (v) =>
                ![
                  'technical_support',
                  'executive_director',
                ].contains(v['role']) &&
                v['clientType'] != 'organization',
          ),
          RecordField(
            'specialty',
            'Especialidad',
            visible: (v) => ['lawyer', 'psychologist'].contains(v['role']),
          ),
          if (id == null || role.canResetPasswords)
            RecordField(
              'password',
              id == null ? 'Contraseña inicial' : 'Nueva contraseña (opcional)',
              kind: InputKind.password,
              required: id == null,
              validate: passwordError,
            ),
        ];
        fields.addAll([
          RecordField(
            'maquilaId',
            'Maquila',
            kind: InputKind.choice,
            section: 'Datos de maquila',
            choices: [
              if (employment.maquilaId != null)
                FieldChoice(employment.maquilaId!, employment.factoryName),
            ],
            search: (q) async => namedChoices(
              (await repository.list(
                WorkspaceResource.factories,
                query: q,
              )).items,
            ),
            visible: (v) => v['role'] == 'client' && !company,
          ),
          for (final field in const [
            RecordField(
              'employeeNumber',
              'Número de Empleado',
              required: true,
              maxLength: 100,
            ),
            RecordField('shiftName', 'Turno', required: true, maxLength: 100),
            RecordField('shiftStart', 'Inicio del turno (HH:mm)'),
            RecordField('shiftEnd', 'Fin del turno (HH:mm)'),
          ])
            RecordField(
              field.key,
              field.label,
              required: field.required,
              maxLength: field.maxLength,
              section: 'Datos de maquila',
              visible: (v) =>
                  v['role'] == 'client' && !company && v['maquilaId'] != null,
            ),
        ]);
        onChange = (key, values) {
          if (key == 'role') {
            values['specialty'] = '';
          }
        };
        save = (values) async {
          if (textValue(values['password']).isEmpty) values.remove('password');
          if ([
                'technical_support',
                'executive_director',
              ].contains(values['role']) ||
              record?['clientType'] == 'organization') {
            values.remove('officeId');
          }
          if (!['lawyer', 'psychologist'].contains(values['role'])) {
            values['specialty'] = '';
          }
          if (values['role'] == 'client' && !company) {
            final current = Employment(
              maquilaId: intValue(values.remove('maquilaId')),
              employeeNumber: textValue(values.remove('employeeNumber')),
              shiftName: textValue(values.remove('shiftName')),
              shiftStart: textValue(values.remove('shiftStart')),
              shiftEnd: textValue(values.remove('shiftEnd')),
            );
            final error = current.validate();
            if (error != null) throw ApiException(error);
            if (id == null || !current.sameSnapshot(employment)) {
              values['employment'] = current.toJson();
            }
          }
          await repository.save(resource, values, id: id);
          if (id == actorId && textValue(values['password']).isNotEmpty) {
            await ownPasswordChanged?.call();
          }
        };
      case WorkspaceResource.offices:
        if (id == null && !role.allOffices) {
          throw ApiException('Solo puede editar su oficina.', statusCode: 403);
        }
        title = id == null ? 'Crear Oficina' : 'Editar Oficina';
        fields = [
          const RecordField('name', 'Nombre', required: true),
          const RecordField('address', 'Dirección', kind: InputKind.multiline),
          const RecordField(
            'phoneOffice',
            'Teléfono de Oficina',
            kind: InputKind.phone,
          ),
          const RecordField(
            'phoneCell',
            'Teléfono Celular',
            kind: InputKind.phone,
          ),
          RecordField(
            'latitude',
            'Latitud',
            kind: InputKind.number,
            validate: (v, _) =>
                v != null &&
                    textValue(v).isNotEmpty &&
                    (num.tryParse('$v') ?? 91).abs() > 90
                ? 'Latitud entre -90 y 90.'
                : null,
          ),
          RecordField(
            'longitude',
            'Longitud',
            kind: InputKind.number,
            validate: (v, _) =>
                v != null &&
                    textValue(v).isNotEmpty &&
                    (num.tryParse('$v') ?? 181).abs() > 180
                ? 'Longitud entre -180 y 180.'
                : null,
          ),
        ];
      case WorkspaceResource.factories || WorkspaceResource.contractors:
        final company = resource == WorkspaceResource.contractors;
        initial['kind'] = company ? 'contractor' : 'maquila';
        title =
            '${id == null ? 'Crear' : 'Editar'} ${company ? 'Constructora' : 'Maquila'}';
        fields = [
          const RecordField('name', 'Nombre', required: true, maxLength: 255),
          const RecordField(
            'legalAddress',
            'Domicilio Legal',
            kind: InputKind.multiline,
            required: true,
            maxLength: 255,
          ),
          RecordField(
            'legalRepresentative',
            'Representante Legal',
            required: company,
            maxLength: 255,
          ),
          RecordField(
            'boardPresident',
            'Presidente de Mesa Directiva',
            required: company,
            maxLength: 255,
          ),
          RecordField(
            'neighborhood',
            'Colonia',
            required: company,
            maxLength: 255,
          ),
          if (company) ...[
            const RecordField(
              'email',
              'Correo Electrónico',
              kind: InputKind.email,
              maxLength: 255,
            ),
            const RecordField(
              'phone',
              'Teléfono',
              kind: InputKind.phone,
              maxLength: 50,
            ),
          ],
        ];
        save = (values) => repository.save(resource, {
          ...values,
          'kind': initial['kind'],
        }, id: id);
      case WorkspaceResource.tasks:
        title = id == null ? 'Crear Tarea' : 'Editar Tarea';
        initial['assignedToId'] ??= jsonObject(record?['assignedTo'])['id'];
        initial['status'] ??= 'pending';
        fields = [
          if (caseId == null && id == null)
            RecordField(
              'caseId',
              'Expediente',
              kind: InputKind.choice,
              required: true,
              search: (q) async => namedChoices(
                (await repository.caseOptions(
                  q,
                )).where((row) => canManageCase(role, actorId, row)).toList(),
                key: 'title',
              ),
            ),
          const RecordField('title', 'Título', required: true),
          RecordField(
            'assignedToId',
            'Asignar a',
            kind: InputKind.choice,
            choices: namedChoices(await repository.employees(), key: 'person'),
          ),
          const RecordField(
            'dueDate',
            'Fecha límite',
            kind: InputKind.dateTime,
          ),
          if (id != null)
            const RecordField(
              'status',
              'Estado',
              kind: InputKind.choice,
              required: true,
              choices: taskStatuses,
            ),
        ];
        save = (values) => repository.save(resource, {
          ...values,
          if (id == null) 'caseId': caseId ?? values['caseId'],
        }, id: id);
      case WorkspaceResource.meetings:
        title = id == null ? 'Crear Reunión' : 'Editar Reunión';
        final staff = await repository.employees();
        final people = await repository.clients();
        final companies = await repository.clients(companies: true);
        initial['attendeeIds'] = jsonRows(
          record?['attendees'],
        ).map((r) => r['userId']).toList();
        initial['relatedClientIds'] = jsonRows(
          record?['relatedClients'],
        ).map((r) => r['clientId']).toList();
        fields = [
          const RecordField('title', 'Título', required: true, maxLength: 200),
          const RecordField(
            'description',
            'Descripción',
            kind: InputKind.multiline,
            maxLength: 2000,
          ),
          const RecordField('location', 'Ubicación', maxLength: 255),
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
          RecordField(
            'attendeeIds',
            'Participantes',
            kind: InputKind.multiple,
            choices: namedChoices(staff, key: 'person'),
            section: 'Participantes',
          ),
          RecordField(
            'relatedClientIds',
            'Clientes relacionados',
            kind: InputKind.multiple,
            choices: namedChoices([
              ...people,
              ...companies,
              ...jsonRows(
                record?['relatedClients'],
              ).map((r) => jsonObject(r['client'])),
            ], key: 'person'),
            search: (q) async => namedChoices([
              ...await repository.clients(query: q),
              ...await repository.clients(query: q, companies: true),
            ], key: 'person'),
            section: 'Participantes',
          ),
        ];
        validate = intervalError;
      case WorkspaceResource.notes:
        title = id == null ? 'Crear Nota' : 'Editar Nota';
        fields = [
          const RecordField(
            'bodyText',
            'Nota',
            kind: InputKind.multiline,
            required: true,
          ),
          const RecordField('pinned', 'Fijar nota', kind: InputKind.toggle),
        ];
      case WorkspaceResource.announcements:
        fields = [
          const RecordField('title', 'Título', required: true),
          const RecordField('bodyHtml', 'Contenido', kind: InputKind.multiline),
          const RecordField('pinned', 'Fijar anuncio', kind: InputKind.toggle),
          const RecordField(
            'startAt',
            'Publicar desde',
            kind: InputKind.dateTime,
          ),
          const RecordField(
            'endAt',
            'Publicar hasta',
            kind: InputKind.dateTime,
          ),
          RecordField(
            'visibleRoles',
            'Roles destinatarios',
            kind: InputKind.multiple,
            choices: PortalRole.values
                .where((r) => r.isEmployee)
                .map((r) => FieldChoice(r.value, r.label))
                .toList(),
          ),
          const RecordField(
            'visibleDepartments',
            'Departamentos (uno por línea)',
            kind: InputKind.lines,
          ),
          const RecordField(
            'images',
            'Imágenes (URL por línea)',
            kind: InputKind.lines,
          ),
          const RecordField(
            'tags',
            'Etiquetas (una por línea)',
            kind: InputKind.lines,
          ),
        ];
      case WorkspaceResource.siteContent:
        fields = [
          RecordField(
            'section',
            'Sección',
            required: true,
            readOnly: id != null,
          ),
          RecordField(
            'contentKey',
            'Identificador del contenido',
            required: true,
            readOnly: id != null,
          ),
          const RecordField(
            'contentValue',
            'Contenido',
            kind: InputKind.multiline,
          ),
          const RecordField(
            'contentType',
            'Tipo',
            kind: InputKind.choice,
            choices: [
              FieldChoice('text', 'Texto'),
              FieldChoice('html', 'HTML'),
              FieldChoice('image_url', 'Imagen (URL)'),
            ],
          ),
          ..._publishing,
        ];
      case WorkspaceResource.siteServices:
        fields = [
          const RecordField('title', 'Título', required: true),
          const RecordField(
            'description',
            'Descripción',
            kind: InputKind.multiline,
          ),
          const RecordField(
            'details',
            'Detalles (uno por línea)',
            kind: InputKind.lines,
          ),
          const RecordField('icon', 'Ícono'),
          const RecordField('imageUrl', 'URL de imagen'),
          ..._publishing,
        ];
      case WorkspaceResource.siteEvents:
        fields = [
          const RecordField('title', 'Título', required: true),
          const RecordField(
            'description',
            'Descripción',
            kind: InputKind.multiline,
          ),
          const RecordField('location', 'Ubicación'),
          const RecordField(
            'eventDate',
            'Inicio',
            kind: InputKind.dateTime,
            required: true,
          ),
          const RecordField('endDate', 'Fin', kind: InputKind.dateTime),
          const RecordField('imageUrl', 'URL de imagen'),
          const RecordField('isActive', 'Publicado', kind: InputKind.toggle),
        ];
      case WorkspaceResource.siteImages:
        fields = [
          const RecordField('title', 'Título'),
          const RecordField('altText', 'Texto alternativo', required: true),
          const RecordField('imageUrl', 'URL de imagen', required: true),
          const RecordField('section', 'Sección', required: true),
          ..._publishing,
        ];
      case WorkspaceResource.appointments ||
          WorkspaceResource.archivedCases ||
          WorkspaceResource.archivedAppointments:
        throw ArgumentError('Use el flujo especializado de este recurso.');
    }
    if (resource == WorkspaceResource.meetings) {
      final operation = save;
      save = (values) {
        values['startTime'] = localApiTime(values['startTime']);
        values['endTime'] = localApiTime(values['endTime']);
        return operation(values);
      };
    }
    return RecordForm(
      title: title,
      fields: fields,
      initial: initial,
      save: save,
      validate: validate,
      onChange: onChange,
    );
  }

  static final _publishing = [
    const RecordField(
      'sortOrder',
      'Orden',
      kind: InputKind.number,
      validate: nonNegativeInteger,
    ),
    const RecordField('isActive', 'Publicado', kind: InputKind.toggle),
  ];
}

String? nonNegativeInteger(Object? value, Json _) =>
    textValue(value).isEmpty ||
        int.tryParse(textValue(value)) != null &&
            int.parse(textValue(value)) >= 0
    ? null
    : 'Ingrese un número entero mayor o igual a cero.';
