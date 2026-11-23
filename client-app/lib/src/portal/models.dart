import 'package:flutter/foundation.dart';

typedef Json = Map<String, dynamic>;
Json jsonObject(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};
List<Json> jsonRows(dynamic value) => value is List
    ? value.whereType<Map>().map(jsonObject).toList(growable: false)
    : const [];
String textValue(dynamic value) => value == null ? '' : value.toString();
int? intValue(dynamic value) =>
    value is num ? value.toInt() : int.tryParse(textValue(value));
String personName(Json value) => [
  textValue(value['firstName']),
  textValue(value['lastName']),
].where((part) => part.isNotEmpty).join(' ');

@immutable
class DirectoryOption {
  const DirectoryOption({
    required this.id,
    required this.name,
    this.email = '',
    this.officeId,
    this.company = false,
  });
  final int id;
  final String name;
  final String email;
  final int? officeId;
  final bool company;
  String get label => email.isEmpty ? name : '$name · $email';
  factory DirectoryOption.fromJson(Json value) => DirectoryOption(
    id: intValue(value['id']) ?? 0,
    name: textValue(value['name']).isNotEmpty
        ? textValue(value['name'])
        : personName(value),
    email: textValue(value['email']),
    officeId: intValue(value['officeId']),
    company: value['clientType'] == 'organization',
  );
}

@immutable
class Employment {
  const Employment({
    this.maquilaId,
    this.factoryName = '',
    this.employeeNumber = '',
    this.shiftName = '',
    this.shiftStart = '',
    this.shiftEnd = '',
  });
  final int? maquilaId;
  final String factoryName;
  final String employeeNumber;
  final String shiftName;
  final String shiftStart;
  final String shiftEnd;
  bool get isLinked => maquilaId != null;
  Json toJson() => {
    'maquilaId': maquilaId,
    'employeeNumber': isLinked ? employeeNumber.trim() : '',
    'shiftName': isLinked ? shiftName.trim() : '',
    'shiftStart': isLinked ? shiftStart : '',
    'shiftEnd': isLinked ? shiftEnd : '',
  };
  factory Employment.fromJson(Json value) => Employment(
    maquilaId:
        intValue(value['maquilaId']) ?? intValue(value['organizationId']),
    factoryName: textValue(
      jsonObject(value['maquila'] ?? value['organization'])['name'],
    ),
    employeeNumber: textValue(value['employeeNumber']),
    shiftName: textValue(value['shiftName']),
    shiftStart: textValue(value['shiftStart']),
    shiftEnd: textValue(value['shiftEnd']),
  );
  String? validate() {
    if (!isLinked) return null;
    if (employeeNumber.trim().isEmpty || shiftName.trim().isEmpty) {
      return 'Complete el número de empleado y el turno.';
    }
    final time = RegExp(r'^([01]\d|2[0-3]):[0-5]\d$');
    if ((shiftStart.isNotEmpty || shiftEnd.isNotEmpty) &&
        (!time.hasMatch(shiftStart) || !time.hasMatch(shiftEnd))) {
      return 'Capture ambos horarios en formato HH:mm o deje ambos vacíos.';
    }
    return null;
  }

  bool sameSnapshot(Employment other) => mapEquals(toJson(), other.toJson());
}

@immutable
class PortalCase {
  PortalCase(Json value) : data = Map.unmodifiable(value);
  final Json data;
  int get id => intValue(data['id']) ?? 0;
  int? get clientId => intValue(data['clientId']);
  int? get officeId => intValue(data['officeId']);
  String get title => textValue(data['title']);
  String get description => textValue(data['description']);
  String get category => textValue(data['category']);
  String get status => textValue(data['status']);
  String get currentStage => textValue(data['currentStage']);
  String get docketNumber => textValue(data['docketNumber']);
  String get court => textValue(data['court']);
  double get fee => double.tryParse(textValue(data['fee'])) ?? 0;
  String get clientName => personName(jsonObject(data['client']));
  String get officeName => textValue(jsonObject(data['office'])['name']);
  String get staffName => personName(jsonObject(data['primaryStaff']));
  Employment get employment => Employment.fromJson(data);
  List<Json> get events => jsonRows(data['caseEvents']);
  List<Json> get tasks => jsonRows(data['tasks']);
}

@immutable
class CasePage {
  const CasePage(this.items, this.total);
  final List<PortalCase> items;
  final int total;
}

const caseTypes = <String, List<String>>{
  'Familiar': [
    'Divorcios',
    'Guardia y Custodia',
    'Acto Prejudicial',
    'Adopcion',
    'Pension Alimenticia',
    'Rectificacion de Actas',
    'Reclamacion de Paternidad',
  ],
  'Civil': ['Prescripcion Positiva', 'Reinvindicatorio', 'Intestado'],
  'Psicologia': ['Individual', 'Pareja'],
  'Recursos': ['Tutoria Escolar', 'Asistencia Social'],
  'General': ['Otro'],
};
String departmentFor(String type) =>
    caseTypes.entries
        .where((entry) => entry.value.contains(type))
        .map((entry) => entry.key)
        .firstOrNull ??
    'General';
const caseStageLabels = {
  'intake': 'Recepción',
  'initial_consultation': 'Consulta Inicial',
  'document_review': 'Revisión de Documentos',
  'action_plan': 'Plan de Acción',
  'resolution': 'Resolución',
  'closed': 'Cerrado',
  'etapa_inicial': 'Etapa Inicial',
  'notificacion': 'Notificación',
  'audiencia_preliminar': 'Audiencia Preliminar',
  'audiencia_juicio': 'Audiencia de Juicio',
  'sentencia': 'Sentencia',
};

const statusLabels = {
  'open': 'Abierto',
  'in_progress': 'En proceso',
  'completed': 'Completado',
  'closed': 'Cerrado',
  'pending': 'Pendiente',
  'confirmed': 'Confirmada',
  'cancelled': 'Cancelada',
  'scheduled': 'Programada',
  'active': 'Activo',
  'resolved': 'Resuelto',
  'accepted': 'Aceptada',
  'tentative': 'Tentativa',
  'declined': 'Rechazada',
  'rescheduled': 'Reprogramada',
  'no-show': 'No se presentó',
  'manual_deletion': 'Eliminación manual',
  'client_visible': 'Visible para el cliente',
  'internal': 'Interno',
};
String statusLabel(String value) =>
    statusLabels[value] ??
    caseStageLabels[value] ??
    (value.isEmpty ? 'Sin especificar' : value.replaceAll('_', ' '));
String localDate(String value) {
  final date = DateTime.tryParse(value)?.toLocal();
  if (date == null) return 'Sin fecha';
  String two(int number) => number.toString().padLeft(2, '0');
  return '${two(date.day)}/${two(date.month)}/${date.year} · ${two(date.hour)}:${two(date.minute)}';
}

/// RFC3339 offset preserves the chosen device-local wall time for the API's
/// working-hours rules. UTC-only serialization would validate the wrong hour.
String localApiTime(String value) {
  final local = DateTime.parse(value).toLocal();
  final offset = local.timeZoneOffset;
  final minutes = offset.inMinutes.abs();
  return '${local.toIso8601String()}${offset.isNegative ? '-' : '+'}${(minutes ~/ 60).toString().padLeft(2, '0')}:${(minutes % 60).toString().padLeft(2, '0')}';
}
