// client-app/lib/services/auth_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthService {
  final String _baseUrl = 'https://api.caf-mexico.org/api/v1'; // Production API URL
  final _storage = const FlutterSecureStorage();

  Future<String?> getToken() async {
    return await _storage.read(key: 'jwt');
  }

  Future<void> logout() async {
    await _storage.delete(key: 'jwt');
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    // ... (existing login code, no changes needed)
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/login'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'email': email, 'password': password}),
      );
      final responseBody = json.decode(response.body);
      if (response.statusCode == 200) {
        await _storage.write(key: 'jwt', value: responseBody['token']);
        return {'success': true, 'message': 'Login successful'};
      } else {
        return {'success': false, 'message': responseBody['error'] ?? 'An unknown error occurred'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Could not connect to the server. Please try again later.'};
    }
  }

  Future<Map<String, dynamic>> register({
    required String firstName,
    required String lastName,
    required String email,
    required String password,
  }) async {
    // ... (existing register code, no changes needed)
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/register'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'firstName': firstName,
          'lastName': lastName,
          'email': email,
          'password': password,
        }),
      );
      final responseBody = json.decode(response.body);
      if (response.statusCode == 201) {
        return {'success': true, 'message': responseBody['message']};
      } else {
        return {'success': false, 'message': responseBody['error'] ?? 'An unknown error occurred'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Could not connect to the server. Please try again later.'};
    }
  }

  // --- NEW ---
  // Handles the create appointment API call.
  Future<Map<String, dynamic>> createAppointment({
    required String category,
    required String description,
  }) async {
    // Step 1: Get the token from secure storage.
    final token = await getToken();
    if (token == null) {
      return {'success': false, 'message': 'Not authenticated. Please log in again.'};
    }

    try {
      // Step 2: Make the authenticated request.
      final response = await http.post(
        Uri.parse('$_baseUrl/appointments'),
        // Include the JWT in the Authorization header.
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode({
          'category': category,
          'description': description,
        }),
      );

      final responseBody = json.decode(response.body);

      // Step 3: Process the response.
      if (response.statusCode == 201) {
        return {'success': true, 'message': responseBody['message']};
      } else {
        return {'success': false, 'message': responseBody['error'] ?? 'Failed to create appointment'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Could not connect to the server.'};
    }
  }
}
