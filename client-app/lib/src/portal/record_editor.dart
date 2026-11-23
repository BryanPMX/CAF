import 'dart:async';
import 'package:flutter/material.dart';
import 'controllers.dart';
import 'models.dart';
import 'ui.dart';

enum InputKind {
  text,
  multiline,
  email,
  phone,
  password,
  number,
  dateTime,
  toggle,
  choice,
  multiple,
  lines,
}

class FieldChoice {
  const FieldChoice(this.value, this.label);
  final Object value;
  final String label;
}

class RecordField {
  const RecordField(
    this.key,
    this.label, {
    this.kind = InputKind.text,
    this.required = false,
    this.choices = const [],
    this.search,
    this.section = 'Datos generales',
    this.maxLength,
    this.visible,
    this.validate,
    this.readOnly = false,
  });
  final String key, label, section;
  final InputKind kind;
  final bool required, readOnly;
  final int? maxLength;
  final List<FieldChoice> choices;
  final Future<List<FieldChoice>> Function(String)? search;
  final bool Function(Json)? visible;
  final String? Function(Object?, Json)? validate;
}

class RecordForm {
  const RecordForm({
    required this.title,
    required this.fields,
    required this.save,
    this.initial = const {},
    this.description,
    this.validate,
    this.onChange,
    this.supplement,
  });
  final String title;
  final String? description;
  final List<RecordField> fields;
  final Json initial;
  final Future<void> Function(Json) save;
  final String? Function(Json)? validate;
  final void Function(String, Json)? onChange;
  final Widget Function(BuildContext, Json, void Function(Json))? supplement;
}

Future<bool> openRecordEditor(
  BuildContext context,
  Future<RecordForm> Function() load,
) async {
  // Load required options inside the route so failures remain retryable.
  return await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => _EditorLoader(load: load)),
      ) ==
      true;
}

class _EditorLoader extends StatefulWidget {
  const _EditorLoader({required this.load});
  final Future<RecordForm> Function() load;
  @override
  State<_EditorLoader> createState() => _EditorLoaderState();
}

class _EditorLoaderState extends State<_EditorLoader> {
  late Future<RecordForm> _future = widget.load();
  @override
  Widget build(BuildContext context) => FutureBuilder<RecordForm>(
    future: _future,
    builder: (context, state) {
      if (state.hasData) return RecordEditorScreen(form: state.requireData);
      return Scaffold(
        appBar: AppBar(title: const Text('Cargando formulario')),
        body: state.hasError
            ? PortalContent(
                children: [
                  PortalError(
                    portalError(state.error!),
                    onRetry: () => setState(() => _future = widget.load()),
                  ),
                ],
              )
            : const Center(child: CircularProgressIndicator()),
      );
    },
  );
}

/// One accessible editor for directory, task and scheduling forms. Payloads and
/// domain rules are supplied by the feature, never inferred from server objects.
class RecordEditorScreen extends StatefulWidget {
  const RecordEditorScreen({super.key, required this.form});
  final RecordForm form;
  @override
  State<RecordEditorScreen> createState() => _RecordEditorScreenState();
}

class _RecordEditorScreenState extends State<RecordEditorScreen> {
  final _form = GlobalKey<FormState>();
  final _errorKey = GlobalKey();
  final Map<String, List<FieldChoice>> _choiceCache = {};
  late final Json _values = Map.of(widget.form.initial);
  final Map<String, TextEditingController> _text = {};
  bool _dirty = false, _saving = false, _allowPop = false;
  String? _error;
  @override
  void initState() {
    super.initState();
    for (final field in widget.form.fields) {
      final value = _values[field.key];
      if (field.kind == InputKind.lines && value is List) {
        _values[field.key] = value.join('\n');
      }
      _text[field.key] = TextEditingController(
        text: value is List ? value.join('\n') : textValue(value),
      );
    }
  }

  @override
  void dispose() {
    for (final controller in _text.values) {
      controller.dispose();
    }
    super.dispose();
  }

  void _changed(RecordField field, Object? value) {
    setState(() {
      _dirty = true;
      _values[field.key] = value;
      widget.form.onChange?.call(field.key, _values);
      if (widget.form.onChange != null) {
        for (final entry in _text.entries.where(
          (entry) => entry.key != field.key,
        )) {
          final next = textValue(_values[entry.key]);
          if (entry.value.text != next) entry.value.text = next;
        }
      }
    });
  }

  Future<void> _back() async {
    if (_saving) return;
    if (_dirty &&
        !await confirmAction(
          context,
          '¿Descartar los cambios?',
          'Los datos capturados todavía no se han guardado.',
          action: 'Descartar',
        )) {
      return;
    }
    if (!mounted) return;
    setState(() => _allowPop = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) Navigator.pop(context);
    });
  }

  Future<void> _save() async {
    if (_saving) return;
    final invalid = _form.currentState!.validateGranularly();
    if (invalid.isNotEmpty) {
      await Scrollable.ensureVisible(invalid.first.context);
      return;
    }
    final payload = <String, dynamic>{};
    for (final field in widget.form.fields.where(
      (f) => f.visible?.call(_values) ?? true,
    )) {
      final value = _values[field.key];
      payload[field.key] = field.kind == InputKind.lines
          ? textValue(value)
                .split('\n')
                .map((s) => s.trim())
                .where((s) => s.isNotEmpty)
                .toList()
          : field.kind == InputKind.number
          ? (textValue(value).trim().isEmpty
                ? null
                : num.tryParse(textValue(value)))
          : value is String
          ? value.trim()
          : value;
    }
    final validation = widget.form.validate?.call(payload);
    if (validation != null) {
      setState(() => _error = validation);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_errorKey.currentContext != null) {
          Scrollable.ensureVisible(_errorKey.currentContext!, alignment: 0.5);
        }
      });
      return;
    }
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.form.save(payload);
      if (!mounted) return;
      setState(() => _allowPop = true);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.pop(context, true);
      });
    } catch (error) {
      if (mounted) {
        setState(() => _error = portalError(error));
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_errorKey.currentContext != null) {
            Scrollable.ensureVisible(_errorKey.currentContext!);
          }
        });
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _date(RecordField field) async {
    final now = DateTime.now();
    final current =
        DateTime.tryParse(textValue(_values[field.key]))?.toLocal() ?? now;
    final date = await showDatePicker(
      context: context,
      useRootNavigator: false,
      initialDate: current,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      useRootNavigator: false,
      initialTime: TimeOfDay.fromDateTime(current),
    );
    if (time == null || !mounted) return;
    _changed(
      field,
      DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      ).toUtc().toIso8601String(),
    );
  }

  Future<void> _choices(RecordField field) async {
    final selected = <Object>{
      if (_values[field.key] is List)
        ...(_values[field.key] as List)
      else if (_values[field.key] != null)
        _values[field.key] as Object,
    };
    final result = await showModalBottomSheet<Set<Object>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _ChoiceSheet(
        field: field,
        selected: selected,
        onLoaded: (rows) {
          _choiceCache[field.key] = [...?_choiceCache[field.key], ...rows];
        },
      ),
    );
    if (result == null || !mounted) return;
    _changed(
      field,
      field.kind == InputKind.multiple ? result.toList() : result.firstOrNull,
    );
  }

  String? _validate(RecordField field, Object? value) {
    if (field.required &&
        (value == null ||
            value is String && value.trim().isEmpty ||
            value is List && value.isEmpty)) {
      return 'Este campo es obligatorio.';
    }
    final text = textValue(value).trim();
    if (field.kind == InputKind.email &&
        text.isNotEmpty &&
        !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(text)) {
      return 'Ingrese un correo válido.';
    }
    if (field.kind == InputKind.number &&
        text.isNotEmpty &&
        (num.tryParse(text) == null || !num.parse(text).isFinite)) {
      return 'Ingrese un número válido.';
    }
    return field.validate?.call(value, _values);
  }

  Widget _input(RecordField field) {
    final value = _values[field.key];
    final label = '${field.label}${field.required ? ' *' : ''}';
    if (field.kind == InputKind.toggle) {
      return SwitchListTile.adaptive(
        contentPadding: EdgeInsets.zero,
        title: Text(label),
        value: value == true,
        onChanged: _saving || field.readOnly ? null : (v) => _changed(field, v),
      );
    }
    if (field.kind == InputKind.choice ||
        field.kind == InputKind.multiple ||
        field.kind == InputKind.dateTime) {
      final selected = value is List ? value : [value];
      final display = field.kind == InputKind.dateTime
          ? (value == null ? '' : localDate(textValue(value)))
          : {
                  for (final c in [
                    ...field.choices,
                    ...?_choiceCache[field.key],
                  ])
                    c.value: c,
                }.values
                .where((c) => selected.contains(c.value))
                .map((c) => c.label)
                .join(', ');
      return FormField<Object>(
        key: ValueKey('${field.key}:$value'),
        initialValue: value,
        validator: (v) => _validate(field, v),
        builder: (state) => InkWell(
          onTap: _saving || field.readOnly
              ? null
              : () => field.kind == InputKind.dateTime
                    ? _date(field)
                    : _choices(field),
          child: InputDecorator(
            decoration: InputDecoration(
              labelText: label,
              errorText: state.errorText,
              suffixIcon: Icon(
                field.kind == InputKind.dateTime
                    ? Icons.schedule
                    : Icons.expand_more,
              ),
            ),
            child: Text(display.isEmpty ? 'Seleccionar' : display),
          ),
        ),
      );
    }
    return TextFormField(
      controller: _text[field.key],
      enabled: !_saving && !field.readOnly,
      obscureText: field.kind == InputKind.password,
      autocorrect: field.kind != InputKind.password,
      enableSuggestions: field.kind != InputKind.password,
      maxLength: field.maxLength,
      minLines:
          field.kind == InputKind.multiline || field.kind == InputKind.lines
          ? 3
          : 1,
      maxLines:
          field.kind == InputKind.multiline || field.kind == InputKind.lines
          ? 8
          : 1,
      keyboardType: switch (field.kind) {
        InputKind.email => TextInputType.emailAddress,
        InputKind.phone => TextInputType.phone,
        InputKind.multiline || InputKind.lines => TextInputType.multiline,
        InputKind.number => const TextInputType.numberWithOptions(
          decimal: true,
          signed: true,
        ),
        _ => TextInputType.text,
      },
      decoration: InputDecoration(labelText: label, alignLabelWithHint: true),
      onChanged: (v) => _changed(field, v),
      validator: (v) => _validate(field, v),
    );
  }

  @override
  Widget build(BuildContext context) {
    final fields = widget.form.fields
        .where((f) => f.visible?.call(_values) ?? true)
        .toList();
    return PopScope(
      canPop: _allowPop || (!_dirty && !_saving),
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.form.title),
          leading: IconButton(
            tooltip: 'Volver',
            onPressed: _saving ? null : _back,
            icon: const Icon(Icons.arrow_back),
          ),
        ),
        body: SafeArea(
          child: Form(
            key: _form,
            child: PortalContent(
              children: [
                if (widget.form.description != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 20),
                    child: Text(widget.form.description!),
                  ),
                if (_error != null) PortalError(_error!, key: _errorKey),
                for (final section in fields.map((f) => f.section).toSet()) ...[
                  PortalSection(
                    title: section,
                    children: [
                      PortalFields(
                        children: fields
                            .where((field) => field.section == section)
                            .map(_input)
                            .toList(),
                      ),
                    ],
                  ),
                  if (widget.form.supplement != null &&
                      section == fields.first.section)
                    widget.form.supplement!(context, _values, (values) {
                      setState(() {
                        _dirty = true;
                        _values.addAll(values);
                      });
                    }),
                ],
              ],
            ),
          ),
        ),
        bottomNavigationBar: SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              12,
              20,
              MediaQuery.viewInsetsOf(context).bottom + 16,
            ),
            child: FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.check),
              label: Text(_saving ? 'Guardando…' : 'Guardar'),
            ),
          ),
        ),
      ),
    );
  }
}

Future<bool> confirmAction(
  BuildContext context,
  String title,
  String description, {
  String action = 'Confirmar',
}) async =>
    await showDialog<bool>(
      context: context,
      useRootNavigator: false,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(description),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(action),
          ),
        ],
      ),
    ) ==
    true;

class _ChoiceSheet extends StatefulWidget {
  const _ChoiceSheet({
    required this.field,
    required this.selected,
    required this.onLoaded,
  });
  final RecordField field;
  final Set<Object> selected;
  final void Function(List<FieldChoice>) onLoaded;
  @override
  State<_ChoiceSheet> createState() => _ChoiceSheetState();
}

class _ChoiceSheetState extends State<_ChoiceSheet> {
  late final Set<Object> _selected = Set.of(widget.selected);
  String _query = '';
  late List<FieldChoice> _items = widget.field.choices;
  String? _error;
  bool _loading = false;
  int _revision = 0;
  Timer? _timer;
  @override
  void initState() {
    super.initState();
    if (widget.field.search != null) _load();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _revision++;
    super.dispose();
  }

  Future<void> _load() async {
    final revision = ++_revision;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await widget.field.search!(_query);
      if (mounted && revision == _revision) {
        widget.onLoaded(rows);
        setState(() => _items = rows);
      }
    } catch (error) {
      if (mounted && revision == _revision) {
        setState(() => _error = portalError(error));
      }
    } finally {
      if (mounted && revision == _revision) setState(() => _loading = false);
    }
  }

  void _search(String q) {
    setState(() => _query = q.toLowerCase());
    if (widget.field.search != null) {
      _revision++;
      _timer?.cancel();
      _timer = Timer(const Duration(milliseconds: 300), _load);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
    child: SizedBox(
      height: MediaQuery.sizeOf(context).height * .8,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  widget.field.label,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 16),
                TextField(
                  autofocus: false,
                  decoration: const InputDecoration(labelText: 'Buscar'),
                  onChanged: _search,
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              children: [
                if (!widget.field.required &&
                    widget.field.kind == InputKind.choice)
                  ListTile(
                    title: const Text('Sin selección'),
                    onTap: () => Navigator.pop(context, <Object>{}),
                  ),
                if (_loading) const LinearProgressIndicator(),
                if (_error != null) PortalError(_error!, onRetry: _load),
                for (final choice in _items.where(
                  (c) => c.label.toLowerCase().contains(_query),
                ))
                  CheckboxListTile(
                    title: Text(choice.label),
                    value: _selected.contains(choice.value),
                    onChanged: (checked) {
                      if (widget.field.kind != InputKind.multiple) {
                        Navigator.pop(context, <Object>{choice.value});
                        return;
                      }
                      setState(() {
                        if (checked == true) {
                          _selected.add(choice.value);
                        } else {
                          _selected.remove(choice.value);
                        }
                      });
                    },
                  ),
              ],
            ),
          ),
          if (widget.field.kind == InputKind.multiple)
            Padding(
              padding: const EdgeInsets.all(20),
              child: FilledButton(
                onPressed: () => Navigator.pop(context, _selected),
                child: const Text('Listo'),
              ),
            ),
        ],
      ),
    ),
  );
}
