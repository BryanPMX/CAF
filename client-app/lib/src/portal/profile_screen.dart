import 'dart:typed_data';
import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../app_state.dart';
import 'controllers.dart';
import 'models.dart';
import 'record_editor.dart';
import 'ui.dart';
import 'workspace_repository.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.repository});
  final WorkspaceRepository repository;
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Json? _profile;
  Uint8List? _photo;
  bool _loading = true, _busy = false;
  String? _error;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final profile = await widget.repository.profile();
      if (mounted) setState(() => _profile = profile);
      final response = textValue(profile['avatarUrl']).isEmpty
          ? null
          : await widget.repository.avatarImage();
      if (mounted) setState(() => _photo = response?.bytes);
    } catch (error) {
      if (mounted) setState(() => _error = portalError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _change(String mode) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (mode == 'upload') {
        final file = await openFile(
          acceptedTypeGroups: [
            const XTypeGroup(
              label: 'Imágenes',
              extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
              uniformTypeIdentifiers: ['public.image'],
            ),
          ],
        );
        if (file == null) return;
        final policy = jsonObject(_profile?['avatarPolicy']);
        final max = intValue(policy['maxBytes']) ?? 10 * 1024 * 1024;
        if (await file.length() > max) {
          throw ApiException(
            'La foto supera el tamaño permitido (${max ~/ 1024 ~/ 1024} MB).',
          );
        }
        await widget.repository.avatar(
          bytes: await file.readAsBytes(),
          filename: file.name,
        );
      } else if (mode == 'url') {
        if (!mounted) return;
        final changed = await openRecordEditor(
          context,
          () async => RecordForm(
            title: 'Cambiar Foto',
            initial: {'avatarUrl': _profile?['avatarUrl']},
            fields: [
              RecordField(
                'avatarUrl',
                'URL de la foto',
                required: true,
                maxLength:
                    intValue(
                      jsonObject(_profile?['avatarPolicy'])['maxURLBytes'],
                    ) ??
                    512,
                validate: (v, _) {
                  final uri = Uri.tryParse(textValue(v));
                  return uri == null ||
                          !['https', 'http'].contains(uri.scheme) ||
                          uri.host.isEmpty
                      ? 'Ingrese una URL http o https válida.'
                      : null;
                },
              ),
            ],
            save: (v) => widget.repository.avatar(url: v['avatarUrl']),
          ),
        );
        if (!changed) return;
      } else {
        if (!await confirmAction(
          context,
          '¿Quitar foto?',
          'Se mostrará su nombre e iniciales.',
        )) {
          return;
        }
        await widget.repository.avatar(url: '');
      }
      if (!mounted) return;
      await context.read<AppState>().loadProfile(silent: true);
      if (mounted) await _load();
    } catch (error) {
      if (mounted) setState(() => _error = portalError(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = _profile;
    return _loading
        ? const Center(child: CircularProgressIndicator())
        : PortalContent(
            onRefresh: _load,
            children: [
              if (_error != null) PortalError(_error!, onRetry: _load),
              if (_busy) const LinearProgressIndicator(),
              if (profile != null) ...[
                PortalSection(
                  title: 'Mi perfil',
                  children: [
                    Center(
                      child: CircleAvatar(
                        radius: 48,
                        backgroundImage: _photo == null
                            ? null
                            : MemoryImage(_photo!),
                        child: _photo != null
                            ? null
                            : const Icon(Icons.person_outline, size: 42),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      personName(profile),
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      widget.repository.role.label,
                      textAlign: TextAlign.center,
                    ),
                    ExpansionTile(
                      title: const Text('Cambiar Foto'),
                      tilePadding: EdgeInsets.zero,
                      children: [
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            OutlinedButton.icon(
                              onPressed: _busy ? null : () => _change('upload'),
                              icon: const Icon(Icons.photo_library_outlined),
                              label: const Text('Subir imagen'),
                            ),
                            TextButton(
                              onPressed: _busy ? null : () => _change('url'),
                              child: const Text('Usar URL'),
                            ),
                            if (textValue(profile['avatarUrl']).isNotEmpty)
                              TextButton(
                                onPressed: _busy
                                    ? null
                                    : () => _change('remove'),
                                child: const Text('Quitar foto'),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
                PortalSection(
                  title: 'Contacto',
                  children: [
                    PortalFields(
                      children: [
                        _value('Correo Electrónico', profile['email']),
                        _value('Teléfono', profile['phone']),
                      ],
                    ),
                  ],
                ),
                PortalSection(
                  title: 'Organización',
                  children: [
                    PortalFields(
                      children: [
                        if (!widget.repository.role.allOffices)
                          _value(
                            'Oficina',
                            jsonObject(profile['office'])['name'],
                          ),
                        for (final entry in jsonObject(
                          profile['organizationInfo'],
                        ).entries)
                          if (entry.value != null &&
                              textValue(entry.value).isNotEmpty)
                            _value(
                              entry.key == 'department'
                                  ? 'Departamento'
                                  : 'Especialidad',
                              entry.value,
                            ),
                      ],
                    ),
                  ],
                ),
                PortalSection(
                  title: 'Cuenta',
                  children: [
                    PortalFields(
                      children: [
                        _value(
                          'Estado',
                          profile['isActive'] == true ? 'Activa' : 'Inactiva',
                        ),
                        _value(
                          'Fecha de creación',
                          localDate(textValue(profile['createdAt'])),
                        ),
                        _value(
                          'Último acceso',
                          localDate(textValue(profile['lastLogin'])),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ],
          );
  }

  Widget _value(String label, Object? value) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: Theme.of(context).textTheme.labelMedium),
      const SizedBox(height: 6),
      SelectableText(
        textValue(value).isEmpty ? 'Sin especificar' : textValue(value),
      ),
    ],
  );
}
