import 'package:flutter/material.dart';

class CafBrand {
  static const Color navyStrong = Color(0xFF0F172A);
  static const Color navySoft = Color(0xFF111C36);
  static const Color blue = Color(0xFF2563EB);
  static const Color blueDeep = Color(0xFF1F5EB3);
  static const Color cyan = Color(0xFF0891B2);
  static const Color teal = Color(0xFF17B7A5);
  static const Color purple = Color(0xFF6F63CC);
  static const Color pageBg = Color(0xFFEEF2F7);
  static const Color surface = Color(0xFFF8FBFF);
  static const Color surfaceSoft = Color(0xFFF3F7FD);
  static const Color ink = Color(0xFF1F2A3D);
  static const Color inkSoft = Color(0xFF5A6E8D);
  static const Color borderSoft = Color(0xFFB4C5E5);

  static LinearGradient get sidebarGradient => const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [navySoft, navyStrong],
      );

  static LinearGradient get actionGradient => const LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [blueDeep, purple, teal],
      );

  static LinearGradient get authBackgroundGradient => const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFFFFFFFF),
          Color(0xFFF7F2FF),
          Color(0xFFEEF5FF),
        ],
        stops: [0.0, 0.46, 1.0],
      );

  static LinearGradient get authGlassGradient => const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xE6FFFFFF),
          Color(0xD6F5FAFF),
          Color(0xCFF1EBFF),
        ],
      );

  static LinearGradient get showcaseGradient => const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFF13396F),
          Color(0xFF264C93),
          Color(0xFF6F59C1),
        ],
      );
}
