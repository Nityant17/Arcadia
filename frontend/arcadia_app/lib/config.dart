/// Arcadia App Configuration
class AppConfig {
  // Change this to your backend URL
  // For Android emulator: 10.0.2.2:8000
  // For physical device: your local IP (e.g., 192.168.1.100:8000)
  // For web/desktop: localhost:8000
  static const String baseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://localhost:8000',
  );

  static const String apiBase = '$baseUrl/api';

  // App info
  static const String appName = 'Arcadia';
  static const String appTagline = 'Multimodal Adaptive Mastery Engine';

  // Supported languages
  static const Map<String, String> supportedLanguages = {
    'en': 'English',
    'hi': 'Hindi',
    'ta': 'Tamil',
    'te': 'Telugu',
    'mr': 'Marathi',
    'bn': 'Bengali',
    'gu': 'Gujarati',
    'kn': 'Kannada',
    'ml': 'Malayalam',
  };
}
