import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../app_state.dart';
import '../brand.dart';
import 'access.dart';
import 'case_detail.dart';
import 'case_editor.dart';
import 'controllers.dart';
import 'models.dart';
import 'repository.dart';
import 'ui.dart';
import 'workspace_repository.dart';
import 'workspace_list.dart';
import 'workspace_menu.dart';
import 'profile_screen.dart';
import 'dashboard_screen.dart';
import 'notification_navigation.dart';
import 'session_refresh.dart';

enum EmployeeSection {
  dashboard('Panel de Control', Icons.dashboard_outlined),
  cases('Expedientes', Icons.folder_outlined),
  appointments('Citas', Icons.calendar_month_outlined),
  profile('Mi perfil', Icons.person_outline),
  more('Más', Icons.grid_view_outlined);

  const EmployeeSection(this.label, this.icon);
  final String label;
  final IconData icon;
}

class EmployeeAppShell extends StatefulWidget {
  const EmployeeAppShell({super.key, this.repository});
  final PortalRepository? repository;
  @override
  State<EmployeeAppShell> createState() => _EmployeeAppShellState();
}

class _EmployeeAppShellState extends State<EmployeeAppShell> {
  EmployeeSection _section = EmployeeSection.dashboard;
  late final PortalRepository _repository;
  late final CaseListController _cases;
  late final PortalRole _role;
  int? _officeId;
  late final WorkspaceRepository _workspace;
  late final AppState _session;
  late final EmployeeRefreshBinding _refreshBinding;
  @override
  void initState() {
    super.initState();
    final session = context.read<AppState>();
    _session = session;
    _refreshBinding = EmployeeRefreshBinding(session, _refresh);
    _role = session.role!;
    _workspace = HttpWorkspaceRepository(session.apiClient, _role);
    _officeId = session.profile?.officeId;
    _repository =
        widget.repository ?? HttpPortalRepository(session.apiClient, _role);
    _cases = CaseListController(_repository);
  }

  @override
  void dispose() {
    _refreshBinding.dispose();
    _cases.dispose();
    super.dispose();
  }

  void _refresh() {
    if (!mounted || !_session.isAuthenticated) return;
    if (_section == EmployeeSection.cases || _cases.items.isNotEmpty) {
      _cases.load();
    }
  }

  Future<void> _create() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CaseEditorScreen(
          repository: _repository,
          role: _role,
          officeId: _officeId,
        ),
      ),
    );
    if (created == true && mounted) {
      setState(() => _section = EmployeeSection.cases);
      await _cases.load();
    }
  }

  void _select(int index) {
    setState(() => _section = EmployeeSection.values[index]);
    if (_section == EmployeeSection.cases) _cases.load();
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<AppState>();
    final name =
        session.profile?.fullName ?? session.authUser?.fullName ?? 'Equipo CAF';
    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 840;
        final labels = MediaQuery.textScalerOf(context).scale(14) <= 21;
        final body = switch (_section) {
          EmployeeSection.dashboard => DashboardScreen(
            repository: _workspace,
            name: name,
            onCreate: _create,
            onCases: () => _select(1),
            onAppointments: () => _select(2),
          ),
          EmployeeSection.cases => _CasesList(
            workspace: _workspace,
            controller: _cases,
            repository: _repository,
            role: _role,
            officeId: _officeId,
          ),
          EmployeeSection.appointments => WorkspaceList(
            repository: _workspace,
            resource: WorkspaceResource.appointments,
            embedded: true,
          ),
          EmployeeSection.profile => ProfileScreen(repository: _workspace),
          EmployeeSection.more => WorkspaceMenu(repository: _workspace),
        };
        return Scaffold(
          appBar: AppBar(
            title: Text(_section.label, overflow: TextOverflow.ellipsis),
            actions: [
              IconButton(
                tooltip: 'Notificaciones',
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => _Notifications(
                      repository: _repository,
                      workspace: _workspace,
                    ),
                  ),
                ),
                icon: const Icon(Icons.notifications_outlined),
              ),
              IconButton(
                tooltip: 'Cerrar sesión',
                onPressed: () => _logout(session),
                icon: const Icon(Icons.logout),
              ),
            ],
          ),
          body: SafeArea(
            child: Row(
              children: [
                if (wide)
                  Container(
                    width: 240,
                    color: CafBrand.navyStrong,
                    child: ListView(
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'CAF',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 24,
                                ),
                              ),
                              const SizedBox(height: 16),
                              Text(
                                name,
                                style: const TextStyle(color: Colors.white),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _role.label,
                                style: const TextStyle(
                                  color: Color(0xFF94A3B8),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Padding(
                          padding: EdgeInsets.fromLTRB(20, 16, 20, 8),
                          child: Text(
                            'TRABAJO',
                            style: TextStyle(
                              color: Color(0xFF94A3B8),
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.6,
                            ),
                          ),
                        ),
                        ...EmployeeSection.values.indexed.map(
                          (entry) => Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            child: ListTile(
                              selected: _section == entry.$2,
                              selectedTileColor: const Color(0xFF102F3C),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              leading: Icon(
                                entry.$2.icon,
                                color: _section == entry.$2
                                    ? const Color(0xFF5EEAD4)
                                    : const Color(0xFFCBD5E1),
                              ),
                              title: Text(
                                entry.$2.label,
                                style: const TextStyle(
                                  color: Color(0xFFE2E8F0),
                                ),
                              ),
                              onTap: () => _select(entry.$1),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                Expanded(
                  child: KeyedSubtree(key: ValueKey(_section), child: body),
                ),
              ],
            ),
          ),
          floatingActionButton: _section == EmployeeSection.cases
              ? FloatingActionButton.extended(
                  onPressed: _create,
                  icon: const Icon(Icons.add),
                  label: const Text('Crear Caso'),
                )
              : null,
          bottomNavigationBar: wide
              ? null
              : NavigationBar(
                  selectedIndex: _section.index,
                  labelBehavior: labels
                      ? NavigationDestinationLabelBehavior.alwaysShow
                      : NavigationDestinationLabelBehavior.alwaysHide,
                  onDestinationSelected: _select,
                  destinations: [
                    for (final section in EmployeeSection.values)
                      NavigationDestination(
                        icon: Icon(section.icon),
                        label: section == EmployeeSection.dashboard
                            ? 'Inicio'
                            : section.label,
                      ),
                  ],
                ),
        );
      },
    );
  }

  Future<void> _logout(AppState session) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Cerrar sesión?'),
        content: const Text('Se cerrará su sesión en este dispositivo.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );
    if (confirmed == true) await session.logout();
  }
}

class _CasesList extends StatefulWidget {
  const _CasesList({
    required this.controller,
    required this.workspace,
    required this.repository,
    required this.role,
    this.officeId,
  });
  final CaseListController controller;
  final PortalRepository repository;
  final WorkspaceRepository workspace;
  final PortalRole role;
  final int? officeId;
  @override
  State<_CasesList> createState() => _CasesListState();
}

class _CasesListState extends State<_CasesList> {
  late final TextEditingController _search;
  @override
  void initState() {
    super.initState();
    _search = TextEditingController(text: widget.controller.query);
    if (widget.controller.items.isEmpty && !widget.controller.loading) {
      widget.controller.load();
    }
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, _) {
      final state = widget.controller;
      return PortalContent(
        onRefresh: () => state.load(),
        children: [
          Text(
            'Gestión de Casos',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            'Clientes y expedientes según sus permisos.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 24),
          TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              labelText: 'Buscar por cliente',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: IconButton(
                tooltip: 'Buscar',
                onPressed: () => state.load(search: _search.text),
                icon: const Icon(Icons.arrow_forward),
              ),
            ),
            onSubmitted: (value) => state.load(search: value),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ChoiceChip(
                label: const Text('Todos'),
                selected: state.status == null,
                onSelected: (_) => state.load(clearFilter: true),
              ),
              for (final status in ['open', 'in_progress', 'completed'])
                ChoiceChip(
                  label: Text(statusLabel(status)),
                  selected: state.status == status,
                  onSelected: (_) => state.load(filter: status),
                ),
            ],
          ),
          const SizedBox(height: 20),
          if (state.error != null)
            PortalError(
              state.error!,
              onRetry: () => state.load(reset: state.items.isEmpty),
            ),
          if (state.loading && state.items.isEmpty)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: CircularProgressIndicator()),
            ),
          if (!state.loading && state.error == null && state.items.isEmpty)
            const PortalEmpty(
              title: 'Sin expedientes',
              description:
                  'No hay expedientes que coincidan con esta búsqueda.',
            ),
          for (final record in state.items)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Card(
                child: InkWell(
                  borderRadius: BorderRadius.circular(18),
                  onTap: () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => CaseDetailScreen(
                          id: record.id,
                          workspace: widget.workspace,
                          repository: widget.repository,
                          role: widget.role,
                          officeId: widget.officeId,
                        ),
                      ),
                    );
                    if (mounted) await state.load();
                  },
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                record.title,
                                style: Theme.of(context).textTheme.titleMedium
                                    ?.copyWith(fontWeight: FontWeight.w700),
                              ),
                            ),
                            const Icon(Icons.chevron_right),
                          ],
                        ),
                        const SizedBox(height: 8),
                        if (record.clientName.isNotEmpty)
                          Text(record.clientName),
                        if (record.officeName.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              record.officeName,
                              style: const TextStyle(color: CafBrand.inkSoft),
                            ),
                          ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            StatusPill(record.status),
                            if (record.category.isNotEmpty)
                              Chip(label: Text(record.category)),
                            if (record.employment.isLinked)
                              Chip(
                                avatar: const Icon(
                                  Icons.factory_outlined,
                                  size: 16,
                                ),
                                label: Text(record.employment.factoryName),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          if (state.items.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                '${state.items.length} de ${state.total} expedientes',
                textAlign: TextAlign.center,
              ),
            ),
          if (state.hasMore)
            OutlinedButton(
              onPressed: state.loading ? null : () => state.load(reset: false),
              child: Text(state.loading ? 'Cargando…' : 'Cargar más'),
            ),
          const SizedBox(height: 88),
        ],
      );
    },
  );
}

class _Notifications extends StatelessWidget {
  const _Notifications({required this.repository, required this.workspace});
  final PortalRepository repository;
  final WorkspaceRepository workspace;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Notificaciones')),
    body: _RemoteSection<List<Json>>(
      key: ValueKey(
        context.select<AppState, int>((session) => session.employeeRevision),
      ),
      load: repository.notifications,
      builder: (context, rows, reload) => PortalContent(
        onRefresh: reload,
        children: [
          if (rows.isEmpty)
            const PortalEmpty(
              title: 'Sin notificaciones',
              description: 'No hay avisos por atender.',
              icon: Icons.notifications_none,
            ),
          for (final row in rows)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: PortalSection(
                title: textValue(row['message']),
                children: [
                  Text(localDate(textValue(row['createdAt']))),
                  if (textValue(row['link']).isNotEmpty)
                    TextButton.icon(
                      onPressed: () =>
                          openNotification(context, row, repository, workspace),
                      icon: const Icon(Icons.open_in_new),
                      label: const Text('Ver detalle'),
                    ),
                  if (row['isRead'] != true)
                    TextButton(
                      onPressed: () async {
                        try {
                          await repository.markRead([intValue(row['id'])!]);
                          await reload();
                        } catch (error) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(portalError(error))),
                            );
                          }
                        }
                      },
                      child: const Text('Marcar como leída'),
                    ),
                ],
              ),
            ),
        ],
      ),
    ),
  );
}

class _RemoteSection<T> extends StatefulWidget {
  const _RemoteSection({super.key, required this.load, required this.builder});
  final Future<T> Function() load;
  final Widget Function(BuildContext, T, Future<void> Function()) builder;
  @override
  State<_RemoteSection<T>> createState() => _RemoteSectionState<T>();
}

class _RemoteSectionState<T> extends State<_RemoteSection<T>> {
  late Future<T> _future;
  @override
  void initState() {
    super.initState();
    _future = widget.load();
  }

  Future<void> _reload() async {
    final future = widget.load();
    setState(() => _future = future);
    try {
      await future;
    } catch (_) {
      /* FutureBuilder displays the error and retry action. */
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<T>(
    future: _future,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const Center(child: CircularProgressIndicator());
      }
      if (snapshot.hasError) {
        return PortalContent(
          children: [
            PortalError(portalError(snapshot.error!), onRetry: _reload),
          ],
        );
      }
      return widget.builder(context, snapshot.data as T, _reload);
    },
  );
}
