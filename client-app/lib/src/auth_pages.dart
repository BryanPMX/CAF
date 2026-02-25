import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app_state.dart';

class AuthEntryPage extends StatefulWidget {
  const AuthEntryPage({super.key});

  @override
  State<AuthEntryPage> createState() => _AuthEntryPageState();
}

class _AuthEntryPageState extends State<AuthEntryPage> {
  bool _showRegister = false;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              colorScheme.primary.withValues(alpha: 0.08),
              colorScheme.surface,
              colorScheme.secondary.withValues(alpha: 0.06),
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: BorderSide(
                        color: colorScheme.outline.withValues(alpha: 0.15)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                color: colorScheme.primaryContainer,
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Icon(Icons.shield_outlined,
                                  color: colorScheme.onPrimaryContainer),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'CAF Cliente',
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleLarge
                                        ?.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                  Text(
                                    'Portal móvil para seguimiento de casos',
                                    style:
                                        Theme.of(context).textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        SegmentedButton<bool>(
                          segments: const [
                            ButtonSegment<bool>(
                                value: false, label: Text('Entrar')),
                            ButtonSegment<bool>(
                                value: true, label: Text('Registro')),
                          ],
                          selected: {_showRegister},
                          onSelectionChanged: (selection) {
                            setState(() => _showRegister = selection.first);
                          },
                        ),
                        const SizedBox(height: 20),
                        if (state.errorMessage != null &&
                            state.errorMessage!.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Material(
                              color: colorScheme.errorContainer,
                              borderRadius: BorderRadius.circular(12),
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Row(
                                  children: [
                                    Icon(Icons.error_outline,
                                        color: colorScheme.onErrorContainer),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        state.errorMessage!,
                                        style: TextStyle(
                                            color:
                                                colorScheme.onErrorContainer),
                                      ),
                                    ),
                                    IconButton(
                                      visualDensity: VisualDensity.compact,
                                      onPressed: state.clearError,
                                      icon: Icon(Icons.close,
                                          color: colorScheme.onErrorContainer),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 220),
                          child: _showRegister
                              ? RegisterForm(
                                  key: const ValueKey('register-form'),
                                  isLoading: state.isBusy,
                                  onBackToLogin: () =>
                                      setState(() => _showRegister = false),
                                )
                              : LoginForm(
                                  key: const ValueKey('login-form'),
                                  isLoading: state.isBusy,
                                  onSwitchToRegister: () =>
                                      setState(() => _showRegister = true),
                                ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Configura el endpoint con --dart-define=CAF_API_BASE_URL=<https://.../api/v1>',
                          style: Theme.of(context).textTheme.bodySmall,
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class LoginForm extends StatefulWidget {
  const LoginForm({
    super.key,
    required this.isLoading,
    required this.onSwitchToRegister,
  });

  final bool isLoading;
  final VoidCallback onSwitchToRegister;

  @override
  State<LoginForm> createState() => _LoginFormState();
}

class _LoginFormState extends State<LoginForm> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final appState = context.read<AppState>();
    final message = await appState.login(
      _emailController.text,
      _passwordController.text,
    );

    if (!mounted) return;
    if (message != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(message),
            backgroundColor: Theme.of(context).colorScheme.error),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Iniciar sesión',
            style: Theme.of(context)
                .textTheme
                .headlineSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            'Consulta notificaciones, tu caso y citas en tiempo real.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 20),
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Correo electrónico'),
            autofillHints: const [AutofillHints.email],
            validator: (value) {
              final v = (value ?? '').trim();
              if (v.isEmpty || !v.contains('@'))
                return 'Ingresa un correo válido';
              return null;
            },
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _passwordController,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Contraseña'),
            autofillHints: const [AutofillHints.password],
            validator: (value) {
              if ((value ?? '').isEmpty) return 'Ingresa tu contraseña';
              return null;
            },
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: widget.isLoading ? null : _submit,
            icon: widget.isLoading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.login),
            label: const Text('Entrar'),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: widget.isLoading ? null : widget.onSwitchToRegister,
            child: const Text('Crear cuenta de cliente'),
          ),
        ],
      ),
    );
  }
}

class RegisterForm extends StatefulWidget {
  const RegisterForm({
    super.key,
    required this.isLoading,
    required this.onBackToLogin,
  });

  final bool isLoading;
  final VoidCallback onBackToLogin;

  @override
  State<RegisterForm> createState() => _RegisterFormState();
}

class _RegisterFormState extends State<RegisterForm> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final appState = context.read<AppState>();
    final message = await appState.register(
      firstName: _firstNameController.text,
      lastName: _lastNameController.text,
      email: _emailController.text,
      password: _passwordController.text,
    );

    if (!mounted) return;
    if (message == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Cuenta creada. Ahora puedes iniciar sesión.')),
      );
      widget.onBackToLogin();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(message),
            backgroundColor: Theme.of(context).colorScheme.error),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Registro de cliente',
            style: Theme.of(context)
                .textTheme
                .headlineSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            'La app registra cuentas con rol cliente para cumplir con la API actual.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 20),
          TextFormField(
            controller: _firstNameController,
            decoration: const InputDecoration(labelText: 'Nombre(s)'),
            validator: (value) =>
                (value ?? '').trim().length < 2 ? 'Mínimo 2 caracteres' : null,
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _lastNameController,
            decoration: const InputDecoration(labelText: 'Apellidos'),
            validator: (value) =>
                (value ?? '').trim().length < 2 ? 'Mínimo 2 caracteres' : null,
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Correo electrónico'),
            validator: (value) {
              final v = (value ?? '').trim();
              if (v.isEmpty || !v.contains('@'))
                return 'Ingresa un correo válido';
              return null;
            },
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _passwordController,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Contraseña'),
            validator: (value) {
              final v = value ?? '';
              if (v.length < 8) return 'Mínimo 8 caracteres';
              if (!RegExp(r'[A-Z]').hasMatch(v) ||
                  !RegExp(r'[a-z]').hasMatch(v) ||
                  !RegExp(r'\d').hasMatch(v)) {
                return 'Incluye mayúscula, minúscula y número';
              }
              return null;
            },
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: widget.isLoading ? null : _submit,
            icon: widget.isLoading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.person_add_alt_1),
            label: const Text('Crear cuenta'),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: widget.isLoading ? null : widget.onBackToLogin,
            child: const Text('Volver a iniciar sesión'),
          ),
        ],
      ),
    );
  }
}
