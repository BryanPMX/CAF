import 'package:flutter/foundation.dart';
import '../app_state.dart';
import 'access.dart';
import 'models.dart';
import 'repository.dart';

String portalError(Object error) => error is ApiException
    ? error.message
    : 'No fue posible completar la operación. Intente nuevamente.';

class CaseListController extends ChangeNotifier {
  CaseListController(this.repository);
  final PortalRepository repository;
  List<PortalCase> items = const [];
  String query = '';
  String? status;
  String? error;
  int page = 1;
  int total = 0;
  bool loading = false;
  int _revision = 0;
  bool _disposed = false;
  bool get hasMore => items.length < total;

  Future<void> load({
    bool reset = true,
    String? search,
    String? filter,
    bool clearFilter = false,
  }) async {
    final revision = ++_revision;
    if (search != null) query = search.trim();
    if (clearFilter) {
      status = null;
    } else if (filter != null) {
      status = filter;
    }
    final nextPage = reset ? 1 : page + 1;
    if (reset) {
      items = const [];
      total = 0;
    }
    loading = true;
    error = null;
    notifyListeners();
    try {
      final result = await repository.cases(
        page: nextPage,
        query: query,
        status: status,
      );
      if (_disposed || revision != _revision) return;
      items = List.unmodifiable(
        reset ? result.items : [...items, ...result.items],
      );
      total = result.total;
      page = nextPage;
    } catch (failure) {
      if (!_disposed && revision == _revision) error = portalError(failure);
    } finally {
      if (!_disposed && revision == _revision) {
        loading = false;
        notifyListeners();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _revision++;
    super.dispose();
  }
}

class CaseEditorController extends ChangeNotifier {
  CaseEditorController({
    required this.repository,
    required this.role,
    this.actorOfficeId,
    this.initial,
  }) {
    officeId = initial?.officeId ?? (role.allOffices ? null : actorOfficeId);
    employment = initial?.employment ?? const Employment();
  }
  final PortalRepository repository;
  final PortalRole role;
  final int? actorOfficeId;
  final PortalCase? initial;
  List<DirectoryOption> offices = const [];
  DirectoryOption? selectedClient;
  int? officeId;
  Employment employment = const Employment();
  bool newClient = false;
  bool loadingOffices = false;
  bool loadingEmployment = false;
  bool saving = false;
  String? officeError;
  String? employmentError;
  String? saveError;
  int _clientRevision = 0;
  bool _disposed = false;
  bool get canSave =>
      !saving &&
      !loadingEmployment &&
      employmentError == null &&
      !loadingOffices &&
      officeError == null;
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  Future<void> loadOffices() async {
    if (initial != null) return;
    loadingOffices = true;
    officeError = null;
    _notify();
    try {
      final rows = await repository.offices();
      if (_disposed) return;
      offices = List.unmodifiable(
        role.allOffices ? rows : rows.where((item) => item.id == actorOfficeId),
      );
      if (offices.isEmpty) {
        officeError = 'No hay oficinas disponibles para su cuenta.';
      }
    } catch (error) {
      if (!_disposed) officeError = portalError(error);
    } finally {
      if (!_disposed) {
        loadingOffices = false;
        _notify();
      }
    }
  }

  void changeClientMode(bool value) {
    _clientRevision++;
    newClient = value;
    selectedClient = null;
    employment = const Employment();
    employmentError = null;
    loadingEmployment = false;
    _notify();
  }

  Future<void> selectClient(DirectoryOption client) async {
    final revision = ++_clientRevision;
    selectedClient = client;
    employment = const Employment();
    employmentError = null;
    loadingEmployment = true;
    _notify();
    try {
      final value = await repository.clientEmployment(client.id);
      if (!_disposed && revision == _clientRevision) employment = value;
    } catch (error) {
      if (!_disposed && revision == _clientRevision) {
        employmentError = portalError(error);
      }
    } finally {
      if (!_disposed && revision == _clientRevision) {
        loadingEmployment = false;
        _notify();
      }
    }
  }

  Future<bool> save({
    required String title,
    required String category,
    required String description,
    required Employment currentEmployment,
    String firstName = '',
    String lastName = '',
    String email = '',
    String? fee,
    String docketNumber = '',
    String court = '',
  }) async {
    if (!canSave) return false;
    saveError = currentEmployment.validate();
    if (saveError == null &&
        (title.trim().isEmpty || description.trim().isEmpty)) {
      saveError = 'Complete el tipo de caso y la descripción.';
    }
    if (saveError == null &&
        initial == null &&
        newClient &&
        (firstName.trim().isEmpty ||
            lastName.trim().isEmpty ||
            !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email.trim()))) {
      saveError =
          'Complete los nombres y un correo válido para el nuevo cliente.';
    }
    final amount = fee == null || fee.trim().isEmpty
        ? null
        : double.tryParse(fee);
    if (saveError == null &&
        fee != null &&
        fee.trim().isNotEmpty &&
        (amount == null || !amount.isFinite || amount < 0)) {
      saveError = 'Ingrese una cuota válida.';
    }
    if (saveError == null &&
        initial == null &&
        !newClient &&
        selectedClient == null) {
      saveError = 'Seleccione un cliente de la lista.';
    }
    if (saveError == null && initial == null && officeId == null) {
      saveError = 'Seleccione una oficina responsable.';
    }
    if (saveError != null) {
      _notify();
      return false;
    }
    saving = true;
    _notify();
    try {
      final payload = <String, dynamic>{
        'title': title.trim(),
        'category': category,
        'description': description.trim(),
        'docketNumber': docketNumber.trim(),
        'court': court.trim(),
        if (initial == null) ...{
          'officeId': officeId,
          'employment': currentEmployment.toJson(),
          if (amount != null) 'fee': amount,
          if (newClient) ...{
            'firstName': firstName.trim(),
            'lastName': lastName.trim(),
            'email': email.trim(),
          } else
            'clientId': selectedClient!.id,
        },
        if (initial != null &&
            !currentEmployment.sameSnapshot(initial!.employment))
          'employment': currentEmployment.toJson(),
      };
      await repository.saveCase(payload, id: initial?.id);
      return true;
    } catch (error) {
      if (!_disposed) saveError = portalError(error);
      return false;
    } finally {
      if (!_disposed) {
        saving = false;
        _notify();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _clientRevision++;
    super.dispose();
  }
}
