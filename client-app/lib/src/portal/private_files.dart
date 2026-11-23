import 'dart:io';
import 'dart:typed_data';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

/// App-private temporary downloads, removed when an account signs out.
class PrivateFiles {
  static Future<Directory> _directory() async =>
      Directory('${(await getTemporaryDirectory()).path}/caf-private');
  static Future<void> clear() async {
    final directory = await _directory();
    if (await directory.exists()) await directory.delete(recursive: true);
  }

  static Future<void> open(Uint8List bytes, String filename) async {
    final directory = await _directory();
    await directory.create(recursive: true);
    var safe = filename
        .split(RegExp(r'[/\\]'))
        .last
        .replaceAll(RegExp(r'[^\p{L}\p{N} ._-]', unicode: true), '_');
    if (safe.isEmpty || safe == '.' || safe == '..') safe = 'documento.pdf';
    final file = File(
      '${directory.path}/${DateTime.now().microsecondsSinceEpoch}-$safe',
    );
    await file.writeAsBytes(bytes, flush: true);
    final result = await OpenFilex.open(file.path);
    if (result.type != ResultType.done) {
      throw const FileSystemException(
        'No fue posible abrir el archivo. Instale una aplicación compatible.',
      );
    }
  }
}
