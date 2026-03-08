// Data models matching the backend API schemas.

class ArcadiaDocument {
  final String id;
  final String filename;
  final String originalName;
  final String subject;
  final String topic;
  final int chunkCount;
  final String extractedTextPreview;
  final DateTime createdAt;

  ArcadiaDocument({
    required this.id,
    required this.filename,
    required this.originalName,
    required this.subject,
    required this.topic,
    required this.chunkCount,
    required this.extractedTextPreview,
    required this.createdAt,
  });

  factory ArcadiaDocument.fromJson(Map<String, dynamic> json) {
    return ArcadiaDocument(
      id: json['id'] ?? '',
      filename: json['filename'] ?? '',
      originalName: json['original_name'] ?? '',
      subject: json['subject'] ?? 'General',
      topic: json['topic'] ?? '',
      chunkCount: json['chunk_count'] ?? 0,
      extractedTextPreview: json['extracted_text_preview'] ?? '',
      createdAt: DateTime.tryParse(json['created_at'] ?? '') ?? DateTime.now(),
    );
  }
}

class ChatMessage {
  final String role; // 'user' or 'assistant'
  String content;
  final String originalContent; // always English, for re-translation
  final DateTime timestamp;

  ChatMessage({
    required this.role,
    required this.content,
    String? originalContent,
    DateTime? timestamp,
  })  : originalContent = originalContent ?? content,
        timestamp = timestamp ?? DateTime.now();
}

class QuizQuestion {
  final int id;
  final String question;
  final List<String> options;
  final int tier;
  int? selectedOption;

  QuizQuestion({
    required this.id,
    required this.question,
    required this.options,
    required this.tier,
    this.selectedOption,
  });

  factory QuizQuestion.fromJson(Map<String, dynamic> json) {
    return QuizQuestion(
      id: json['id'] ?? 0,
      question: json['question'] ?? '',
      options: List<String>.from(json['options'] ?? []),
      tier: json['tier'] ?? 1,
    );
  }
}

class QuizResult {
  final int questionId;
  final String question;
  final int selectedOption;
  final int correctOption;
  final bool isCorrect;
  final String explanation;

  QuizResult({
    required this.questionId,
    required this.question,
    required this.selectedOption,
    required this.correctOption,
    required this.isCorrect,
    required this.explanation,
  });

  factory QuizResult.fromJson(Map<String, dynamic> json) {
    return QuizResult(
      questionId: json['question_id'] ?? 0,
      question: json['question'] ?? '',
      selectedOption: json['selected_option'] ?? -1,
      correctOption: json['correct_option'] ?? 0,
      isCorrect: json['is_correct'] ?? false,
      explanation: json['explanation'] ?? '',
    );
  }
}

class QuizSubmitResult {
  final String quizId;
  final int tier;
  final int totalQuestions;
  final int correctAnswers;
  final double score;
  final List<QuizResult> results;
  final bool nextTierUnlocked;
  final double masteryScore;

  QuizSubmitResult({
    required this.quizId,
    required this.tier,
    required this.totalQuestions,
    required this.correctAnswers,
    required this.score,
    required this.results,
    required this.nextTierUnlocked,
    required this.masteryScore,
  });

  factory QuizSubmitResult.fromJson(Map<String, dynamic> json) {
    return QuizSubmitResult(
      quizId: json['quiz_id'] ?? '',
      tier: json['tier'] ?? 1,
      totalQuestions: json['total_questions'] ?? 0,
      correctAnswers: json['correct_answers'] ?? 0,
      score: (json['score'] ?? 0).toDouble(),
      results: (json['results'] as List? ?? [])
          .map((r) => QuizResult.fromJson(r))
          .toList(),
      nextTierUnlocked: json['next_tier_unlocked'] ?? false,
      masteryScore: (json['mastery_score'] ?? 0).toDouble(),
    );
  }
}

class Flashcard {
  final String front;
  final String back;
  bool isFlipped;

  Flashcard({
    required this.front,
    required this.back,
    this.isFlipped = false,
  });

  factory Flashcard.fromJson(Map<String, dynamic> json) {
    return Flashcard(
      front: json['front'] ?? '',
      back: json['back'] ?? '',
    );
  }
}

class DashboardStats {
  final int totalDocuments;
  final int totalQuizzesTaken;
  final double averageScore;
  final int topicsMastered;

  DashboardStats({
    required this.totalDocuments,
    required this.totalQuizzesTaken,
    required this.averageScore,
    required this.topicsMastered,
  });

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    return DashboardStats(
      totalDocuments: json['total_documents'] ?? 0,
      totalQuizzesTaken: json['total_quizzes_taken'] ?? 0,
      averageScore: (json['average_score'] ?? 0).toDouble(),
      topicsMastered: json['topics_mastered'] ?? 0,
    );
  }
}

class TopicMastery {
  final String documentId;
  final String topic;
  final double masteryScore;
  final int tierUnlocked;
  final int totalAttempts;

  TopicMastery({
    required this.documentId,
    required this.topic,
    required this.masteryScore,
    required this.tierUnlocked,
    required this.totalAttempts,
  });

  factory TopicMastery.fromJson(Map<String, dynamic> json) {
    return TopicMastery(
      documentId: json['document_id'] ?? '',
      topic: json['topic'] ?? '',
      masteryScore: (json['mastery_score'] ?? 0).toDouble(),
      tierUnlocked: json['tier_unlocked'] ?? 1,
      totalAttempts: json['total_attempts'] ?? 0,
    );
  }
}

class TopicItem {
  final String title;
  final String summary;

  TopicItem({required this.title, required this.summary});

  factory TopicItem.fromJson(Map<String, dynamic> json) {
    return TopicItem(
      title: json['title'] ?? '',
      summary: json['summary'] ?? '',
    );
  }
}
