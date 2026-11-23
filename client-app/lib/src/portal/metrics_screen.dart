import 'package:flutter/material.dart';
import 'controllers.dart';
import 'models.dart';
import 'ui.dart';
import 'workspace_repository.dart';

class MetricsScreen extends StatefulWidget {
  const MetricsScreen({super.key, required this.repository});
  final WorkspaceRepository repository;
  @override
  State<MetricsScreen> createState() => _MetricsScreenState();
}

class _MetricsScreenState extends State<MetricsScreen> {
  Json? _data;
  String? _error;
  bool _loading = true;
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
      final data = await widget.repository.metrics();
      if (mounted) setState(() => _data = data);
    } catch (error) {
      if (mounted) setState(() => _error = portalError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    return Scaffold(
      appBar: AppBar(title: const Text('Indicadores acumulados')),
      body: PortalContent(
        onRefresh: _load,
        children: [
          const Text(
            'Indicadores acumulados de toda la organización. Los filtros de periodo de Reportes se aplican en esa sección.',
          ),
          const SizedBox(height: 20),
          if (_error != null) PortalError(_error!, onRetry: _load),
          if (_loading) const LinearProgressIndicator(),
          if (data != null && !_loading) ...[
            PortalSection(
              title: 'Personas y oficinas',
              children: [
                PortalFields(
                  children: [
                    for (final entry in const {
                      'totalUsers': 'Usuarios',
                      'activeUsers': 'Usuarios activos (30 días)',
                      'totalOffices': 'Oficinas',
                      'totalCases': 'Casos',
                      'totalAppointments': 'Citas',
                      'upcomingAppointments': 'Próximas citas',
                    }.entries)
                      _metric(entry.value, textValue(data[entry.key])),
                  ],
                ),
              ],
            ),
            PortalSection(
              title: 'Finanzas',
              children: [
                if (data['revenueMixedCurrencies'] == true)
                  const Text(
                    'Hay pagos en varias monedas. No se presenta una suma combinada.',
                  )
                else
                  PortalFields(
                    children: [
                      for (final entry in const {
                        'revenue': 'Ingresos acumulados',
                        'revenueThisMonth': 'Ingresos del mes',
                        'revenueThisYear': 'Ingresos del año',
                        'averageCaseValue': 'Pago promedio por caso',
                      }.entries)
                        _metric(
                          entry.value,
                          '${textValue(data['revenueCurrency']).toUpperCase()} ${(num.tryParse(textValue(data[entry.key])) ?? 0).toStringAsFixed(2)}',
                        ),
                    ],
                  ),
              ],
            ),
            PortalSection(
              title: 'Resultados',
              children: [
                PortalFields(
                  children: [
                    _metric(
                      'Casos completados',
                      '${textValue(data['caseCompletionRate'])}%',
                    ),
                    _metric(
                      'Citas exitosas',
                      '${textValue(data['appointmentSuccessRate'])}%',
                    ),
                  ],
                ),
              ],
            ),
            if (jsonRows(data['topPerformingStaff']).isNotEmpty)
              PortalSection(
                title: 'Personal',
                children: [
                  for (final row in jsonRows(data['topPerformingStaff']))
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(personName(row)),
                      subtitle: Text(
                        '${row['completedCases']} casos completados · ${row['activeCases']} activos',
                      ),
                    ),
                ],
              ),
          ],
        ],
      ),
    );
  }

  Widget _metric(String title, String value) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(title, style: Theme.of(context).textTheme.labelLarge),
      const SizedBox(height: 8),
      Text(value, style: Theme.of(context).textTheme.titleLarge),
    ],
  );
}
