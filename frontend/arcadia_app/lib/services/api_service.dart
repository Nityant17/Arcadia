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
  String? _token;

  void setToken(String? token) {
    _token = token;
  }

  Map<String, String> _jsonHeaders() {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (_token != null && _token!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  // ─── Auth ───────────────────────────────────────────────

  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final response = await http.post(
      Uri.parse('$_base/auth/register'),
      headers: _jsonHeaders(),
      body: jsonEncode({'name': name, 'email': email, 'password': password}),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Registration failed: ${response.body}');
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final response = await http.post(
      Uri.parse('$_base/auth/login'),
      headers: _jsonHeaders(),
      body: jsonEncode({'email': email, 'password': password}),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Login failed: ${response.body}');
  }

  // ─── Upload ─────────────────────────────────────────────

  Future<ArcadiaDocument> uploadDocument({
    required String fileName,
    required List<int> fileBytes,
    String subject = 'General',
    String topic = '',
  }) async {
    var request = http.MultipartRequest('POST', Uri.parse('$_base/upload'));
    if (_token != null && _token!.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $_token';
    }
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
    final response = await http.get(Uri.parse('$_base/documents'), headers: _jsonHeaders());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return (data['documents'] as List)
          .map((d) => ArcadiaDocument.fromJson(d))
          .toList();
    }
    throw Exception('Failed to load documents');
  }

  Future<void> deleteDocument(String docId) async {
    final response = await http.delete(Uri.parse('$_base/documents/$docId'), headers: _jsonHeaders());
    if (response.statusCode != 200) {
      throw Exception('Failed to delete document');
    }
  }

  // ─── Chat ───────────────────────────────────────────────

  Future<String> chat({
    String documentId = '',
    List<String> documentIds = const [],
    String topic = '',
    String userId = 'guest',
    required String message,
    String language = 'en',
  }) async {
    final response = await http.post(
      Uri.parse('$_base/chat'),
      headers: _jsonHeaders(),
      body: jsonEncode({
        'document_id': documentId,
        'document_ids': documentIds,
        'topic': topic,
        'user_id': userId,
        'message': message,
        'language': language,
      }),
    ).timeout(const Duration(seconds: 120));

    if (response.statusCode == 200) {
      return jsonDecode(response.body)['answer'];
    }
    throw Exception('Chat failed: ${response.body}');
  }

  Future<List<Map<String, dynamic>>> getChatHistory(String documentId) async {
    final response = await http.get(Uri.parse('$_base/chat/history/$documentId'), headers: _jsonHeaders());
    
    if (response.statusCode == 200) {
      return List<Map<String, dynamic>>.from(jsonDecode(response.body));
    }
    throw Exception('Failed to load chat history');
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
      headers: _jsonHeaders(),
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
    String userId = 'guest',
    required List<Map<String, int>> answers,
  }) async {
    final response = await http.post(
      Uri.parse('$_base/quiz/submit'),
      headers: _jsonHeaders(),
      body: jsonEncode({
        'quiz_id': quizId,
        'document_id': documentId,
        'user_id': userId,
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
      headers: _jsonHeaders(),
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
      headers: _jsonHeaders(),
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
      headers: _jsonHeaders(),
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
      headers: _jsonHeaders(),
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
      headers: _jsonHeaders(),
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
      headers: _jsonHeaders(),
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
    final response = await http.get(Uri.parse('$_base/dashboard/stats'), headers: _jsonHeaders());
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to load dashboard');
  }

  Future<void> resetProgress() async {
    final response = await http.delete(Uri.parse('$_base/dashboard/reset'), headers: _jsonHeaders())
        .timeout(const Duration(seconds: 30));
    if (response.statusCode != 200) {
      throw Exception('Reset failed: ${response.body}');
    }
  }

  // ─── Timetable & Spaced Repetition ─────────────────────

  Future<Map<String, dynamic>> createPlan({
    required String userId,
    required String title,
    required List<Map<String, dynamic>> subjects,
  }) async {
    final response = await http.post(
      Uri.parse('$_base/planner/create'),
      headers: _jsonHeaders(),
      body: jsonEncode({
        'user_id': userId,
        'title': title,
        'subjects': subjects,
      }),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to create plan: ${response.body}');
  }

  Future<Map<String, dynamic>> getPlanTasks(String userId) async {
    final response = await http.get(Uri.parse('$_base/planner/tasks?user_id=$userId'), headers: _jsonHeaders());
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to get tasks');
  }

  Future<void> completeTask(String taskId) async {
    final response = await http.post(Uri.parse('$_base/planner/tasks/$taskId/complete'), headers: _jsonHeaders());
    if (response.statusCode != 200) {
      throw Exception('Failed to complete task');
    }
  }

  // ─── Whiteboard Hints ──────────────────────────────────

  Future<Map<String, dynamic>> whiteboardHint({
    required String imageBase64,
    required String question,
    String topic = '',
  }) async {
    final response = await http.post(
      Uri.parse('$_base/whiteboard/hint'),
      headers: _jsonHeaders(),
      body: jsonEncode({
        'image_base64': imageBase64,
        'question': question,
        'topic': topic,
      }),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Hint failed: ${response.body}');
  }

  // ─── Challenge Rooms ────────────────────────────────

  Future<Map<String, dynamic>> createChallengeRoom({
    required String documentId,
    int tier = 1,
    int numQuestions = 5,
    String language = 'en',
    String focusTopic = '',
  }) async {
    final response = await http.post(
      Uri.parse('$_base/challenge/create'),
      headers: _jsonHeaders(),
      body: jsonEncode({
        'document_id': documentId,
        'tier': tier,
        'num_questions': numQuestions,
        'language': language,
        'focus_topic': focusTopic,
      }),
    );
    if (response.statusCode == 200) return jsonDecode(response.body);
    throw Exception('Create room failed: ${response.body}');
  }

  Future<Map<String, dynamic>> joinChallengeRoom(String code) async {
    final response = await http.post(
      Uri.parse('$_base/challenge/join'),
      headers: _jsonHeaders(),
      body: jsonEncode({'code': code}),
    );
    if (response.statusCode == 200) return jsonDecode(response.body);
    throw Exception('Join room failed: ${response.body}');
  }

  Future<Map<String, dynamic>> getChallengeRoom(String code) async {
    final response = await http.get(
      Uri.parse('$_base/challenge/$code'),
      headers: _jsonHeaders(),
    );
    if (response.statusCode == 200) return jsonDecode(response.body);
    throw Exception('Get room failed: ${response.body}');
  }

  Future<void> startChallengeRoom(String code) async {
    final response = await http.post(
      Uri.parse('$_base/challenge/$code/start'),
      headers: _jsonHeaders(),
    );
    if (response.statusCode != 200) throw Exception('Start room failed: ${response.body}');
  }

  Future<Map<String, dynamic>> submitChallenge(String code, List<Map<String, int>> answers) async {
    final response = await http.post(
      Uri.parse('$_base/challenge/$code/submit'),
      headers: _jsonHeaders(),
      body: jsonEncode({'answers': answers}),
    );
    if (response.statusCode == 200) return jsonDecode(response.body);
    throw Exception('Submit challenge failed: ${response.body}');
  }

  Future<Map<String, dynamic>> getChallengeLeaderboard(String code) async {
    final response = await http.get(
      Uri.parse('$_base/challenge/$code/leaderboard'),
      headers: _jsonHeaders(),
    );
    if (response.statusCode == 200) return jsonDecode(response.body);
    throw Exception('Leaderboard failed: ${response.body}');
  }
}
