import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'src/app_shell.dart';
import 'src/app_state.dart';
import 'src/auth_pages.dart';
import 'src/brand.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const CafClientApp());
}

class CafClientApp extends StatelessWidget {
  const CafClientApp({super.key});

  @override
  Widget build(BuildContext context) {
    final baseScheme = ColorScheme.fromSeed(
      seedColor: CafBrand.blue,
      brightness: Brightness.light,
    );
    final scheme = baseScheme.copyWith(
      primary: CafBrand.blue,
      secondary: CafBrand.cyan,
      tertiary: CafBrand.teal,
      surface: CafBrand.surface,
      surfaceContainerHighest: const Color(0xFFE6EEF9),
      outline: const Color(0xFF9BB1D0),
      onSurface: CafBrand.ink,
      onSurfaceVariant: CafBrand.inkSoft,
      error: const Color(0xFFD6455D),
    );

    return ChangeNotifierProvider(
      create: (_) => AppState()..bootstrap(),
      child: MaterialApp(
        title: 'CAF Cliente',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: scheme,
          scaffoldBackgroundColor: CafBrand.pageBg,
          appBarTheme: AppBarTheme(
            centerTitle: false,
            backgroundColor: Colors.white.withValues(alpha: 0.88),
            foregroundColor: CafBrand.ink,
            elevation: 0,
            scrolledUnderElevation: 0,
            surfaceTintColor: Colors.transparent,
            shadowColor: Colors.transparent,
          ),
          cardTheme: CardThemeData(
            color: Colors.white.withValues(alpha: 0.92),
            elevation: 0,
            shadowColor: Colors.black.withValues(alpha: 0.10),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
              side: const BorderSide(color: Color(0x66D3DFEF)),
            ),
            margin: EdgeInsets.zero,
          ),
          filledButtonTheme: FilledButtonThemeData(
            style: FilledButton.styleFrom(
              backgroundColor: CafBrand.blue,
              foregroundColor: Colors.white,
              disabledBackgroundColor: CafBrand.blue.withValues(alpha: 0.35),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              textStyle: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          textButtonTheme: TextButtonThemeData(
            style: TextButton.styleFrom(
              foregroundColor: CafBrand.blue,
              textStyle: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          chipTheme: ChipThemeData(
            backgroundColor: const Color(0xFFF0F5FD),
            selectedColor: const Color(0xFFE4EEFC),
            labelStyle: const TextStyle(color: CafBrand.ink, fontSize: 12),
            side: const BorderSide(color: Color(0x669EB7DB)),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.86),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(13)),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(13),
              borderSide: const BorderSide(color: Color(0xB39EB7DB)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(13),
              borderSide: const BorderSide(color: CafBrand.blue, width: 1.4),
            ),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
            labelStyle: const TextStyle(color: Color(0xFF486188)),
          ),
          navigationRailTheme: const NavigationRailThemeData(
            backgroundColor: Colors.transparent,
            indicatorColor: Color(0x332563EB),
            selectedIconTheme: IconThemeData(color: Colors.white),
            selectedLabelTextStyle:
                TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
            unselectedIconTheme: IconThemeData(color: Color(0xFFCBD5E1)),
            unselectedLabelTextStyle: TextStyle(color: Color(0xFFE2E8F0)),
          ),
          dividerColor: const Color(0x80D3DFEF),
          snackBarTheme: SnackBarThemeData(
            behavior: SnackBarBehavior.floating,
            backgroundColor: CafBrand.navyStrong.withValues(alpha: 0.96),
            contentTextStyle: const TextStyle(color: Colors.white),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
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
        decoration: BoxDecoration(
          gradient: CafBrand.authBackgroundGradient,
        ),
        child: Stack(
          children: [
            Positioned(
              top: -80,
              left: -30,
              child: _GlowOrb(
                size: 240,
                color: CafBrand.blue.withValues(alpha: 0.28),
              ),
            ),
            Positioned(
              top: -70,
              right: -50,
              child: _GlowOrb(
                size: 250,
                color: CafBrand.purple.withValues(alpha: 0.24),
              ),
            ),
            Positioned(
              bottom: -90,
              right: 10,
              child: _GlowOrb(
                size: 220,
                color: CafBrand.teal.withValues(alpha: 0.18),
              ),
            ),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 88,
                    height: 88,
                    padding: const EdgeInsets.all(11),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: const Color(0x70FFFFFF),
                      ),
                      gradient: const LinearGradient(
                        colors: [Color(0xF7FFFFFF), Color(0xDFF4FAFF)],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.16),
                          blurRadius: 28,
                          offset: const Offset(0, 16),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.asset('mobile-app-icon.png'),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'CAF Cliente',
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Cargando portal móvil',
                    style: TextStyle(color: CafBrand.inkSoft),
                  ),
                  const SizedBox(height: 18),
                  const SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(strokeWidth: 2.2),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GlowOrb extends StatelessWidget {
  const _GlowOrb({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color,
        ),
      ),
    );
  }
}
