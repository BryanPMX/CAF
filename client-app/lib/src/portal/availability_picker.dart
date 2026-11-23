import 'package:flutter/material.dart';
import 'controllers.dart';
import 'models.dart';
import 'ui.dart';
import 'workspace_repository.dart';

/// Uses privacy-safe busy intervals, never appointment/client details.
class AvailabilityPicker extends StatefulWidget {
  const AvailabilityPicker({
    super.key,
    required this.repository,
    required this.staffId,
    required this.value,
    required this.onSelect,
  });
  final WorkspaceRepository repository;
  final int? staffId;
  final DateTime? value;
  final void Function(DateTime, DateTime) onSelect;
  @override
  State<AvailabilityPicker> createState() => _AvailabilityPickerState();
}

class _AvailabilityPickerState extends State<AvailabilityPicker> {
  late DateTime _day = _initialDay();
  Future<List<Json>>? _busy;
  DateTime _initialDay() {
    final date = widget.value?.toLocal() ?? DateTime.now();
    return DateTime(date.year, date.month, date.day);
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(AvailabilityPicker old) {
    super.didUpdateWidget(old);
    final day = widget.value?.toLocal();
    final changedDay =
        day != null &&
        (day.year != _day.year ||
            day.month != _day.month ||
            day.day != _day.day);
    if (changedDay) _day = DateTime(day.year, day.month, day.day);
    if (changedDay || widget.staffId != old.staffId) _load();
  }

  void _load() {
    _busy = widget.staffId == null
        ? null
        : widget.repository.availability(
            widget.staffId!,
            _day,
            _day.add(const Duration(days: 1)),
          );
  }

  Future<void> _chooseDay() async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final chosen = await showDatePicker(
      context: context,
      useRootNavigator: false,
      initialDate: _day.isBefore(today) ? today : _day,
      firstDate: today,
      lastDate: DateTime(now.year + 2, 12, 31),
    );
    if (chosen == null || !mounted) return;
    setState(() {
      _day = chosen;
      _load();
    });
  }

  @override
  Widget build(BuildContext context) => PortalSection(
    title: 'Disponibilidad',
    description:
        'Horarios de 30 minutos en la zona local del dispositivo. También puede ajustar Inicio y Fin manualmente.',
    children: [
      OutlinedButton.icon(
        onPressed: _chooseDay,
        icon: const Icon(Icons.calendar_today_outlined),
        label: Text('${_day.day}/${_day.month}/${_day.year}'),
      ),
      const SizedBox(height: 16),
      if (widget.staffId == null)
        const Text('Seleccione un profesional para consultar sus horarios.')
      else if (_day.weekday == DateTime.sunday)
        const Text('No hay atención los domingos.')
      else
        FutureBuilder<List<Json>>(
          future: _busy,
          builder: (context, state) {
            if (state.hasError) {
              return PortalError(
                portalError(state.error!),
                onRetry: () => setState(_load),
              );
            }
            if (!state.hasData) {
              return const LinearProgressIndicator(
                semanticsLabel: 'Consultando disponibilidad',
              );
            }
            final opening = _day.weekday == DateTime.saturday ? 8 : 9,
                closing = _day.weekday == DateTime.saturday ? 15 : 18;
            final now = DateTime.now();
            final times = [
              for (
                var minute = opening * 60;
                minute + 30 <= closing * 60;
                minute += 30
              )
                DateTime(
                  _day.year,
                  _day.month,
                  _day.day,
                  minute ~/ 60,
                  minute % 60,
                ),
            ];
            return Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final start in times)
                  Builder(
                    builder: (context) {
                      final end = start.add(const Duration(minutes: 30));
                      final occupied = state.requireData.any(
                        (slot) =>
                            DateTime.parse(
                              textValue(slot['startTime']),
                            ).isBefore(end) &&
                            DateTime.parse(
                              textValue(slot['endTime']),
                            ).isAfter(start),
                      );
                      final selectable = start.isAfter(now) && !occupied;
                      final selected =
                          widget.value?.isAtSameMomentAs(start) ?? false;
                      final label =
                          '${start.hour.toString().padLeft(2, '0')}:${start.minute.toString().padLeft(2, '0')}';
                      return ChoiceChip(
                        label: Text(occupied ? '$label · Ocupado' : label),
                        selected: selected,
                        onSelected: selectable
                            ? (_) => widget.onSelect(start, end)
                            : null,
                      );
                    },
                  ),
              ],
            );
          },
        ),
    ],
  );
}
