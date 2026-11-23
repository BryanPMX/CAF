import 'package:flutter/material.dart';
import 'reports_screen.dart';
import 'calendar_screen.dart';
import 'metrics_screen.dart';
import 'ui.dart';
import 'workspace_list.dart';
import 'workspace_repository.dart';

class WorkspaceMenu extends StatelessWidget {
  const WorkspaceMenu({super.key, required this.repository});
  final WorkspaceRepository repository;
  @override
  Widget build(BuildContext context) => PortalContent(
    children: [
      Text(
        'Espacio de trabajo',
        style: Theme.of(context).textTheme.headlineSmall,
      ),
      const SizedBox(height: 20),
      for (final group in <String, List<WorkspaceResource>>{
        'Trabajo diario': [
          WorkspaceResource.meetings,
          WorkspaceResource.tasks,
          WorkspaceResource.notes,
          WorkspaceResource.announcements,
        ],
        if (repository.role.isManagement)
          'Administración': [
            WorkspaceResource.users,
            WorkspaceResource.offices,
            WorkspaceResource.factories,
            WorkspaceResource.contractors,
            WorkspaceResource.archivedCases,
            WorkspaceResource.archivedAppointments,
          ],
        if (repository.role.canManageWebsite)
          'Sitio Web': [
            WorkspaceResource.siteContent,
            WorkspaceResource.siteServices,
            WorkspaceResource.siteEvents,
            WorkspaceResource.siteImages,
          ],
      }.entries)
        PortalSection(
          title: group.key,
          children: [
            for (final resource in group.value)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(resourceTitle(resource)),
                leading: Icon(_icon(resource)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => resource == WorkspaceResource.meetings
                        ? CalendarScreen(repository: repository)
                        : WorkspaceList(
                            repository: repository,
                            resource: resource,
                          ),
                  ),
                ),
              ),
          ],
        ),
      if (repository.role.isManagement)
        PortalSection(
          title: 'Análisis',
          children: [
            if (repository.role.allOffices)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Indicadores acumulados'),
                leading: const Icon(Icons.query_stats),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => MetricsScreen(repository: repository),
                  ),
                ),
              ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Reportes'),
              leading: const Icon(Icons.insights),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => ReportsScreen(repository: repository),
                ),
              ),
            ),
          ],
        ),
    ],
  );
}

IconData _icon(WorkspaceResource resource) => switch (resource) {
  WorkspaceResource.meetings => Icons.calendar_month_outlined,
  WorkspaceResource.tasks => Icons.task_alt,
  WorkspaceResource.notes => Icons.note_outlined,
  WorkspaceResource.users => Icons.people_outline,
  WorkspaceResource.offices => Icons.business_outlined,
  WorkspaceResource.factories => Icons.factory_outlined,
  WorkspaceResource.contractors => Icons.construction_outlined,
  WorkspaceResource.archivedCases ||
  WorkspaceResource.archivedAppointments => Icons.archive_outlined,
  _ => Icons.web_outlined,
};
