import 'dart:async';
import 'dart:io';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import 'app_state.dart';
import 'brand.dart';

enum ClientSection {
  dashboard,
  notifications,
  myCase,
  appointments,
  payments,
  contact,
}

extension ClientSectionX on ClientSection {
  String get label {
    switch (this) {
      case ClientSection.dashboard:
        return 'Inicio';
      case ClientSection.notifications:
        return 'Notificaciones';
      case ClientSection.myCase:
        return 'Mi Caso';
      case ClientSection.appointments:
        return 'Citas';
      case ClientSection.payments:
        return 'Pagos';
      case ClientSection.contact:
        return 'Contacto';
    }
  }

  IconData get icon {
    switch (this) {
      case ClientSection.dashboard:
        return Icons.dashboard_outlined;
      case ClientSection.notifications:
        return Icons.notifications_outlined;
      case ClientSection.myCase:
        return Icons.folder_outlined;
      case ClientSection.appointments:
        return Icons.event_outlined;
      case ClientSection.payments:
        return Icons.receipt_long_outlined;
      case ClientSection.contact:
        return Icons.support_agent_outlined;
    }
  }
}

class ClientAppShell extends StatefulWidget {
  const ClientAppShell({super.key});

  @override
  State<ClientAppShell> createState() => _ClientAppShellState();
}

class _ClientAppShellState extends State<ClientAppShell>
    with WidgetsBindingObserver {
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  final AppLinks _appLinks = AppLinks();
  ClientSection _section = ClientSection.dashboard;
  StreamSubscription<Uri>? _deepLinkSub;
  DateTime? _lastResumePaymentsRefreshAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_initDeepLinks());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _deepLinkSub?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed || !mounted) return;
    final now = DateTime.now();
    final last = _lastResumePaymentsRefreshAt;
    if (last != null && now.difference(last) < const Duration(seconds: 2)) {
      return;
    }
    _lastResumePaymentsRefreshAt = now;
    final appState = context.read<AppState>();
    if (appState.isAuthenticated) {
      unawaited(appState.refreshPaymentsAfterExternalCheckout(silent: true));
    }
  }

  Future<void> _initDeepLinks() async {
    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) {
        await _handleIncomingDeepLink(initial);
      }
    } catch (_) {
      // Ignore malformed initial links.
    }

    _deepLinkSub = _appLinks.uriLinkStream.listen(
      (uri) {
        unawaited(_handleIncomingDeepLink(uri));
      },
      onError: (_) {
        // Ignore stream errors; manual refresh still works.
      },
    );
  }

  Future<void> _handleIncomingDeepLink(Uri uri) async {
    final paymentStatus = AppConfig.parseStripeCheckoutReturnUri(uri);
    if (paymentStatus == null) return;

    if (mounted) {
      setState(() => _section = ClientSection.payments);
    }

    final appState = context.read<AppState>();
    final result = await appState.handleStripeCheckoutReturn(
      paymentStatus,
      uri: uri,
    );
    if (!mounted || result == null || result.isEmpty) return;

    final isSuccess = paymentStatus == StripeCheckoutReturnStatus.success;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(result),
        backgroundColor: isSuccess ? Colors.green.shade700 : null,
      ),
    );
  }

  Future<void> _refresh(AppState state) async {
    try {
      await state.refreshAll();
    } catch (_) {
      if (!mounted) return;
      final message =
          state.errorMessage ?? 'No fue posible actualizar la información';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(message),
            backgroundColor: Theme.of(context).colorScheme.error),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final theme = Theme.of(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth >= 1080;

        return Scaffold(
          key: _scaffoldKey,
          appBar: AppBar(
            title: Text(_section.label),
            leading: isWide
                ? null
                : IconButton(
                    icon: const Icon(Icons.menu),
                    onPressed: () => _scaffoldKey.currentState?.openDrawer(),
                  ),
            actions: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Tooltip(
                  message: state.isRealtimeConnected
                      ? 'Tiempo real conectado'
                      : 'Tiempo real desconectado',
                  child: Icon(
                    state.isRealtimeConnected
                        ? Icons.circle
                        : Icons.circle_outlined,
                    color: state.isRealtimeConnected
                        ? Colors.green
                        : theme.colorScheme.outline,
                    size: 16,
                  ),
                ),
              ),
              if (state.isRefreshing)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  child: Center(
                    child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2)),
                  ),
                )
              else
                IconButton(
                  tooltip: 'Actualizar',
                  onPressed: () => _refresh(state),
                  icon: const Icon(Icons.refresh),
                ),
              IconButton(
                tooltip: 'Cerrar sesión',
                onPressed: () async {
                  final messenger = ScaffoldMessenger.of(context);
                  await state.logout();
                  if (!mounted) return;
                  messenger.clearSnackBars();
                },
                icon: const Icon(Icons.logout),
              ),
              const SizedBox(width: 4),
            ],
          ),
          drawer: isWide
              ? null
              : _AppDrawer(
                  current: _section, onSelect: _onSelectSection, state: state),
          body: Row(
            children: [
              if (isWide)
                _AppRail(
                    current: _section,
                    onSelect: _onSelectSection,
                    unreadCount: state.unreadNotifications),
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        theme.colorScheme.surface,
                        CafBrand.pageBg.withValues(alpha: 0.72),
                      ],
                    ),
                  ),
                  child: Column(
                    children: [
                      if (state.errorMessage != null &&
                          state.errorMessage!.isNotEmpty)
                        Material(
                          color: theme.colorScheme.errorContainer,
                          child: ListTile(
                            dense: true,
                            leading: Icon(Icons.info_outline,
                                color: theme.colorScheme.onErrorContainer),
                            title: Text(
                              state.errorMessage!,
                              style: TextStyle(
                                  color: theme.colorScheme.onErrorContainer),
                            ),
                            trailing: IconButton(
                              onPressed: state.clearError,
                              icon: Icon(Icons.close,
                                  color: theme.colorScheme.onErrorContainer),
                            ),
                          ),
                        ),
                      Expanded(
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 200),
                          child: KeyedSubtree(
                            key: ValueKey(_section),
                            child: _buildSection(context, state, _section),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _onSelectSection(ClientSection section) {
    if (_section == section) {
      Navigator.of(context).maybePop();
      return;
    }
    setState(() => _section = section);
    Navigator.of(context).maybePop();
  }

  Widget _buildSection(
      BuildContext context, AppState state, ClientSection section) {
    switch (section) {
      case ClientSection.dashboard:
        return _DashboardSection(state: state);
      case ClientSection.notifications:
        return _NotificationsSection(state: state);
      case ClientSection.myCase:
        return _MyCaseSection(state: state);
      case ClientSection.appointments:
        return _AppointmentsSection(state: state);
      case ClientSection.payments:
        return _PaymentsSection(state: state);
      case ClientSection.contact:
        return _ContactSection(state: state);
    }
  }
}

class _AppDrawer extends StatelessWidget {
  const _AppDrawer({
    required this.current,
    required this.onSelect,
    required this.state,
  });

  final ClientSection current;
  final void Function(ClientSection section) onSelect;
  final AppState state;

  @override
  Widget build(BuildContext context) {
    final profile = state.profile;
    final name = profile?.fullName.isNotEmpty == true
        ? profile!.fullName
        : (state.authUser?.fullName ?? 'Cliente CAF');
    final email = profile?.email.isNotEmpty == true
        ? profile!.email
        : (state.authUser?.email ?? '');

    return Drawer(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      child: SafeArea(
        child: Container(
          decoration: BoxDecoration(
            gradient: CafBrand.sidebarGradient,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.18),
                blurRadius: 28,
                offset: const Offset(10, 0),
              ),
            ],
          ),
          child: Column(
            children: [
              Container(
                margin: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0x39C7D4E9)),
                  color: Colors.white.withValues(alpha: 0.05),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      padding: const EdgeInsets.all(5),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        color: Colors.white.withValues(alpha: 0.95),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.5),
                        ),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.asset('mobile-app-icon.png'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'CAF Cliente',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xFFE2E8F0),
                              fontSize: 12,
                            ),
                          ),
                          if (email.isNotEmpty)
                            Text(
                              email,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Color(0xFF94A3B8),
                                fontSize: 11,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(10, 4, 10, 12),
                  children: [
                    for (final section in ClientSection.values)
                      _DrawerNavItem(
                        section: section,
                        selected: current == section,
                        unreadNotifications: state.unreadNotifications,
                        onTap: () => onSelect(section),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AppRail extends StatelessWidget {
  const _AppRail({
    required this.current,
    required this.onSelect,
    required this.unreadCount,
  });

  final ClientSection current;
  final void Function(ClientSection section) onSelect;
  final int unreadCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 96,
      decoration: BoxDecoration(
        gradient: CafBrand.sidebarGradient,
        border: Border(
          right: BorderSide(color: Colors.black.withValues(alpha: 0.16)),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 18,
            offset: const Offset(8, 0),
          ),
        ],
      ),
      child: SafeArea(
        child: Column(
          children: [
            Container(
              margin: const EdgeInsets.fromLTRB(10, 10, 10, 8),
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0x39C7D4E9)),
                color: Colors.white.withValues(alpha: 0.05),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.asset(
                  'mobile-app-icon.png',
                  width: 42,
                  height: 42,
                  fit: BoxFit.cover,
                ),
              ),
            ),
            Expanded(
              child: NavigationRail(
                selectedIndex: ClientSection.values.indexOf(current),
                onDestinationSelected: (index) =>
                    onSelect(ClientSection.values[index]),
                labelType: NavigationRailLabelType.all,
                minWidth: 88,
                groupAlignment: -0.85,
                backgroundColor: Colors.transparent,
                indicatorColor: Colors.transparent,
                leading: const SizedBox.shrink(),
                destinations: [
                  for (final section in ClientSection.values)
                    NavigationRailDestination(
                      icon: _RailIcon(
                        section: section,
                        unreadCount: unreadCount,
                        selected: false,
                      ),
                      selectedIcon: _RailIcon(
                        section: section,
                        unreadCount: unreadCount,
                        selected: true,
                      ),
                      label: Text(section.label),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DrawerNavItem extends StatelessWidget {
  const _DrawerNavItem({
    required this.section,
    required this.selected,
    required this.unreadNotifications,
    required this.onTap,
  });

  final ClientSection section;
  final bool selected;
  final int unreadNotifications;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: selected ? CafBrand.actionGradient : null,
          color: selected ? null : Colors.white.withValues(alpha: 0.03),
          border: Border.all(
            color: selected
                ? Colors.white.withValues(alpha: 0.14)
                : Colors.transparent,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: CafBrand.cyan.withValues(alpha: 0.18),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
                  ),
                ]
              : null,
        ),
        child: ListTile(
          dense: true,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          leading: _NavIconWithBadge(
            section: section,
            unreadCount: unreadNotifications,
            iconColor: selected ? Colors.white : const Color(0xFFCBD5E1),
          ),
          title: Text(
            section.label,
            style: TextStyle(
              color: selected ? Colors.white : const Color(0xFFE2E8F0),
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
          onTap: onTap,
        ),
      ),
    );
  }
}

class _RailIcon extends StatelessWidget {
  const _RailIcon({
    required this.section,
    required this.unreadCount,
    required this.selected,
  });

  final ClientSection section;
  final int unreadCount;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final icon = _NavIconWithBadge(
      section: section,
      unreadCount: unreadCount,
      iconColor: selected ? Colors.white : const Color(0xFFCBD5E1),
    );
    if (!selected) return icon;

    return Container(
      width: 42,
      height: 36,
      decoration: BoxDecoration(
        gradient: CafBrand.actionGradient,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: CafBrand.cyan.withValues(alpha: 0.16),
            blurRadius: 14,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Center(child: icon),
    );
  }
}

class _NavIconWithBadge extends StatelessWidget {
  const _NavIconWithBadge({
    required this.section,
    required this.unreadCount,
    required this.iconColor,
  });

  final ClientSection section;
  final int unreadCount;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    final showBadge = section == ClientSection.notifications && unreadCount > 0;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Icon(section.icon, color: iconColor),
        if (showBadge)
          Positioned(
            right: -8,
            top: -6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
              decoration: BoxDecoration(
                color: const Color(0xFFD6455D),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white.withValues(alpha: 0.6)),
              ),
              constraints: const BoxConstraints(minWidth: 16),
              child: Text(
                '$unreadCount',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _DashboardSection extends StatelessWidget {
  const _DashboardSection({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final nextAppt = state.nextAppointment;
    final cs = Theme.of(context).colorScheme;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _MetricCard(
              title: 'Casos',
              value: '${state.cases.length}',
              subtitle: 'Seguimiento activo',
              icon: Icons.folder_open,
              color: cs.primary,
            ),
            _MetricCard(
              title: 'No leídas',
              value: '${state.unreadNotifications}',
              subtitle: 'Notificaciones',
              icon: Icons.notifications_active_outlined,
              color: Colors.orange,
            ),
            _MetricCard(
              title: 'Citas',
              value: '${state.appointments.length}',
              subtitle: 'Registradas',
              icon: Icons.event_note_outlined,
              color: Colors.teal,
            ),
            _MetricCard(
              title: 'Pagos',
              value: _currency(state.totalCaseFees),
              subtitle: 'Monto referencial por casos',
              icon: Icons.receipt_long_outlined,
              color: Colors.indigo,
            ),
          ],
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Próxima cita',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 10),
                if (nextAppt == null)
                  const Text('No hay citas futuras disponibles.')
                else ...[
                  Text(nextAppt.title,
                      style: Theme.of(context)
                          .textTheme
                          .titleSmall
                          ?.copyWith(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(
                      '${_dateTimeLabel(nextAppt.startTime)} • ${_appointmentStatusLabel(nextAppt.status).toUpperCase()}'),
                  if (nextAppt.caseTitle.isNotEmpty) const SizedBox(height: 4),
                  if (nextAppt.caseTitle.isNotEmpty)
                    Text('Caso: ${nextAppt.caseTitle}'),
                  if (nextAppt.staffName.isNotEmpty)
                    Text('Profesional: ${nextAppt.staffName}'),
                  if (nextAppt.officeName.isNotEmpty)
                    Text('Oficina: ${nextAppt.officeName}'),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Actividad reciente',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 10),
                if (state.notifications.isEmpty)
                  const Text('No hay actividad reciente.')
                else
                  ...state.notifications.take(5).map(
                        (n) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                          leading: Icon(n.isRead
                              ? Icons.mark_email_read_outlined
                              : Icons.mark_email_unread_outlined),
                          title: Text(n.message,
                              maxLines: 2, overflow: TextOverflow.ellipsis),
                          subtitle: Text(_dateTimeLabel(n.createdAt)),
                        ),
                      ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          state.lastSyncAt == null
              ? 'Sin sincronización'
              : 'Última sincronización: ${_dateTimeLabel(state.lastSyncAt)}',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _NotificationsSection extends StatelessWidget {
  const _NotificationsSection({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Recibe avisos cuando el equipo de CAF actualice tu caso.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
              const SizedBox(width: 12),
              OutlinedButton(
                onPressed: state.unreadNotifications > 0
                    ? state.markAllNotificationsAsRead
                    : null,
                child: const Text('Marcar todas'),
              ),
            ],
          ),
        ),
        Expanded(
          child: state.notifications.isEmpty
              ? const Center(child: Text('Sin notificaciones por ahora.'))
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: state.notifications.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final item = state.notifications[index];
                    return Card(
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: item.isRead
                              ? Colors.grey.shade200
                              : Colors.blue.shade50,
                          child: Icon(
                            item.isRead
                                ? Icons.done_all_outlined
                                : Icons.notifications_active_outlined,
                            color: item.isRead
                                ? Colors.grey.shade700
                                : Colors.blue.shade700,
                          ),
                        ),
                        title: Text(item.message),
                        subtitle: Text(_dateTimeLabel(item.createdAt)),
                        trailing: item.isRead
                            ? null
                            : TextButton(
                                onPressed: () =>
                                    state.markNotificationAsRead(item.id),
                                child: const Text('Leída'),
                              ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _MyCaseSection extends StatelessWidget {
  const _MyCaseSection({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    if (state.cases.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('Aún no hay casos asignados a tu cuenta.'),
            ),
          ),
        ],
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth >= 980;

        final listPane = Card(
          margin: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Text('Mis casos',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ),
              Expanded(
                child: ListView.separated(
                  itemCount: state.cases.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final item = state.cases[index];
                    final selected = item.id == state.selectedCaseId;
                    return ListTile(
                      selected: selected,
                      leading: Icon(
                          selected ? Icons.folder_open : Icons.folder_outlined),
                      title: Text(
                          item.title.isEmpty ? 'Caso #${item.id}' : item.title),
                      subtitle: Text(
                        [
                          _caseStatusLabel(item.status),
                          if (item.category.isNotEmpty)
                            _categoryLabel(item.category),
                        ].join(' • '),
                      ),
                      trailing: item.currentStage.isNotEmpty
                          ? Chip(
                              label: Text(_caseStageLabel(item.currentStage)),
                              visualDensity: VisualDensity.compact)
                          : null,
                      onTap: () {
                        unawaited(_selectCase(context, state, item.id));
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );

        final detailPane = _CaseDetailPanel(state: state);

        if (!isWide) {
          return ListView(
            padding: const EdgeInsets.only(bottom: 16),
            children: [
              SizedBox(height: 320, child: listPane),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: detailPane,
              ),
            ],
          );
        }

        return Row(
          children: [
            SizedBox(width: 380, child: listPane),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(0, 16, 16, 16),
                child: detailPane,
              ),
            ),
          ],
        );
      },
    );
  }

  Future<void> _selectCase(
      BuildContext context, AppState state, int caseId) async {
    try {
      await state.selectCase(caseId);
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content:
                Text(state.errorMessage ?? 'No fue posible abrir el caso')),
      );
    }
  }
}

class _CaseDetailPanel extends StatelessWidget {
  const _CaseDetailPanel({required this.state});

  final AppState state;

  Future<void> _openCaseDocument(
    BuildContext context,
    CaseTimelineEvent event, {
    required bool download,
  }) async {
    final messenger = ScaffoldMessenger.of(context);
    final fileData = await state.fetchCaseDocument(
      eventId: event.id,
      fallbackFileName: event.fileName,
      download: download,
    );
    if (!context.mounted) return;
    if (fileData == null) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            state.errorMessage ??
                (download
                    ? 'No se pudo descargar el documento'
                    : 'No se pudo abrir el documento'),
          ),
        ),
      );
      return;
    }

    final baseDir = download
        ? await getApplicationDocumentsDirectory()
        : await getTemporaryDirectory();
    if (!context.mounted) return;

    final folder = Directory(
      '${baseDir.path}/${download ? 'documentos_caf' : 'documentos_caf_tmp'}',
    );
    await folder.create(recursive: true);

    final safeName = _safeFileName(fileData.fileName, fallbackId: event.id);
    final filePath = '${folder.path}/${download ? '' : 'preview_'}$safeName';
    final localFile = File(filePath);
    await localFile.writeAsBytes(fileData.bytes, flush: true);

    if (download) {
      messenger.showSnackBar(
        SnackBar(
          content: Text('Documento guardado: $safeName'),
          action: SnackBarAction(
            label: 'Abrir',
            onPressed: () {
              unawaited(OpenFilex.open(localFile.path));
            },
          ),
        ),
      );
      return;
    }

    await OpenFilex.open(localFile.path);
  }

  @override
  Widget build(BuildContext context) {
    final selectedId = state.selectedCaseId;
    final detail = state.selectedCaseDetail;

    if (selectedId == null) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('Selecciona un caso para ver el detalle.'),
        ),
      );
    }

    if (detail == null || detail.summary.id != selectedId) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    final summary = detail.summary;

    return Card(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(summary.title.isEmpty ? 'Caso #${summary.id}' : summary.title,
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                Chip(
                    label: Text('Estado: ${_caseStatusLabel(summary.status)}')),
                if (summary.category.isNotEmpty)
                  Chip(
                    label:
                        Text('Categoría: ${_categoryLabel(summary.category)}'),
                  ),
                if (summary.currentStage.isNotEmpty)
                  Chip(
                    label:
                        Text('Etapa: ${_caseStageLabel(summary.currentStage)}'),
                  ),
                if (summary.priority.isNotEmpty)
                  Chip(
                    label:
                        Text('Prioridad: ${_priorityLabel(summary.priority)}'),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if (summary.description.isNotEmpty)
              Text(summary.description,
                  style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 16),
            _InfoGrid(detail: detail),
            const SizedBox(height: 20),
            _CaseMessageComposer(caseId: summary.id),
            const SizedBox(height: 20),
            Text('Mensajes y documentos visibles',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            if (detail.events.isEmpty)
              const Text(
                  'No hay mensajes/documentos visibles para cliente todavía.')
            else
              ...detail.events.map(
                (event) => Card(
                  elevation: 0,
                  color: Theme.of(context)
                      .colorScheme
                      .surfaceContainerHighest
                      .withValues(alpha: 0.35),
                  child: ListTile(
                    leading: Icon(event.isDocument
                        ? Icons.attach_file
                        : Icons.chat_bubble_outline),
                    onTap: event.isDocument
                        ? () => unawaited(
                              _openCaseDocument(
                                context,
                                event,
                                download: false,
                              ),
                            )
                        : null,
                    title: Text(
                      event.isDocument
                          ? (event.fileName.isEmpty
                              ? 'Documento'
                              : event.fileName)
                          : event.commentText,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      [
                        if (event.authorName.isNotEmpty) event.authorName,
                        if (event.createdAt != null)
                          _dateTimeLabel(event.createdAt),
                        if (event.isDocument && event.fileType.isNotEmpty)
                          event.fileType,
                      ].join(' • '),
                    ),
                    trailing: event.isDocument
                        ? PopupMenuButton<String>(
                            tooltip: 'Acciones del documento',
                            onSelected: (value) {
                              if (value == 'ver') {
                                unawaited(
                                  _openCaseDocument(
                                    context,
                                    event,
                                    download: false,
                                  ),
                                );
                                return;
                              }
                              if (value == 'descargar') {
                                unawaited(
                                  _openCaseDocument(
                                    context,
                                    event,
                                    download: true,
                                  ),
                                );
                              }
                            },
                            itemBuilder: (context) => const [
                              PopupMenuItem<String>(
                                value: 'ver',
                                child: Text('Ver'),
                              ),
                              PopupMenuItem<String>(
                                value: 'descargar',
                                child: Text('Descargar'),
                              ),
                            ],
                          )
                        : null,
                  ),
                ),
              ),
            const SizedBox(height: 20),
            Text('Citas relacionadas',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            if (detail.appointments.isEmpty)
              const Text('No hay citas ligadas a este caso.')
            else
              ...detail.appointments.map(
                (appt) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.event_outlined),
                  title: Text(
                      appt.title.isEmpty ? 'Cita #${appt.id}' : appt.title),
                  subtitle: Text(
                      '${_dateTimeLabel(appt.startTime)} • ${_appointmentStatusLabel(appt.status)}'),
                  trailing: appt.category.isNotEmpty
                      ? Chip(label: Text(_categoryLabel(appt.category)))
                      : null,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CaseMessageComposer extends StatefulWidget {
  const _CaseMessageComposer({required this.caseId});

  final int caseId;

  @override
  State<_CaseMessageComposer> createState() => _CaseMessageComposerState();
}

class _CaseMessageComposerState extends State<_CaseMessageComposer> {
  final _controller = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;

    setState(() => _sending = true);
    final appState = context.read<AppState>();
    final result = await appState.sendCaseMessage(
      caseId: widget.caseId,
      comment: text,
    );
    if (!mounted) return;

    setState(() => _sending = false);
    if (result == null) {
      _controller.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Mensaje enviado al equipo CAF.')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(result),
            backgroundColor: Theme.of(context).colorScheme.error),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Enviar mensaje',
                style: Theme.of(context)
                    .textTheme
                    .titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(
              'Tu mensaje se agregará al historial del caso y notificará al equipo de CAF.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _controller,
              minLines: 2,
              maxLines: 5,
              textInputAction: TextInputAction.newline,
              decoration: const InputDecoration(
                hintText: 'Escribe tu mensaje...',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.icon(
                onPressed: _sending ? null : _submit,
                icon: _sending
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send_outlined),
                label: const Text('Enviar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoGrid extends StatelessWidget {
  const _InfoGrid({required this.detail});

  final CaseDetail detail;

  @override
  Widget build(BuildContext context) {
    final items = <MapEntry<String, String>>[
      MapEntry('Oficina', detail.office?.name ?? detail.summary.officeName),
      MapEntry('Profesional',
          detail.primaryStaff?.name ?? detail.summary.primaryStaffName),
      MapEntry('Monto (referencial)', _currency(detail.summary.fee)),
    ].where((e) => e.value.trim().isNotEmpty).toList(growable: false);

    if (items.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: items
          .map(
            (e) => SizedBox(
              width: 260,
              child: Card(
                elevation: 0,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(e.key, style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 6),
                      Text(e.value,
                          style: Theme.of(context)
                              .textTheme
                              .titleSmall
                              ?.copyWith(fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              ),
            ),
          )
          .toList(growable: false),
    );
  }
}

class _AppointmentsSection extends StatelessWidget {
  const _AppointmentsSection({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    if (state.appointments.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('No hay citas disponibles.'),
            ),
          ),
        ],
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: state.appointments.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final appt = state.appointments[index];
        return Card(
          child: ListTile(
            leading: const Icon(Icons.calendar_month_outlined),
            title: Text(appt.title.isEmpty ? 'Cita #${appt.id}' : appt.title),
            subtitle: Text(
              [
                _dateTimeLabel(appt.startTime),
                if (appt.caseTitle.isNotEmpty) 'Caso: ${appt.caseTitle}',
                if (appt.staffName.isNotEmpty) 'Profesional: ${appt.staffName}',
              ].join('\n'),
            ),
            isThreeLine: true,
            trailing: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Chip(label: Text(_appointmentStatusLabel(appt.status))),
                if (appt.category.isNotEmpty)
                  Text(
                    _categoryLabel(appt.category),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _PaymentsSection extends StatelessWidget {
  const _PaymentsSection({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final feeCases =
        state.cases.where((c) => c.fee > 0).toList(growable: false);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          color: Theme.of(context)
              .colorScheme
              .secondaryContainer
              .withValues(alpha: 0.45),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Pagos y Recibos',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                const Text(
                  'Los pagos se generan desde el API usando Stripe Checkout (hospedado). La app nunca maneja llaves secretas.',
                ),
                if (!state.paymentsConfigured &&
                    (state.paymentsMessage?.isNotEmpty ?? false)) ...[
                  const SizedBox(height: 10),
                  Text(
                    state.paymentsMessage!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: const Icon(Icons.account_balance_wallet_outlined),
            title: const Text('Total referencial por casos'),
            subtitle: const Text('Basado en el campo `fee` de casos.'),
            trailing: Text(
              _currency(state.totalCaseFees),
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text('Cargos disponibles',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        if (feeCases.isEmpty)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('No hay montos de casos disponibles para pago.'),
            ),
          )
        else
          ...feeCases.map(
            (c) => Card(
              child: ListTile(
                leading: const Icon(Icons.payments_outlined),
                title: Text(c.title.isEmpty ? 'Caso #${c.id}' : c.title),
                subtitle: Text([
                  if (c.status.isNotEmpty)
                    'Estado: ${_caseStatusLabel(c.status)}',
                  if (c.currentStage.isNotEmpty)
                    'Etapa: ${_caseStageLabel(c.currentStage)}',
                ].join('\n')),
                isThreeLine: c.currentStage.isNotEmpty,
                trailing: ConstrainedBox(
                  constraints: const BoxConstraints(minWidth: 120),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(_currency(c.fee),
                          style: Theme.of(context)
                              .textTheme
                              .titleSmall
                              ?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      FilledButton.tonal(
                        onPressed: state.paymentsConfigured
                            ? () => _startCheckout(context, state, c.id)
                            : null,
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          visualDensity: VisualDensity.compact,
                        ),
                        child: const Text('Pagar'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: Text('Recibos',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700)),
            ),
            TextButton.icon(
              onPressed: () async {
                try {
                  await state.loadPaymentReceipts();
                } catch (_) {
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content: Text(state.errorMessage ??
                            'No se pudieron actualizar los recibos')),
                  );
                }
              },
              icon: const Icon(Icons.refresh),
              label: const Text('Actualizar'),
            ),
          ],
        ),
        const SizedBox(height: 6),
        if (!state.paymentsConfigured)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(state.paymentsMessage ??
                  'Pagos no configurados en el servidor.'),
            ),
          )
        else if (state.paymentReceipts.isEmpty)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                  'No hay recibos todavía. Después de pagar, aparecerán aquí.'),
            ),
          )
        else
          ...state.paymentReceipts.map(
            (r) => Card(
              child: ListTile(
                leading: Icon(r.paid
                    ? Icons.receipt_long_outlined
                    : Icons.pending_actions_outlined),
                title: Text(r.description.isNotEmpty
                    ? r.description
                    : 'Recibo ${r.id}'),
                subtitle: Text([
                  '${r.currency} ${_currency(r.amount)}',
                  if (r.caseId != null && r.caseId! > 0) 'Caso #${r.caseId}',
                  _dateTimeLabel(r.createdAt),
                ].join('\n')),
                isThreeLine: true,
                trailing: r.receiptUrl.isNotEmpty
                    ? TextButton(
                        onPressed: () => _openReceipt(context, r.receiptUrl),
                        child: const Text('Abrir'),
                      )
                    : Chip(label: Text(_paymentStatusLabel(r.status))),
              ),
            ),
          ),
      ],
    );
  }

  Future<void> _startCheckout(
      BuildContext context, AppState state, int caseId) async {
    final url = await state.createCheckoutForCase(caseId);
    if (!context.mounted) return;
    if (url == null || url.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(state.errorMessage ??
                state.paymentsMessage ??
                'No se pudo iniciar el pago')),
      );
      return;
    }
    final uri = Uri.tryParse(url);
    if (uri == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('URL de pago inválida')),
      );
      return;
    }
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!context.mounted) return;
    if (!launched) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo abrir Stripe Checkout')),
      );
    }
  }

  Future<void> _openReceipt(BuildContext context, String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!context.mounted) return;
    if (!launched) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo abrir el recibo')),
      );
    }
  }
}

class _ContactSection extends StatelessWidget {
  const _ContactSection({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final primaryStaff = state.selectedCaseDetail?.primaryStaff;
    final office = state.selectedCaseDetail?.office;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Contacto CAF',
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Text(
          'Información de contacto de tu atención y oficinas disponibles.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 12),
        if (primaryStaff != null)
          Card(
            child: ListTile(
              leading: const Icon(Icons.person_outline),
              title: Text(primaryStaff.name.isEmpty
                  ? 'Profesional asignado'
                  : primaryStaff.name),
              subtitle: Text([
                if (primaryStaff.role.isNotEmpty) _roleLabel(primaryStaff.role),
                if (primaryStaff.email.isNotEmpty) primaryStaff.email,
                if (primaryStaff.phone.isNotEmpty) primaryStaff.phone,
              ].join('\n')),
              isThreeLine: true,
            ),
          ),
        if (office != null)
          Card(
            child: ListTile(
              leading: const Icon(Icons.location_on_outlined),
              title: Text(office.name),
              subtitle: Text([
                if (office.address.isNotEmpty) office.address,
                if (office.phoneOffice.isNotEmpty)
                  'Oficina: ${office.phoneOffice}',
                if (office.phoneCell.isNotEmpty) 'Celular: ${office.phoneCell}',
              ].join('\n')),
              isThreeLine: true,
            ),
          ),
        const SizedBox(height: 12),
        Text('Otras oficinas',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        if (state.offices.isEmpty)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('No hay oficinas disponibles para mostrar.'),
            ),
          )
        else
          ...state.offices.map(
            (o) => Card(
              child: ListTile(
                leading: const Icon(Icons.apartment_outlined),
                title: Text(o.name.isEmpty ? 'Oficina #${o.id}' : o.name),
                subtitle: Text([
                  if (o.address.isNotEmpty) o.address,
                  if (o.phoneOffice.isNotEmpty) 'Oficina: ${o.phoneOffice}',
                  if (o.phoneCell.isNotEmpty) 'Celular: ${o.phoneCell}',
                ].join('\n')),
                isThreeLine: true,
              ),
            ),
          ),
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.color,
  });

  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 220, maxWidth: 280),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: color.withValues(alpha: 0.12),
                child: Icon(icon, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.bodySmall),
                    const SizedBox(height: 2),
                    Text(value,
                        style: Theme.of(context)
                            .textTheme
                            .titleLarge
                            ?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(subtitle,
                        style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _dateTimeLabel(DateTime? value) {
  if (value == null) return 'Sin fecha';
  final local = value.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(local.day)}/${two(local.month)}/${local.year} ${two(local.hour)}:${two(local.minute)}';
}

String _currency(double amount) {
  return '\$${amount.toStringAsFixed(2)}';
}

String _safeFileName(String value, {required int fallbackId}) {
  final trimmed = value.trim();
  final cleaned = trimmed
      .replaceAll(RegExp(r'[\\/:*?"<>|]'), '_')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
  if (cleaned.isNotEmpty) return cleaned;
  return 'documento_$fallbackId';
}

String _caseStatusLabel(String value) => _translateValue(value, const {
      'open': 'Abierto',
      'opened': 'Abierto',
      'active': 'Activo',
      'in_progress': 'En proceso',
      'pending': 'Pendiente',
      'completed': 'Completado',
      'closed': 'Cerrado',
      'cancelled': 'Cancelado',
      'canceled': 'Cancelado',
      'archived': 'Archivado',
    });

String _appointmentStatusLabel(String value) => _translateValue(value, const {
      'scheduled': 'Programada',
      'confirmed': 'Confirmada',
      'pending': 'Pendiente',
      'completed': 'Completada',
      'cancelled': 'Cancelada',
      'canceled': 'Cancelada',
      'rescheduled': 'Reprogramada',
      'no_show': 'No asistió',
      'in_progress': 'En curso',
    });

String _paymentStatusLabel(String value) => _translateValue(value, const {
      'paid': 'Pagado',
      'pending': 'Pendiente',
      'unpaid': 'No pagado',
      'open': 'Abierto',
      'processing': 'Procesando',
      'failed': 'Fallido',
      'expired': 'Expirado',
      'canceled': 'Cancelado',
      'cancelled': 'Cancelado',
      'refunded': 'Reembolsado',
      'succeeded': 'Exitoso',
    });

String _caseStageLabel(String value) => _translateValue(value, const {
      'intake': 'Ingreso',
      'assessment': 'Valoración',
      'evaluation': 'Evaluación',
      'planning': 'Planificación',
      'treatment_plan': 'Plan de atención',
      'active': 'Activo',
      'follow_up': 'Seguimiento',
      'review': 'Revisión',
      'closure': 'Cierre',
      'closed': 'Cerrado',
      'documentation': 'Documentación',
    });

String _priorityLabel(String value) => _translateValue(value, const {
      'low': 'Baja',
      'medium': 'Media',
      'high': 'Alta',
      'urgent': 'Urgente',
      'critical': 'Crítica',
    });

String _categoryLabel(String value) {
  if (value.trim().isEmpty) return 'Sin categoría';
  return _translateValue(value, const {
    'legal': 'Legal',
    'psychology': 'Psicología',
    'psychological': 'Psicológica',
    'social_work': 'Trabajo social',
    'therapy': 'Terapia',
    'family_therapy': 'Terapia familiar',
    'counseling': 'Orientación',
    'administrative': 'Administrativo',
    'general': 'General',
  });
}

String _roleLabel(String value) => _translateValue(value, const {
      'admin': 'Administrador',
      'office_manager': 'Gerente de oficina',
      'manager': 'Gerente',
      'staff': 'Personal',
      'client': 'Cliente',
      'psychologist': 'Psicólogo/a',
      'lawyer': 'Abogado/a',
      'social_worker': 'Trabajador/a social',
      'therapist': 'Terapeuta',
    });

String _translateValue(String value, Map<String, String> overrides) {
  final raw = value.trim();
  if (raw.isEmpty) return 'Sin estado';

  final key = raw
      .replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]}_${m[2]}')
      .replaceAll('-', '_')
      .replaceAll(' ', '_')
      .toLowerCase();

  final translated = overrides[key];
  if (translated != null && translated.isNotEmpty) return translated;

  final humanized = key
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1))
      .join(' ');
  return humanized.isNotEmpty ? humanized : raw;
}
