import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;
import '../theme.dart';
import '../config.dart';
import '../services/api_service.dart';
import '../models/models.dart';

class QuizScreen extends StatefulWidget {
  final ArcadiaDocument document;
  final String userId;

  const QuizScreen({super.key, required this.document, required this.userId});

  @override
  State<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends State<QuizScreen> {
  int _selectedTier = 1;
  bool _loading = false;
  bool _submitted = false;
  String? _quizId;
  List<QuizQuestion> _questions = [];
  QuizSubmitResult? _result;
  String _language = 'en';
  final List<Offset?> _whiteboardPoints = [];
  String? _hint;
  bool _hintLoading = false;
  final GlobalKey _whiteboardKey = GlobalKey();

  // Topic selection
  List<TopicItem> _topics = [];
  bool _topicsLoading = false;
  String _selectedTopic = '';  // empty = full document

  Color _tierColor(int tier) {
    switch (tier) {
      case 1: return ArcadiaTheme.tier1;
      case 2: return ArcadiaTheme.tier2;
      case 3: return ArcadiaTheme.tier3;
      default: return ArcadiaTheme.primary;
    }
  }

  Future<void> _clearWhiteboard() async {
    setState(() {
      _whiteboardPoints.clear();
      _hint = null;
    });
  }

  Future<void> _getWhiteboardHint() async {
    if (_whiteboardPoints.isEmpty || _questions.isEmpty) return;

    setState(() {
      _hintLoading = true;
      _hint = null;
    });

    try {
      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder);
      const size = Size(900, 420);

      final bgPaint = Paint()..color = Colors.white;
      canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), bgPaint);

      final strokePaint = Paint()
        ..color = Colors.black
        ..strokeWidth = 4
        ..strokeCap = StrokeCap.round;

      for (int i = 0; i < _whiteboardPoints.length - 1; i++) {
        final p1 = _whiteboardPoints[i];
        final p2 = _whiteboardPoints[i + 1];
        if (p1 != null && p2 != null) {
          canvas.drawLine(p1, p2, strokePaint);
        }
      }

      final image = await recorder.endRecording().toImage(size.width.toInt(), size.height.toInt());
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      if (bytes == null) return;

      final base64Image = base64Encode(Uint8List.view(bytes.buffer));
      final currentQuestion = _questions.first.question;
      final data = await ApiService().whiteboardHint(
        imageBase64: base64Image,
        question: currentQuestion,
        topic: _selectedTopic,
      );
      if (mounted) {
        setState(() => _hint = (data['hint'] ?? '').toString());
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Hint generation failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _hintLoading = false);
    }
  }

  String _tierLabel(int tier) {
    switch (tier) {
      case 1: return 'Tier 1 — Recall';
      case 2: return 'Tier 2 — Application';
      case 3: return 'Tier 3 — Analysis';
      default: return 'Unknown';
    }
  }

  Future<void> _extractTopics() async {
    setState(() => _topicsLoading = true);
    try {
      _topics = await ApiService().extractTopics(widget.document.id);
    } catch (e) {
      // Silently fail — user can still use full document
    }
    if (mounted) setState(() => _topicsLoading = false);
  }

  Future<void> _generateQuiz() async {
    setState(() {
      _loading = true;
      _submitted = false;
      _result = null;
      _questions = [];
    });

    try {
      final data = await ApiService().generateQuiz(
        documentId: widget.document.id,
        tier: _selectedTier,
        numQuestions: 5,
        language: _language,
        focusTopic: _selectedTopic,
      );
      _quizId = data['quiz_id'];
      _questions = (data['questions'] as List)
          .map((q) => QuizQuestion.fromJson(q))
          .toList();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submitQuiz() async {
    // Check all questions answered
    if (_questions.any((q) => q.selectedOption == null)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please answer all questions before submitting.')),
      );
      return;
    }

    setState(() => _loading = true);

    try {
      final answers = _questions.map((q) => {
        'question_id': q.id,
        'selected_option': q.selectedOption!,
      }).toList();

      _result = await ApiService().submitQuiz(
        quizId: _quizId!,
        documentId: widget.document.id,
        userId: widget.userId,
        answers: answers,
      );
      setState(() => _submitted = true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Submission error: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Adaptive Quiz'),
        actions: [
          PopupMenuButton<String>(
            icon: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.translate, size: 20),
                const SizedBox(width: 4),
                Text(_language.toUpperCase(),
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              ],
            ),
            onSelected: (lang) => setState(() => _language = lang),
            itemBuilder: (ctx) => AppConfig.supportedLanguages.entries
                .map((e) => PopupMenuItem(
                      value: e.key,
                      child: Row(
                        children: [
                          if (_language == e.key)
                            const Icon(Icons.check, size: 18, color: ArcadiaTheme.primary)
                          else
                            const SizedBox(width: 18),
                          const SizedBox(width: 8),
                          Text(e.value),
                        ],
                      ),
                    ))
                .toList(),
          ),
        ],
      ),
      body: _questions.isEmpty ? _buildSetup() : (_submitted ? _buildResults() : _buildQuiz()),
    );
  }

  Widget _buildSetup() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Document info
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(Icons.description, color: ArcadiaTheme.primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.document.originalName,
                            style: const TextStyle(fontWeight: FontWeight.w600)),
                        Text('${widget.document.subject} · ${widget.document.chunkCount} chunks',
                            style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 20),

          // Topic selection
          Row(
            children: [
              const Text('Focus Topic',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              const Spacer(),
              if (_topics.isEmpty)
                TextButton.icon(
                  onPressed: _topicsLoading ? null : _extractTopics,
                  icon: _topicsLoading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.auto_awesome, size: 18),
                  label: Text(_topicsLoading ? 'Extracting...' : 'Extract Topics'),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ChoiceChip(
                label: const Text('Full Document'),
                selected: _selectedTopic.isEmpty,
                onSelected: (_) => setState(() => _selectedTopic = ''),
                selectedColor: ArcadiaTheme.primary.withValues(alpha: 0.2),
              ),
              ..._topics.map((t) => ChoiceChip(
                    label: Text(t.title),
                    selected: _selectedTopic == t.title,
                    onSelected: (_) =>
                        setState(() => _selectedTopic = t.title),
                    selectedColor: ArcadiaTheme.primary.withValues(alpha: 0.2),
                    tooltip: t.summary,
                  )),
            ],
          ),

          const SizedBox(height: 20),

          // Tier selection
          const Text('Select Difficulty Tier',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),

          ...List.generate(3, (i) {
            final tier = i + 1;
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: GestureDetector(
                onTap: () => setState(() => _selectedTier = tier),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: _selectedTier == tier
                          ? _tierColor(tier)
                          : Colors.grey.shade200,
                      width: _selectedTier == tier ? 2 : 1,
                    ),
                    borderRadius: BorderRadius.circular(12),
                    color: _selectedTier == tier
                        ? _tierColor(tier).withValues(alpha: 0.05)
                        : Colors.white,
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: _tierColor(tier).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Center(
                          child: Text(
                            '$tier',
                            style: TextStyle(
                              color: _tierColor(tier),
                              fontWeight: FontWeight.w700,
                              fontSize: 16,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_tierLabel(tier),
                                style: const TextStyle(fontWeight: FontWeight.w600)),
                            Text(
                              tier == 1
                                  ? 'Definitions, facts, key terms'
                                  : tier == 2
                                      ? 'Problem-solving, scenarios'
                                      : 'Evaluation, synthesis, critical thinking',
                              style: TextStyle(
                                  color: Colors.grey.shade600, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                      if (_selectedTier == tier)
                        Icon(Icons.check_circle, color: _tierColor(tier)),
                    ],
                  ),
                ),
              ),
            );
          }),

          const SizedBox(height: 20),

          // Generate button
          ElevatedButton(
            onPressed: _loading ? null : _generateQuiz,
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            child: _loading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2),
                  )
                : const Text('Generate Quiz'),
          ),
        ],
      ),
    );
  }

  Widget _buildQuiz() {
    return Column(
      children: [
        // Progress bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          color: _tierColor(_selectedTier).withValues(alpha: 0.1),
          child: Row(
            children: [
              Text(
                _tierLabel(_selectedTier),
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: _tierColor(_selectedTier),
                ),
              ),
              const Spacer(),
              Text(
                '${_questions.where((q) => q.selectedOption != null).length}/${_questions.length} answered',
                style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
              ),
            ],
          ),
        ),

        // Questions
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                margin: const EdgeInsets.only(bottom: 16),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Rough Work Whiteboard',
                          style: TextStyle(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      Container(
                        key: _whiteboardKey,
                        height: 320,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border.all(color: Colors.grey.shade300),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: GestureDetector(
                          onPanUpdate: (details) {
                            final box = _whiteboardKey.currentContext?.findRenderObject() as RenderBox?;
                            if (box == null) return;
                            final localPos = box.globalToLocal(details.globalPosition);
                            setState(() => _whiteboardPoints.add(localPos));
                          },
                          onPanEnd: (_) => _whiteboardPoints.add(null),
                          child: CustomPaint(
                            painter: _WhiteboardPainter(_whiteboardPoints),
                            size: const Size(double.infinity, 320),
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Use this full rough-work area to solve steps. Arcadia analyzes your writing and gives smart hints.',
                        style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          OutlinedButton.icon(
                            onPressed: _clearWhiteboard,
                            icon: const Icon(Icons.cleaning_services_outlined),
                            label: const Text('Clear'),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton.icon(
                            onPressed: _hintLoading ? null : _getWhiteboardHint,
                            icon: _hintLoading
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Icon(Icons.lightbulb_outline),
                            label: const Text('Get AI Hint'),
                          ),
                        ],
                      ),
                      if (_hint != null) ...[
                        const SizedBox(height: 10),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade50,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Colors.amber.shade200),
                          ),
                          child: Text(_hint!, style: const TextStyle(fontSize: 13)),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              ...List.generate(
                _questions.length,
                (index) => _buildQuestionCard(_questions[index], index),
              ),
            ],
          ),
        ),

        // Submit button
        Container(
          padding: const EdgeInsets.all(16),
          child: SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _loading ? null : _submitQuiz,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: _loading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                    )
                  : const Text('Submit Answers'),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildQuestionCard(QuizQuestion q, int index) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Q${index + 1}. ${q.question}',
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
            ),
            const SizedBox(height: 12),
            ...List.generate(q.options.length, (optIndex) {
              final isSelected = q.selectedOption == optIndex;
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: GestureDetector(
                  onTap: () => setState(() => q.selectedOption = optIndex),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? ArcadiaTheme.primary.withValues(alpha: 0.1)
                          : Colors.grey.shade50,
                      border: Border.all(
                        color: isSelected
                            ? ArcadiaTheme.primary
                            : Colors.grey.shade200,
                      ),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: isSelected
                                ? ArcadiaTheme.primary
                                : Colors.grey.shade200,
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child: Text(
                              String.fromCharCode(65 + optIndex),
                              style: TextStyle(
                                color: isSelected ? Colors.white : Colors.grey.shade600,
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(q.options[optIndex],
                              style: const TextStyle(fontSize: 14)),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildResults() {
    if (_result == null) return const SizedBox();
    final r = _result!;
    final percentage = (r.score * 100).round();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Score card
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: percentage >= 70
                  ? const LinearGradient(colors: [Color(0xFF4CAF50), Color(0xFF66BB6A)])
                  : percentage >= 40
                      ? const LinearGradient(colors: [Color(0xFFFF9800), Color(0xFFFFA726)])
                      : const LinearGradient(colors: [Color(0xFFF44336), Color(0xFFEF5350)]),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                Text(
                  '$percentage%',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 48,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  '${r.correctAnswers}/${r.totalQuestions} correct',
                  style: const TextStyle(color: Colors.white70, fontSize: 16),
                ),
                const SizedBox(height: 8),
                Text(
                  _tierLabel(r.tier),
                  style: const TextStyle(color: Colors.white70),
                ),
                if (r.nextTierUnlocked)
                  Container(
                    margin: const EdgeInsets.only(top: 12),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.lock_open, color: Colors.white, size: 18),
                        SizedBox(width: 8),
                        Text('Next tier unlocked!',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Mastery score
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.trending_up, color: ArcadiaTheme.primary),
                  const SizedBox(width: 12),
                  Text('Mastery Score: ${(r.masteryScore * 100).round()}%',
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Detailed results
          ...r.results.map((res) => Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            res.isCorrect ? Icons.check_circle : Icons.cancel,
                            color: res.isCorrect ? Colors.green : Colors.red,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(res.question,
                                style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
                          ),
                        ],
                      ),
                      if (!res.isCorrect && res.explanation.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.blue.shade50,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(Icons.lightbulb_outline,
                                  size: 18, color: Colors.blue.shade700),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(res.explanation,
                                    style: TextStyle(
                                        fontSize: 13, color: Colors.blue.shade800)),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              )),

          const SizedBox(height: 16),

          // Actions
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => setState(() {
                    _questions = [];
                    _submitted = false;
                    _result = null;
                  }),
                  icon: const Icon(Icons.refresh),
                  label: const Text('New Quiz'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: r.nextTierUnlocked
                      ? () {
                          setState(() {
                            _selectedTier = (_selectedTier + 1).clamp(1, 3);
                            _questions = [];
                            _submitted = false;
                            _result = null;
                          });
                          _generateQuiz();
                        }
                      : null,
                  icon: const Icon(Icons.arrow_upward),
                  label: const Text('Next Tier'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _WhiteboardPainter extends CustomPainter {
  final List<Offset?> points;

  _WhiteboardPainter(this.points);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    for (int i = 0; i < points.length - 1; i++) {
      final p1 = points[i];
      final p2 = points[i + 1];
      if (p1 != null && p2 != null) {
        canvas.drawLine(p1, p2, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
