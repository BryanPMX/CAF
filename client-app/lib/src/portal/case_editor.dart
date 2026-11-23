import 'package:flutter/material.dart';
import 'access.dart';
import 'controllers.dart';
import 'models.dart';
import 'repository.dart';
import 'ui.dart';

class CaseEditorScreen extends StatefulWidget {
  const CaseEditorScreen({
    super.key,
    required this.repository,
    required this.role,
    this.officeId,
    this.initial,
  });
  final PortalRepository repository;
  final PortalRole role;
  final int? officeId;
  final PortalCase? initial;
  @override
  State<CaseEditorScreen> createState() => _CaseEditorScreenState();
}

class _CaseEditorScreenState extends State<CaseEditorScreen> {
  final _form = GlobalKey<FormState>();
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _email = TextEditingController();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _employee = TextEditingController();
  final _shift = TextEditingController();
  final _start = TextEditingController();
  final _end = TextEditingController();
  final _fee = TextEditingController();
  final _docket = TextEditingController();
  final _court = TextEditingController();
  final _scroll = ScrollController();
  final _errorKey = GlobalKey();
  late final CaseEditorController _controller;
  String? _caseType;
  String _category = 'General';
  int? _factoryId;
  String _factoryName = '';
  bool _dirty = false;
  bool _allowPop = false;

  @override
  void initState() {
    super.initState();
    _controller = CaseEditorController(
      repository: widget.repository,
      role: widget.role,
      actorOfficeId: widget.officeId,
      initial: widget.initial,
    );
    final initial = widget.initial;
    if (initial != null) {
      _title.text = initial.title;
      _category = initial.category;
      _caseType = initial.title;
      _description.text = initial.description;
      _docket.text = initial.docketNumber;
      _court.text = initial.court;
      _applyEmployment(initial.employment);
    }
    _controller.addListener(_updated);
    _controller.loadOffices();
  }

  void _updated() {
    if (mounted) setState(() {});
  }

  void _applyEmployment(Employment value) {
    _factoryId = value.maquilaId;
    _factoryName = value.factoryName;
    _employee.text = value.employeeNumber;
    _shift.text = value.shiftName;
    _start.text = value.shiftStart;
    _end.text = value.shiftEnd;
  }

  Employment get _employment => Employment(
    maquilaId: _factoryId,
    factoryName: _factoryName,
    employeeNumber: _employee.text,
    shiftName: _shift.text,
    shiftStart: _start.text,
    shiftEnd: _end.text,
  );
  @override
  void dispose() {
    _controller.removeListener(_updated);
    _controller.dispose();
    for (final field in [
      _firstName,
      _lastName,
      _email,
      _title,
      _description,
      _employee,
      _shift,
      _start,
      _end,
      _fee,
      _docket,
      _court,
    ]) {
      field.dispose();
    }
    _scroll.dispose();
    super.dispose();
  }

  String? _required(String? value) => value == null || value.trim().isEmpty
      ? 'Este campo es obligatorio.'
      : null;
  Future<void> _selectClient() async {
    final client = await chooseRecord(
      context,
      title: 'Seleccionar cliente',
      load: widget.repository.clients,
    );
    if (client == null || !mounted) return;
    _dirty = true;
    final pending = _controller.selectClient(client);
    _applyEmployment(const Employment());
    await pending;
    if (mounted) setState(() => _applyEmployment(_controller.employment));
  }

  Future<void> _factory() async {
    final factory = await chooseRecord(
      context,
      title: 'Seleccionar maquila',
      factory: true,
      load: (query) => widget.repository.factories(query),
    );
    if (factory == null || !mounted) return;
    setState(() {
      _dirty = true;
      _factoryId = factory.id;
      _factoryName = factory.name;
    });
  }

  Future<void> _save() async {
    final invalid = _form.currentState?.validateGranularly();
    if (invalid == null || invalid.isNotEmpty) {
      if (invalid?.isNotEmpty == true) {
        await Scrollable.ensureVisible(
          invalid!.first.context,
          duration: const Duration(milliseconds: 200),
        );
      }
      return;
    }
    FocusManager.instance.primaryFocus?.unfocus();
    final saved = await _controller.save(
      title: widget.initial == null ? (_caseType ?? '') : _title.text,
      category: _category,
      description: _description.text,
      currentEmployment: _employment,
      firstName: _firstName.text,
      lastName: _lastName.text,
      email: _email.text,
      fee: _fee.text,
      docketNumber: _docket.text,
      court: _court.text,
    );
    if (!mounted) return;
    if (saved) {
      setState(() => _allowPop = true);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.pop(context, true);
      });
    } else {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_errorKey.currentContext != null) {
          Scrollable.ensureVisible(
            _errorKey.currentContext!,
            alignment: 0.5,
            duration: const Duration(milliseconds: 200),
          );
        }
      });
    }
  }

  Future<void> _back() async {
    if (_controller.saving) return;
    if (_dirty) {
      final discard = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('¿Descartar los cambios?'),
          content: const Text(
            'Los datos que capturó todavía no se han guardado.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Seguir editando'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Descartar'),
            ),
          ],
        ),
      );
      if (discard != true || !mounted) return;
    }
    setState(() => _allowPop = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) Navigator.pop(context);
    });
  }

  @override
  Widget build(BuildContext context) {
    final editing = widget.initial != null;
    final blockedEmployment =
        _controller.loadingEmployment ||
        _controller.employmentError != null ||
        (!editing &&
            !_controller.newClient &&
            _controller.selectedClient == null);
    return PopScope(
      canPop: _allowPop || (!_dirty && !_controller.saving),
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(editing ? 'Editar Caso' : 'Crear Nuevo Caso'),
          leading: IconButton(
            tooltip: 'Volver',
            onPressed: _controller.saving ? null : _back,
            icon: const Icon(Icons.arrow_back),
          ),
        ),
        body: SafeArea(
          child: Form(
            key: _form,
            onChanged: () {
              _dirty = true;
            },
            child: SingleChildScrollView(
              controller: _scroll,
              padding: const EdgeInsets.all(20),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 760),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        editing
                            ? 'Actualice los datos del expediente. Su oficina responsable se conserva.'
                            : 'Seleccione un cliente o registre uno nuevo y complete los datos del caso. Los campos con * son obligatorios.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 24),
                      if (_controller.saveError != null)
                        PortalError(_controller.saveError!, key: _errorKey),
                      if (!editing) _clientSection(),
                      _employmentSection(blockedEmployment),
                      _caseSection(),
                      _additionalSection(),
                    ],
                  ),
                ),
              ),
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
              MediaQuery.viewInsetsOf(context).bottom > 0
                  ? MediaQuery.viewInsetsOf(context).bottom
                  : 16,
            ),
            child: FilledButton.icon(
              onPressed: _controller.canSave ? _save : null,
              icon: _controller.saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.check),
              label: Text(editing ? 'Guardar Cambios' : 'Crear Caso'),
            ),
          ),
        ),
      ),
    );
  }

  Widget _clientSection() {
    return PortalSection(
      title: 'Cliente',
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ChoiceChip(
              label: const Text('Cliente Existente'),
              selected: !_controller.newClient,
              onSelected: _controller.saving
                  ? null
                  : (_) => setState(() {
                      _dirty = true;
                      _controller.changeClientMode(false);
                      _applyEmployment(const Employment());
                    }),
            ),
            ChoiceChip(
              label: const Text('Cliente Nuevo'),
              selected: _controller.newClient,
              onSelected: _controller.saving
                  ? null
                  : (_) => setState(() {
                      _dirty = true;
                      _controller.changeClientMode(true);
                      _applyEmployment(const Employment());
                    }),
            ),
          ],
        ),
        const SizedBox(height: 20),
        if (_controller.newClient)
          PortalFields(
            children: [
              TextFormField(
                controller: _firstName,
                enabled: !_controller.saving,
                decoration: const InputDecoration(labelText: 'Nombre(s) *'),
                textCapitalization: TextCapitalization.words,
                autofillHints: const [AutofillHints.givenName],
                validator: _required,
              ),
              TextFormField(
                controller: _lastName,
                enabled: !_controller.saving,
                decoration: const InputDecoration(labelText: 'Apellidos *'),
                textCapitalization: TextCapitalization.words,
                autofillHints: const [AutofillHints.familyName],
                validator: _required,
              ),
              TextFormField(
                controller: _email,
                enabled: !_controller.saving,
                decoration: const InputDecoration(
                  labelText: 'Correo Electrónico *',
                ),
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                validator: (value) =>
                    _required(value) ??
                    (RegExp(
                          r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                        ).hasMatch(value!.trim())
                        ? null
                        : 'Ingrese un correo válido.'),
              ),
            ],
          )
        else
          FormField<int>(
            key: ValueKey(_controller.selectedClient?.id),
            initialValue: _controller.selectedClient?.id,
            validator: (value) =>
                value == null ? 'Seleccione un cliente de la lista.' : null,
            builder: (field) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                OutlinedButton.icon(
                  onPressed: _controller.saving ? null : _selectClient,
                  icon: const Icon(Icons.person_search_outlined),
                  label: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    child: Text(
                      _controller.selectedClient?.label ??
                          'Buscar cliente por nombre o correo',
                      textAlign: TextAlign.start,
                    ),
                  ),
                ),
                if (field.errorText != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      field.errorText!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _employmentSection(bool blockedEmployment) {
    final editing = widget.initial != null;
    return PortalSection(
      title: 'Datos de maquila',
      optional: true,
      description: _controller.newClient
          ? 'Estos datos se guardarán en el nuevo cliente y en su expediente.'
          : 'Los cambios aquí se guardan solo en este expediente.',
      children: [
        if (_controller.loadingEmployment)
          const Padding(
            padding: EdgeInsets.only(bottom: 16),
            child: LinearProgressIndicator(
              semanticsLabel: 'Cargando datos de maquila',
            ),
          ),
        if (_controller.employmentError != null)
          PortalError(
            _controller.employmentError!,
            onRetry: () async {
              final client = _controller.selectedClient;
              if (client == null) return;
              await _controller.selectClient(client);
              if (mounted) {
                setState(() => _applyEmployment(_controller.employment));
              }
            },
          ),
        if (!editing &&
            !_controller.newClient &&
            _controller.selectedClient == null)
          const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: Text(
              'Seleccione primero un cliente para cargar sus datos laborales.',
            ),
          ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            OutlinedButton.icon(
              onPressed: blockedEmployment || _controller.saving
                  ? null
                  : _factory,
              icon: const Icon(Icons.factory_outlined),
              label: Text(
                _factoryId == null
                    ? 'Seleccionar maquila'
                    : '${_factoryName.isEmpty ? 'Maquila' : _factoryName} · #$_factoryId',
              ),
            ),
            if (_factoryId != null)
              TextButton(
                onPressed: _controller.saving || blockedEmployment
                    ? null
                    : () => setState(() {
                        _dirty = true;
                        _applyEmployment(const Employment());
                      }),
                child: const Text('Sin maquila'),
              ),
          ],
        ),
        if (_factoryId != null) ...[
          const SizedBox(height: 20),
          PortalFields(
            children: [
              TextFormField(
                controller: _employee,
                enabled: !_controller.saving && !blockedEmployment,
                maxLength: 100,
                decoration: const InputDecoration(
                  labelText: 'Número de Empleado *',
                  hintText: 'Ej. 000042',
                  counterText: '',
                ),
                validator: _required,
              ),
              TextFormField(
                controller: _shift,
                enabled: !_controller.saving && !blockedEmployment,
                maxLength: 100,
                decoration: const InputDecoration(
                  labelText: 'Turno *',
                  hintText: 'Ej. Tercer turno',
                  counterText: '',
                ),
                validator: _required,
              ),
              TextFormField(
                controller: _start,
                enabled: !_controller.saving && !blockedEmployment,
                keyboardType: TextInputType.datetime,
                decoration: InputDecoration(
                  labelText: 'Inicio del turno',
                  hintText: '22:00',
                  suffixIcon: IconButton(
                    tooltip: 'Seleccionar inicio del turno',
                    onPressed: _controller.saving || blockedEmployment
                        ? null
                        : () => _pickTime(_start),
                    icon: const Icon(Icons.schedule),
                  ),
                ),
                validator: (_) => _hoursError(),
              ),
              TextFormField(
                controller: _end,
                enabled: !_controller.saving && !blockedEmployment,
                keyboardType: TextInputType.datetime,
                decoration: InputDecoration(
                  labelText: 'Fin del turno',
                  hintText: '06:00',
                  suffixIcon: IconButton(
                    tooltip: 'Seleccionar fin del turno',
                    onPressed: _controller.saving || blockedEmployment
                        ? null
                        : () => _pickTime(_end),
                    icon: const Icon(Icons.schedule),
                  ),
                ),
                validator: (_) => _hoursError(),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'Horario opcional, en hora local. Puede terminar al día siguiente.',
          ),
        ],
      ],
    );
  }

  Widget _caseSection() {
    final editing = widget.initial != null;
    return PortalSection(
      title: 'Datos del caso',
      children: [
        PortalFields(
          children: [
            if (editing)
              TextFormField(
                controller: _title,
                enabled: !_controller.saving,
                decoration: const InputDecoration(
                  labelText: 'Título del Caso *',
                ),
                validator: _required,
              )
            else
              DropdownButtonFormField<String>(
                initialValue: _caseType,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Tipo de Caso *'),
                items: caseTypes.values
                    .expand((types) => types)
                    .map(
                      (type) => DropdownMenuItem(
                        value: type,
                        child: Text(type, overflow: TextOverflow.ellipsis),
                      ),
                    )
                    .toList(),
                onChanged: _controller.saving
                    ? null
                    : (value) => setState(() {
                        _dirty = true;
                        _caseType = value;
                        _category = departmentFor(value ?? '');
                      }),
                validator: _required,
              ),
            if (editing)
              DropdownButtonFormField<String>(
                initialValue: caseTypes.containsKey(_category)
                    ? _category
                    : null,
                decoration: const InputDecoration(labelText: 'Departamento *'),
                items: {...caseTypes.keys, _category}
                    .map(
                      (value) =>
                          DropdownMenuItem(value: value, child: Text(value)),
                    )
                    .toList(),
                onChanged: _controller.saving
                    ? null
                    : (value) => setState(() {
                        _dirty = true;
                        _category = value ?? 'General';
                      }),
              )
            else
              DropdownButtonFormField<int>(
                key: ValueKey(
                  '${_controller.officeId}:${_controller.offices.length}',
                ),
                initialValue:
                    _controller.offices.any(
                      (office) => office.id == _controller.officeId,
                    )
                    ? _controller.officeId
                    : null,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'Asignar a Oficina *',
                ),
                items: _controller.offices
                    .map(
                      (office) => DropdownMenuItem(
                        value: office.id,
                        child: Text(
                          office.name,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged:
                    !widget.role.allOffices ||
                        _controller.loadingOffices ||
                        _controller.saving
                    ? null
                    : (value) => setState(() {
                        _dirty = true;
                        _controller.officeId = value;
                      }),
                validator: (value) =>
                    value == null ? 'Seleccione una oficina.' : null,
              ),
          ],
        ),
        if (_controller.loadingOffices)
          const Padding(
            padding: EdgeInsets.only(top: 12),
            child: LinearProgressIndicator(),
          ),
        if (_controller.officeError != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: PortalError(
              _controller.officeError!,
              onRetry: _controller.loadOffices,
            ),
          ),
        if (_caseType != null || editing) ...[
          const SizedBox(height: 16),
          Text(
            'Departamento: $_category',
            style: Theme.of(context).textTheme.labelLarge,
          ),
        ],
        const SizedBox(height: 20),
        TextFormField(
          controller: _description,
          enabled: !_controller.saving,
          decoration: const InputDecoration(
            labelText: 'Descripción Inicial *',
            alignLabelWithHint: true,
            hintText:
                'Describa la situación del cliente y el apoyo que solicita.',
          ),
          minLines: 3,
          maxLines: 8,
          validator: _required,
        ),
      ],
    );
  }

  Widget _additionalSection() {
    final editing = widget.initial != null;
    return PortalSection(
      title: 'Datos adicionales',
      optional: true,
      children: [
        PortalFields(
          children: [
            if (!editing)
              TextFormField(
                controller: _fee,
                enabled: !_controller.saving,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: const InputDecoration(
                  labelText: 'Cuota/Precio',
                  prefixText: r'$ ',
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return null;
                  }
                  final amount = double.tryParse(value);
                  return amount == null || !amount.isFinite || amount < 0
                      ? 'Ingrese un monto válido.'
                      : null;
                },
              ),
            TextFormField(
              controller: _docket,
              enabled: !_controller.saving,
              maxLength: 100,
              decoration: const InputDecoration(
                labelText: 'Número de Expediente',
                hintText: 'Ej. 589-25',
                counterText: '',
              ),
            ),
            TextFormField(
              controller: _court,
              enabled: !_controller.saving,
              maxLength: 50,
              decoration: const InputDecoration(
                labelText: 'Juzgado',
                hintText: 'Ej. 1FXA',
                counterText: '',
              ),
            ),
          ],
        ),
      ],
    );
  }

  Future<void> _pickTime(TextEditingController field) async {
    final valid = RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(field.text);
    final parts = valid ? field.text.split(':').map(int.parse).toList() : null;
    final time = await showTimePicker(
      context: context,
      useRootNavigator: false,
      initialTime: parts == null
          ? TimeOfDay.now()
          : TimeOfDay(hour: parts[0], minute: parts[1]),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );
    if (time == null || !mounted) return;
    setState(() {
      _dirty = true;
      field.text =
          '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
    });
  }

  String? _hoursError() {
    final value = _employment;
    if (value.shiftStart.isEmpty && value.shiftEnd.isEmpty) return null;
    final regex = RegExp(r'^([01]\d|2[0-3]):[0-5]\d$');
    return regex.hasMatch(value.shiftStart) && regex.hasMatch(value.shiftEnd)
        ? null
        : 'Capture ambos horarios en formato HH:mm.';
  }
}
