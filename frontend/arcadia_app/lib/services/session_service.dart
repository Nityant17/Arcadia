import 'package:shared_preferences/shared_preferences.dart';

class SessionService {
  static const _kUserId = 'user_id';
  static const _kName = 'name';
  static const _kEmail = 'email';
  static const _kToken = 'token';

  Future<void> saveSession({
    required String userId,
    required String name,
    required String email,
    required String token,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kUserId, userId);
    await prefs.setString(_kName, name);
    await prefs.setString(_kEmail, email);
    await prefs.setString(_kToken, token);
  }

  Future<Map<String, String>?> loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    final userId = prefs.getString(_kUserId);
    final name = prefs.getString(_kName);
    final email = prefs.getString(_kEmail);
    final token = prefs.getString(_kToken);

    if (userId == null || token == null) return null;

    return {
      'user_id': userId,
      'name': name ?? '',
      'email': email ?? '',
      'token': token,
    };
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kUserId);
    await prefs.remove(_kName);
    await prefs.remove(_kEmail);
    await prefs.remove(_kToken);
  }
}
