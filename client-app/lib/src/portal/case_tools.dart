import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../app_state.dart';
import 'catalog_forms.dart';
import 'access.dart';
import 'controllers.dart';
import 'models.dart';
import 'private_files.dart';
import 'record_editor.dart';
import 'ui.dart';
import 'workspace_detail.dart';
import 'workspace_repository.dart';

class CaseTools extends StatefulWidget {
  const CaseTools({
    super.key,
    required this.record,
    required this.repository,
    required this.reload,
  });
  final PortalCase record;
  final WorkspaceRepository repository;
  final Future<void> Function() reload;
  @override
  State<CaseTools> createState() => _CaseToolsState();
}

class _CaseToolsState extends State<CaseTools> {
  String? _error;
  bool _busy = false;
  Future<void> _guard(Future<void> Function() work) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await work();
    } catch (error) {
      if (mounted) setState(() => _error = portalError(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _task() async {
    final session = context.read<AppState>();
    final changed = await openRecordEditor(
      context,
      () => CatalogForms(
        widget.repository,
        actorId: session.authUser!.id,
        officeId: session.profile?.officeId,
      ).build(WorkspaceResource.tasks, caseId: widget.record.id),
    );
    if (changed && mounted) await widget.reload();
  }

  Future<void> _manage(String action) async {
    final record = widget.record;
    final changed = await openRecordEditor(context, () async {
      final fields = <RecordField>[];
      var initial = <String, dynamic>{};
      if (action == 'stage') {
        final legal = ['Familiar', 'Civil'].contains(record.category);
        fields.add(
          RecordField(
            'stage',
            'Etapa',
            kind: InputKind.choice,
            required: true,
            choices: caseStageLabels.entries
                .where(
                  (e) => legal
                      ? [
                          'etapa_inicial',
                          'notificacion',
                          'audiencia_preliminar',
                          'audiencia_juicio',
                          'sentencia',
                        ].contains(e.key)
                      : ![
                          'etapa_inicial',
                          'notificacion',
                          'audiencia_preliminar',
                          'audiencia_juicio',
                          'sentencia',
                        ].contains(e.key),
                )
                .map((e) => FieldChoice(e.key, e.value))
                .toList(),
          ),
        );
        initial = {'stage': record.currentStage};
      } else if (action == 'assign') {
        final employees = (await widget.repository.employees())
            .where((e) => intValue(e['officeId']) == record.officeId)
            .toList();
        fields.add(
          RecordField(
            'staffId',
            'Profesional asignado',
            kind: InputKind.choice,
            required: true,
            choices: namedChoices(employees, key: 'person'),
          ),
        );
      } else {
        fields.add(
          RecordField(
            'completionNote',
            'Nota de Completado',
            kind: InputKind.multiline,
            required: true,
            maxLength: 500,
            validate: (v, _) => textValue(v).length < 10
                ? 'Escriba al menos 10 caracteres.'
                : null,
          ),
        );
      }
      return RecordForm(
        title: action == 'stage'
            ? 'Actualizar Etapa'
            : action == 'assign'
            ? 'Asignar Profesional'
            : 'Completar y Archivar',
        description: action == 'complete'
            ? 'El expediente se marcará como completado y se moverá a Archivos.'
            : null,
        fields: fields,
        initial: initial,
        save: (v) => widget.repository.caseAction(record.id, action, v),
      );
    });
    if (changed && mounted) {
      if (action == 'complete') {
        Navigator.pop(context, true);
      } else {
        await widget.reload();
      }
    }
  }

  Future<void> _upload() async {
    final file = await openFile();
    if (file == null || !mounted) return;
    if (await file.length() > 25 * 1024 * 1024) {
      throw ApiException('El documento no puede superar 25 MB.');
    }
    if (!mounted) return;
    final changed = await openRecordEditor(
      context,
      () async => RecordForm(
        title: 'Subir Documento',
        initial: {'fileName': file.name, 'visibility': 'internal'},
        fields: const [
          RecordField('fileName', 'Archivo', readOnly: true),
          RecordField(
            'visibility',
            'Visibilidad',
            kind: InputKind.choice,
            required: true,
            choices: visibilityChoices,
          ),
        ],
        save: (v) async => widget.repository.uploadDocument(
          widget.record.id,
          await file.readAsBytes(),
          file.name,
          v['visibility'],
        ),
      ),
    );
    if (changed && mounted) await widget.reload();
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      if (_error != null) PortalError(_error!),
      if (_busy) const LinearProgressIndicator(),
      if (canManageCase(
        widget.repository.role,
        context.read<AppState>().authUser?.id,
        widget.record.data,
      ))
        PortalSection(
          title: 'Gestionar expediente',
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (widget.repository.role.isManagement)
                  for (final action in const [
                    FieldChoice('assign', 'Asignar Profesional'),
                    FieldChoice('stage', 'Actualizar Etapa'),
                    FieldChoice('complete', 'Completar y Archivar'),
                  ])
                    OutlinedButton(
                      onPressed: _busy
                          ? null
                          : () => _guard(() => _manage('${action.value}')),
                      child: Text(action.label),
                    ),
                TextButton.icon(
                  onPressed: _busy
                      ? null
                      : () => _guard(() async {
                          if (await confirmAction(
                                context,
                                '¿Eliminar expediente?',
                                'El expediente se moverá a Archivos.',
                                action: 'Eliminar',
                              ) &&
                              mounted) {
                            await widget.repository.caseAction(
                              widget.record.id,
                              'delete',
                              {},
                            );
                            if (context.mounted) Navigator.pop(context, true);
                          }
                        }),
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('Eliminar'),
                ),
              ],
            ),
          ],
        ),
      PortalSection(
        title: 'Tareas',
        children: [
          if (canManageCase(
            widget.repository.role,
            context.read<AppState>().authUser?.id,
            widget.record.data,
          ))
            OutlinedButton.icon(
              onPressed: _busy ? null : () => _guard(_task),
              icon: const Icon(Icons.add_task),
              label: const Text('Crear Tarea'),
            ),
          for (final task in widget.record.tasks)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(textValue(task['title'])),
              subtitle: Text(statusLabel(textValue(task['status']))),
              trailing: const Icon(Icons.chevron_right),
              onTap: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => WorkspaceDetail(
                      repository: widget.repository,
                      resource: WorkspaceResource.tasks,
                      record: task,
                    ),
                  ),
                );
                if (mounted) await widget.reload();
              },
            ),
        ],
      ),
      PortalSection(
        title: 'Documentos',
        description:
            'Los documentos internos solo son visibles para el equipo CAF.',
        children: [
          OutlinedButton.icon(
            onPressed: _busy ? null : () => _guard(_upload),
            icon: const Icon(Icons.upload_file_outlined),
            label: const Text('Subir Documento'),
          ),
        ],
      ),
    ],
  );
}

class CaseEventActions extends StatefulWidget {
  const CaseEventActions({
    super.key,
    required this.event,
    required this.repository,
    required this.reload,
  });
  final Json event;
  final WorkspaceRepository repository;
  final Future<void> Function() reload;
  @override
  State<CaseEventActions> createState() => _CaseEventActionsState();
}

class _CaseEventActionsState extends State<CaseEventActions> {
  bool _busy = false;
  String? _error;
  Future<void> _run(String action) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final event = widget.event,
        document = widget.event['eventType'] == 'file_upload';
    final id = intValue(event['id'])!;
    try {
      if (action == 'open') {
        final response = await widget.repository.document(id);
        if (!mounted) return;
        await PrivateFiles.open(
          response.bytes,
          textValue(event['fileName']).isEmpty
              ? 'documento.pdf'
              : textValue(event['fileName']),
        );
      } else if (action == 'delete') {
        if (!await confirmAction(
          context,
          '¿Eliminar ${document ? 'documento' : 'comentario'}?',
          'Esta acción eliminará el elemento seleccionado.',
          action: 'Eliminar',
        )) {
          return;
        }
        await widget.repository.deleteEvent(id, document);
        if (mounted) await widget.reload();
      } else {
        if (!mounted) return;
        final changed = await openRecordEditor(
          context,
          () async => RecordForm(
            title: document ? 'Editar Documento' : 'Editar Comentario',
            initial: {...event, 'comment': event['commentText']},
            fields: [
              if (document)
                const RecordField(
                  'fileName',
                  'Nombre del documento',
                  required: true,
                )
              else
                const RecordField(
                  'comment',
                  'Comentario',
                  kind: InputKind.multiline,
                  required: true,
                ),
              const RecordField(
                'visibility',
                'Visibilidad',
                kind: InputKind.choice,
                required: true,
                choices: visibilityChoices,
              ),
            ],
            save: (v) => widget.repository.updateEvent(id, document, v),
          ),
        );
        if (changed && mounted) await widget.reload();
      }
    } catch (error) {
      if (mounted) setState(() => _error = portalError(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final event = widget.event, actor = context.read<AppState>().authUser?.id;
    final document = event['eventType'] == 'file_upload';
    final editable = intValue(event['userId']) == actor;
    if (!document && event['eventType'] != 'comment') {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_error != null) PortalError(_error!),
        Wrap(
          spacing: 8,
          children: [
            if (document)
              TextButton.icon(
                onPressed: _busy ? null : () => _run('open'),
                icon: const Icon(Icons.open_in_new),
                label: const Text('Abrir Documento'),
              ),
            if (editable)
              TextButton(
                onPressed: _busy ? null : () => _run('edit'),
                child: const Text('Editar'),
              ),
            if (editable || widget.repository.role.isManagement)
              TextButton(
                onPressed: _busy ? null : () => _run('delete'),
                child: const Text('Eliminar'),
              ),
          ],
        ),
      ],
    );
  }
}
