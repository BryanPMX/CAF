import 'models.dart';

/// Presentation policy mirrors docs/ACCESS_CONTROL.md. The API remains the
/// authority for every record read and mutation; this never grants access.
enum PortalRole {
  technicalSupport('technical_support', 'Soporte Tecnico'),
  executiveDirector('executive_director', 'Director Ejecutivo'),
  administrator('admin', 'Administrador'),
  lawyer('lawyer', 'Abogado/a'),
  psychologist('psychologist', 'Psicólogo/a'),
  receptionist('receptionist', 'Recepcionista'),
  eventCoordinator('event_coordinator', 'Coordinador/a de Eventos'),
  client('client', 'Cliente');

  const PortalRole(this.value, this.label);
  final String value;
  final String label;

  static PortalRole? parse(String value) {
    for (final role in values) {
      if (role.value == value) return role;
    }
    return null;
  }

  bool get isEmployee => this != client;
  bool get allOffices => this == technicalSupport || this == executiveDirector;
  bool get isManagement => allOffices || this == administrator;
  bool get canManageOrganizations => isManagement;
  bool get canManageWebsite => allOffices;
  bool get canResetPasswords => this == technicalSupport;

  String get endpointPrefix {
    if (!isEmployee) throw StateError('El cliente no usa rutas de empleados.');
    return isManagement ? '/admin' : '/staff';
  }
}

/// Primary professionals manage their case; additional assignees retain the
/// desktop's task-completion and discussion controls.
bool canManageCase(PortalRole role, int? actorId, Json record) =>
    role.isManagement ||
    actorId != null &&
        (intValue(record['primaryStaffId']) ??
                intValue(jsonObject(record['primaryStaff'])['id'])) ==
            actorId;
