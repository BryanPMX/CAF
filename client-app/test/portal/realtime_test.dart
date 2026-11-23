import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:client_app/src/app_state.dart';

class _Sink extends Fake implements WebSocketSink {
  bool closed = false;
  @override
  Future<void> close([int? closeCode, String? closeReason]) async {
    closed = true;
  }
}

class _Channel extends Fake implements WebSocketChannel {
  final handshake = Completer<void>();
  final events = StreamController<dynamic>();
  final connectionSink = _Sink();
  @override
  Future<void> get ready => handshake.future;
  @override
  Stream<dynamic> get stream => events.stream;
  @override
  WebSocketSink get sink => connectionSink;
}

void main() {
  test(
    'failed asynchronous handshake is handled and never reports connected',
    () async {
      final channel = _Channel();
      final states = <bool>[];
      final service = RealtimeService(
        onNotificationMessage: (_) {},
        onConnectionChanged: states.add,
        channelFactory: (_, protocols) {
          expect(protocols, ['caf.jwt.test-token']);
          return channel;
        },
      );
      service.connect('test-token');
      channel.handshake.completeError(StateError('Server unavailable'));
      await Future<void>.delayed(Duration.zero);
      expect(service.isConnected, false);
      expect(states, isEmpty);
      service.dispose();
      await channel.events.close();
    },
  );

  test(
    'logout while handshake is pending cannot reconnect the old session',
    () async {
      final channel = _Channel();
      final service = RealtimeService(
        onNotificationMessage: (_) {},
        onConnectionChanged: (_) {},
        channelFactory: (_, __) => channel,
      );
      service.connect('test-token');
      service.disconnect();
      channel.handshake.complete();
      await Future<void>.delayed(Duration.zero);
      expect(service.isConnected, false);
      expect(channel.connectionSink.closed, true);
      service.dispose();
      await channel.events.close();
    },
  );
}
