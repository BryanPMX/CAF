import 'package:flutter/material.dart';
import 'case_detail.dart';
import 'models.dart';
import 'repository.dart';
import 'workspace_detail.dart';
import 'workspace_list.dart';
import 'workspace_repository.dart';
import 'calendar_screen.dart';

/// Only known internal destinations are navigable; notification links never
/// become browser URLs and never carry credentials to another host.
Future<void> openNotification(
  BuildContext context,
  Json notice,
  PortalRepository cases,
  WorkspaceRepository workspace,
) async {
  final uri = Uri.tryParse(textValue(notice['link']));
  if (uri == null || uri.hasScheme || uri.hasAuthority) return;
  final segments = uri.pathSegments;
  if (segments.length < 2 || segments[0] != 'app') return;
  final section = segments[1],
      id = segments.length > 2
          ? int.tryParse(segments[2])
          : intValue(notice['entityId']);
  if (section == 'cases' && id != null) {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CaseDetailScreen(
          id: id,
          repository: cases,
          role: workspace.role,
          workspace: workspace,
        ),
      ),
    );
    return;
  }
  final resource = switch (section) {
    'users' when workspace.role.isManagement => WorkspaceResource.users,
    'appointments' => WorkspaceResource.appointments,
    'tasks' => WorkspaceResource.tasks,
    'calendar' => WorkspaceResource.meetings,
    'maquilas' when workspace.role.isManagement => WorkspaceResource.factories,
    'constructoras' when workspace.role.isManagement =>
      WorkspaceResource.contractors,
    _ => null,
  };
  if (resource == null) return;
  if (id == null || resource == WorkspaceResource.meetings) {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => resource == WorkspaceResource.meetings
            ? CalendarScreen(repository: workspace)
            : WorkspaceList(repository: workspace, resource: resource),
      ),
    );
  } else {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => WorkspaceDetail(
          repository: workspace,
          resource: resource,
          record: {'id': id},
        ),
      ),
    );
  }
}
