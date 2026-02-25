import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'src/app_shell.dart';
import 'src/app_state.dart';
import 'src/auth_pages.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const CafClientApp());
}

class CafClientApp extends StatelessWidget {
  const CafClientApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AppState()..bootstrap(),
      child: MaterialApp(
        title: 'CAF Cliente',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF0E5A8A),
            brightness: Brightness.light,
          ),
          scaffoldBackgroundColor: const Color(0xFFF6F7FB),
          inputDecorationTheme: InputDecorationTheme(
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          ),
          appBarTheme: const AppBarTheme(centerTitle: false),
        ),
        home: const _RootGate(),
      ),
    );
  }
}

class _RootGate extends StatelessWidget {
  const _RootGate();

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();

    if (state.isBootstrapping) {
      return const _SplashScreen();
    }

    if (!state.isAuthenticated) {
      return const AuthEntryPage();
    }

    return const ClientAppShell();
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFEAF4FB), Color(0xFFF8FAFC)],
          ),
        ),
        child: const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.family_restroom, size: 54),
              SizedBox(height: 14),
              Text('CAF Cliente',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
              SizedBox(height: 18),
              SizedBox(
                  width: 28,
                  height: 28,
                  child: CircularProgressIndicator(strokeWidth: 2.2)),
            ],
          ),
        ),
      ),
    );
  }
}
