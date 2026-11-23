import 'dart:io';
import 'package:integration_test/integration_test_driver_extended.dart';

Future<void> main() async {
  final folder = Directory(
      Platform.environment['CAF_MOBILE_ARTIFACT_DIR'] ?? '/tmp/caf-mobile-e2e');
  await folder.create(recursive: true);
  await integrationDriver(
    onScreenshot: (name, bytes, [arguments]) async {
      await File('${folder.path}/$name.png').writeAsBytes(bytes);
      return bytes.isNotEmpty;
    },
    responseDataCallback: (_) async {},
  );
}
