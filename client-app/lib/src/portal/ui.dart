import 'dart:async';
import 'package:flutter/material.dart';
import '../brand.dart';
import 'controllers.dart';
import 'models.dart';

class PortalContent extends StatelessWidget {
  const PortalContent({super.key, required this.children, this.onRefresh});
  final List<Widget> children;
  final Future<void> Function()? onRefresh;
  @override
  Widget build(BuildContext context) {
    final list = ListView(
      padding: const EdgeInsets.all(20),
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1040),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: children,
            ),
          ),
        ),
      ],
    );
    return onRefresh == null
        ? list
        : RefreshIndicator(onRefresh: onRefresh!, child: list);
  }
}

class PortalSection extends StatelessWidget {
  const PortalSection({
    super.key,
    required this.title,
    this.description,
    required this.children,
    this.optional = false,
  });
  final String title;
  final String? description;
  final List<Widget> children;
  final bool optional;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 24),
    child: Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              children: [
                Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                if (optional)
                  const Text(
                    'Opcional',
                    style: TextStyle(color: CafBrand.inkSoft, fontSize: 12),
                  ),
              ],
            ),
            if (description != null) ...[
              const SizedBox(height: 6),
              Text(
                description!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: CafBrand.inkSoft,
                  height: 1.5,
                ),
              ),
            ],
            const SizedBox(height: 20),
            ...children,
          ],
        ),
      ),
    ),
  );
}

class PortalFields extends StatelessWidget {
  const PortalFields({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, size) {
      final columns =
          size.maxWidth >= 560 &&
              MediaQuery.textScalerOf(context).scale(14) <= 21
          ? 2
          : 1;
      return Wrap(
        spacing: 16,
        runSpacing: 18,
        children: children
            .map(
              (child) => SizedBox(
                width: (size.maxWidth - (columns - 1) * 16) / columns,
                child: child,
              ),
            )
            .toList(),
      );
    },
  );
}

class PortalError extends StatelessWidget {
  const PortalError(this.message, {super.key, this.onRetry});
  final String message;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            message,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onErrorContainer,
            ),
          ),
          if (onRetry != null)
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Reintentar'),
            ),
        ],
      ),
    ),
  );
}

class PortalEmpty extends StatelessWidget {
  const PortalEmpty({
    super.key,
    required this.title,
    required this.description,
    this.icon = Icons.folder_open_outlined,
  });
  final String title, description;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 32),
    child: Column(
      children: [
        Icon(icon, size: 40, color: CafBrand.inkSoft),
        const SizedBox(height: 12),
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 6),
        Text(description, textAlign: TextAlign.center),
      ],
    ),
  );
}

class StatusPill extends StatelessWidget {
  const StatusPill(this.value, {super.key});
  final String value;
  Color get color => switch (value) {
    'completed' || 'closed' || 'confirmed' => const Color(0xFF0F766E),
    'pending' || 'in_progress' => const Color(0xFFB45309),
    'cancelled' => const Color(0xFFB91C1C),
    _ => CafBrand.blueDeep,
  };
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      child: Text(
        statusLabel(value),
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
  );
}

Future<DirectoryOption?> chooseRecord(
  BuildContext context, {
  required String title,
  required Future<List<DirectoryOption>> Function(String) load,
  bool factory = false,
}) => showModalBottomSheet<DirectoryOption>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  builder: (context) => SizedBox(
    height: MediaQuery.sizeOf(context).height * 0.85,
    child: _RecordPicker(title: title, load: load, factory: factory),
  ),
);

class _RecordPicker extends StatefulWidget {
  const _RecordPicker({
    required this.title,
    required this.load,
    required this.factory,
  });
  final String title;
  final Future<List<DirectoryOption>> Function(String) load;
  final bool factory;
  @override
  State<_RecordPicker> createState() => _RecordPickerState();
}

class _RecordPickerState extends State<_RecordPicker> {
  List<DirectoryOption> _items = const [];
  bool _loading = true;
  String? _error;
  String _query = '';
  int _revision = 0;
  Timer? _debounce;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final revision = ++_revision;
    setState(() {
      _loading = true;
      _error = null;
      _items = const [];
    });
    try {
      final rows = await widget.load(_query);
      if (mounted && revision == _revision) setState(() => _items = rows);
    } catch (error) {
      if (mounted && revision == _revision) {
        setState(() => _error = portalError(error));
      }
    } finally {
      if (mounted && revision == _revision) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _revision++;
    _debounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      20,
      8,
      20,
      MediaQuery.viewInsetsOf(context).bottom + 12,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                widget.title,
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            IconButton(
              tooltip: 'Cerrar',
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close),
            ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Buscar por nombre o correo',
            prefixIcon: Icon(Icons.search),
          ),
          onChanged: (value) {
            _query = value;
            _revision++;
            _debounce?.cancel();
            setState(() {
              _items = const [];
              _loading = true;
            });
            _debounce = Timer(const Duration(milliseconds: 300), _load);
          },
        ),
        const SizedBox(height: 16),
        if (_error != null) PortalError(_error!, onRetry: _load),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _items.isEmpty
              ? const PortalEmpty(
                  title: 'Sin resultados',
                  description: 'Intente buscar con otro nombre.',
                )
              : ListView.separated(
                  itemCount: _items.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final item = _items[index];
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(vertical: 6),
                      leading: Icon(
                        widget.factory
                            ? Icons.factory_outlined
                            : Icons.person_outline,
                      ),
                      title: Text(
                        widget.factory
                            ? '${item.name} · #${item.id}'
                            : item.name,
                      ),
                      subtitle: item.email.isNotEmpty ? Text(item.email) : null,
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.pop(context, item),
                    );
                  },
                ),
        ),
      ],
    ),
  );
}
