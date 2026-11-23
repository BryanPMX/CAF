import 'models.dart';
import 'workspace_repository.dart';

/// The appointment API accepts UTC calendar dates; meetings accept instants.
/// Widen the appointment query for local offsets, then intersect exact instants.
Future<List<Json>> loadAgenda(
  WorkspaceRepository repository,
  DateTime from,
  DateTime to, {
  int? officeId,
}) async {
  final pages = await Future.wait([
    repository.list(
      WorkspaceResource.meetings,
      filters: {
        'dateFrom': from.toUtc().toIso8601String(),
        'dateTo': to.toUtc().toIso8601String(),
      },
    ),
    repository.list(
      WorkspaceResource.appointments,
      filters: {
        'dateFrom': from
            .toUtc()
            .subtract(const Duration(days: 1))
            .toIso8601String()
            .substring(0, 10),
        'dateTo': to
            .toUtc()
            .add(const Duration(days: 1))
            .toIso8601String()
            .substring(0, 10),
      },
    ),
  ]);
  final rows = [
    for (final row in pages[0].items) {...row, '_meeting': true},
    ...pages[1].items,
  ];
  rows.removeWhere((row) {
    final start = DateTime.tryParse(textValue(row['startTime']));
    final end = DateTime.tryParse(textValue(row['endTime']));
    final rowOffice = row['_meeting'] == true
        ? intValue(jsonObject(row['organizer'])['officeId'])
        : intValue(row['officeId']) ??
              intValue(jsonObject(row['office'])['id']);
    return start == null ||
        end == null ||
        !start.isBefore(to) ||
        !end.isAfter(from) ||
        (officeId != null && rowOffice != officeId);
  });
  rows.sort(
    (a, b) => DateTime.parse(
      a['startTime'],
    ).compareTo(DateTime.parse(b['startTime'])),
  );
  return rows;
}
