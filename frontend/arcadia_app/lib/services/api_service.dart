import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../models/models.dart';

/// Central API service for all backend communication.
class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  final String _base = AppConfig.apiBase;

  // ─── Upload ─────────────────────────────────────────────

  Future<ArcadiaDocument> uploadDocument({
    required String fileName,
    required List<int> fileBytes,
    String subject = 'General',
    String topic = '',
  }) async {
    var request = http.MultipartRequest('POST', Uri.parse('$_base/upload'));
    request.fields['subject'] = subject;
    request.fields['topic'] = topic;
    request.files.add(http.MultipartFile.fromBytes(
      'file',
      fileBytes,
      filename: fileName,
    ));

    final streamedResponse = await request.send().timeout(
      const Duration(seconds: 120),
    );
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode == 200) {
      return ArcadiaDocument.fromJson(jsonDecode(response.body));
    }
    throw Exception('Upload failed: ${response.body}');
  }

  Future<List<ArcadiaDocument>> getDocuments() async {
    final response = await http.get(Uri.parse('$_base/documents'));
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return (data['documents'] as List)
          .map((d) => ArcadiaDocument.fromJson(d))
          .toList();
    }
    throw Exception('Failed to load documents');
  }

  Future<void> deleteDocument(String docId) async {
    final response = await http.delete(Uri.parse('$_base/documents/$docId'));
    if (response.statusCode != 200) {
      throw Exception('Failed to delete document');
    }
  }

  // ─── Chat ───────────────────────────────────────────────

  Future<String> chat({
    required String documentId,
    required String message,
    String language = 'en',
  }) async {
    final response = await http.post(
      Uri.parse('$_base/chat'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'document_id': documentId,
        'message': message,
        'language': language,
      }),
    ).timeout(const Duration(seconds: 120));

    if (response.statusCode == 200) {
      return jsonDecode(response.body)['answer'];
    }
    throw Exception('Chat failed: ${response.body}');
  }

  // ─── Quiz ───────────────────────────────────────────────

  Future<Map<String, dynamic>> generateQuiz({
    required String documentId,
    int tier = 1,
    int numQuestions = 5,
    String language = 'en',
    String focusTopic = '',
  }) async {
    final response = await http.post(
      Uri.parse('$_base/quiz/generate'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'document_id': documentId,
        'tier': tier,
        'num_questions': numQuestions,
        'language': language,
        'focus_topic': focusTopic,
      }),
    ).timeout(const Duration(seconds: 120));

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Quiz generation failed: ${response.body}');
  }

  Future<QuizSubmitResult> submitQuiz({
    required String quizId,
    required String documentId,
    required List<Map<String, int>> answers,
  }) async {
    final response = await http.post(
      Uri.parse('$_base/quiz/submit'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'quiz_id': quizId,
        'document_id': documentId,
        'answers': answers,
      }),
    ).timeout(const Duration(seconds: 30));

    if (response.statusCode == 200) {
      return QuizSubmitResult.fromJson(jsonDecode(response.body));
    }
    throw Exception('Quiz submission failed: ${response.body}');
  }

  // ─── Generate ───────────────────────────────────────────

  Future<String> generateCheatsheet({
    required String documentId,
    String language = 'en',
    String focusTopic = '',
  }) async {
    final response = await http.post(
      Uri.parse('$_base/generate/cheatsheet'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'document_id': documentId,
        'language': language,
        'focus_topic': focusTopic,
      }),
    ).timeout(const Duration(seconds: 120));

    if (response.statusCode == 200) {
      return jsonDecode(response.body)['content'];
    }
    throw Exception('Cheatsheet generation failed: ${response.body}');
  }

  Future<List<Flashcard>> generateFlashcards({
    required String documentId,
    String language = 'en',
    String focusTopic = '',
  }) async {
    final response = await http.post(
      Uri.parse('$_base/generate/flashcards'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'document_id': documentId,
        'language': language,
        'focus_topic': focusTopic,
      }),
    ).timeout(const Duration(seconds: 120));

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return (data['cards'] as List)
          .map((c) => Flashcard.fromJson(c))
          .toList();
    }
    throw Exception('Flashcard generation failed: ${response.body}');
  }

  Future<String> generateDiagram({
    required String documentId,
  }) async {
    final response = await http.post(
      Uri.parse('$_base/generate/diagram'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'document_id': documentId,
      }),
    ).timeout(const Duration(seconds: 120));

    if (response.statusCode == 200) {
      return jsonDecode(response.body)['mermaid_code'];
    }
    throw Exception('Diagram generation failed: ${response.body}');
  }

  // ─── TTS & Translation ─────────────────────────────────

  Future<String> textToSpeech({
    required String text,
    String language = 'en',
  }) async {
    final response = await http.post(
      Uri.parse('$_base/tts'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'text': text,
        'language': language,
      }),
    ).timeout(const Duration(seconds: 30));

    if (response.statusCode == 200) {
      final audioUrl = jsonDecode(response.body)['audio_url'];
      return '${AppConfig.baseUrl}$audioUrl';
    }
    throw Exception('TTS failed: ${response.body}');
  }

  Future<String> translate({
    required String text,
    required String targetLanguage,
    String sourceLanguage = 'en',
  }) async {
    final response = await http.post(
      Uri.parse('$_base/translate'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'text': text,
        'target_language': targetLanguage,
        'source_language': sourceLanguage,
      }),
    ).timeout(const Duration(seconds: 30));

    if (response.statusCode == 200) {
      return jsonDecode(response.body)['translated_text'];
    }
    throw Exception('Translation failed: ${response.body}');
  }

  // ─── Dashboard ──────────────────────────────────────────

  Future<List<TopicItem>> extractTopics(String documentId) async {
    final response = await http.post(
      Uri.parse('$_base/documents/$documentId/topics'),
    ).timeout(const Duration(seconds: 120));

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return (data['topics'] as List)
          .map((t) => TopicItem.fromJson(t))
          .toList();
    }
    throw Exception('Topic extraction failed: ${response.body}');
  }

  Future<Map<String, dynamic>> getDashboard() async {
    final response = await http.get(Uri.parse('$_base/dashboard/stats'));
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to load dashboard');
  }

  Future<void> resetProgress() async {
    final response = await http.delete(Uri.parse('$_base/dashboard/reset'))
        .timeout(const Duration(seconds: 30));
    if (response.statusCode != 200) {
      throw Exception('Reset failed: ${response.body}');
    }
  }
}
