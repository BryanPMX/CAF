import 'dart:async';
import 'package:flutter/widgets.dart';
import '../app_state.dart';

/// Debounces server invalidation signals without polling or sharing record data
/// across routes. Owners dispose this binding with their screen/controller.
class EmployeeRefreshBinding with WidgetsBindingObserver {
  EmployeeRefreshBinding(this.session, this.refresh)
    : _revision = session.employeeRevision {
    session.addListener(_changed);
    WidgetsBinding.instance.addObserver(this);
  }
  final AppState session;
  final VoidCallback refresh;
  int _revision;
  Timer? _timer;
  void _changed() {
    if (_revision == session.employeeRevision) return;
    _revision = session.employeeRevision;
    _timer?.cancel();
    _timer = Timer(const Duration(milliseconds: 300), () {
      if (session.isAuthenticated) refresh();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _timer?.cancel();
      _timer = Timer(const Duration(milliseconds: 300), () {
        if (session.isAuthenticated) refresh();
      });
    }
  }

  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    session.removeListener(_changed);
  }
}
