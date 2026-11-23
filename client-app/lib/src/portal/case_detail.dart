import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../app_state.dart';
import 'access.dart';
import 'case_editor.dart';
import 'controllers.dart';
import 'models.dart';
import 'repository.dart';
import 'ui.dart';
import 'session_refresh.dart';
import 'workspace_repository.dart';
import 'case_tools.dart';

class CaseDetailScreen extends StatefulWidget {
  const CaseDetailScreen({
    super.key,
    required this.id,
    required this.repository,
    required this.role,
    this.workspace,
    this.officeId,
  });
  final WorkspaceRepository? workspace;
  final int id;
  final PortalRepository repository;
  final PortalRole role;
  final int? officeId;
  @override
  State<CaseDetailScreen> createState() => _CaseDetailScreenState();
}

class _CaseDetailScreenState extends State<CaseDetailScreen> {
  int _loadRevision = 0;
  late final EmployeeRefreshBinding _refreshBinding;
  PortalCase? _record;
  String? _error;
  bool _loading = true;
  final _message = TextEditingController();
  String _visibility = 'internal';
  bool _sending = false;
  String? _messageError;
  @override
  void initState() {
    super.initState();
    _refreshBinding = EmployeeRefreshBinding(context.read<AppState>(), _load);
    _message.addListener(_messageChanged);
    _load();
  }

  void _messageChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _refreshBinding.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final revision = ++_loadRevision;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final record = await widget.repository.caseDetail(widget.id);
      if (mounted && revision == _loadRevision) {
        setState(() => _record = record);
      }
    } catch (error) {
      if (mounted && revision == _loadRevision) {
        setState(() {
          _error = portalError(error);
          _record = null;
        });
      }
    } finally {
      if (mounted && revision == _loadRevision) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _edit() async {
    final updated = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CaseEditorScreen(
          repository: widget.repository,
          role: widget.role,
          officeId: widget.officeId,
          initial: _record,
        ),
      ),
    );
    if (updated == true && mounted) await _load();
  }

  Future<void> _send() async {
    if (_sending || _message.text.trim().isEmpty) return;
    setState(() {
      _sending = true;
      _messageError = null;
    });
    try {
      await widget.repository.comment(widget.id, _message.text, _visibility);
      if (!mounted) return;
      _message.clear();
      await _load();
    } catch (error) {
      if (mounted) setState(() => _messageError = portalError(error));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final record = _record;
    return Scaffold(
      appBar: AppBar(
        title: Text('Expediente #${widget.id}'),
        actions: [
          if (record != null &&
              canManageCase(
                widget.role,
                context.read<AppState>().authUser?.id,
                record.data,
              ))
            IconButton(
              tooltip: 'Editar Caso',
              onPressed: _edit,
              icon: const Icon(Icons.edit_outlined),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? PortalContent(children: [PortalError(_error!, onRetry: _load)])
          : record == null
          ? const SizedBox.shrink()
          : PortalContent(
              onRefresh: _load,
              children: [
                Text(
                  record.title,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
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
                    if (record.currentStage.isNotEmpty)
                      Chip(label: Text(statusLabel(record.currentStage))),
                  ],
                ),
                const SizedBox(height: 24),
                PortalSection(
                  title: 'Datos del caso',
                  children: [
                    if (record.description.isNotEmpty) ...[
                      Text(record.description),
                      const SizedBox(height: 20),
                    ],
                    PortalFields(
                      children: [
                        _detail('Cliente', record.clientName),
                        _detail('Oficina responsable', record.officeName),
                        _detail('Profesional asignado', record.staffName),
                        _detail('Número de Expediente', record.docketNumber),
                        _detail('Juzgado', record.court),
                        _detail(
                          'Cuota/Precio',
                          '\$${record.fee.toStringAsFixed(2)}',
                        ),
                      ],
                    ),
                  ],
                ),
                if (record.employment.isLinked)
                  PortalSection(
                    title: 'Datos de maquila',
                    description:
                        'Datos laborales guardados en este expediente.',
                    children: [
                      PortalFields(
                        children: [
                          _detail(
                            'Maquila',
                            '${record.employment.factoryName} · #${record.employment.maquilaId}',
                          ),
                          _detail(
                            'Número de Empleado',
                            record.employment.employeeNumber,
                          ),
                          _detail('Turno', record.employment.shiftName),
                          _detail(
                            'Horario del turno',
                            [
                              record.employment.shiftStart,
                              record.employment.shiftEnd,
                            ].where((value) => value.isNotEmpty).join(' – '),
                          ),
                        ],
                      ),
                    ],
                  ),
                if (widget.workspace != null)
                  CaseTools(
                    record: record,
                    repository: widget.workspace!,
                    reload: _load,
                  ),
                PortalSection(
                  title: 'Agregar comentario',
                  description:
                      'Seleccione quién puede ver el mensaje antes de enviarlo.',
                  children: [
                    if (_messageError != null) PortalError(_messageError!),
                    DropdownButtonFormField<String>(
                      initialValue: _visibility,
                      decoration: const InputDecoration(
                        labelText: 'Visibilidad',
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'internal',
                          child: Text('Interno — solo equipo CAF'),
                        ),
                        DropdownMenuItem(
                          value: 'client_visible',
                          child: Text('Visible para el cliente'),
                        ),
                      ],
                      onChanged: _sending
                          ? null
                          : (value) => setState(
                              () => _visibility = value ?? 'internal',
                            ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _message,
                      enabled: !_sending,
                      minLines: 2,
                      maxLines: 5,
                      maxLength: 4000,
                      decoration: const InputDecoration(
                        labelText: 'Comentario',
                        alignLabelWithHint: true,
                      ),
                    ),
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: _sending || _message.text.trim().isEmpty
                          ? null
                          : _send,
                      icon: const Icon(Icons.send_outlined),
                      label: Text(_sending ? 'Enviando…' : 'Enviar comentario'),
                    ),
                  ],
                ),
                PortalSection(
                  title: 'Historial del expediente',
                  children: [
                    if (record.events.isEmpty)
                      const Text('No hay actividad registrada.')
                    else
                      ...record.events.map(
                        (event) => Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Wrap(
                                spacing: 8,
                                runSpacing: 6,
                                children: [
                                  Text(
                                    personName(jsonObject(event['user'])),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  if (textValue(event['visibility']).isNotEmpty)
                                    StatusPill(textValue(event['visibility'])),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                [
                                  textValue(event['commentText']),
                                  textValue(event['description']),
                                  textValue(event['fileName']),
                                ].where((value) => value.isNotEmpty).join('\n'),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                localDate(textValue(event['createdAt'])),
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                              if (widget.workspace != null)
                                CaseEventActions(
                                  event: event,
                                  repository: widget.workspace!,
                                  reload: _load,
                                ),
                              const Divider(),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
    );
  }

  Widget _detail(String label, String value) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: Theme.of(context).textTheme.labelMedium),
      const SizedBox(height: 4),
      SelectableText(value.isEmpty ? 'Sin especificar' : value),
    ],
  );
}
