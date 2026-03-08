import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:audioplayers/audioplayers.dart';
import '../theme.dart';
import '../config.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import '../widgets/mermaid_diagram_view.dart';

class StudyMaterialsScreen extends StatefulWidget {
  final ArcadiaDocument document;

  const StudyMaterialsScreen({super.key, required this.document});

  @override
  State<StudyMaterialsScreen> createState() => _StudyMaterialsScreenState();
}

class _StudyMaterialsScreenState extends State<StudyMaterialsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _audioPlayer = AudioPlayer();
  String _language = 'en';
  bool _isPlaying = false;
  String? _playingSource; // 'cheatsheet' or 'flashcard'

  // Cheatsheet state
  String? _cheatsheet;
  bool _cheatsheetLoading = false;

  // Flashcards state
  List<Flashcard> _flashcards = [];
  bool _flashcardsLoading = false;
  int _currentCardIndex = 0;

  // Diagram state
  String? _diagramCode;
  bool _diagramLoading = false;

  // Topic selection
  List<TopicItem> _topics = [];
  bool _topicsLoading = false;
  String _selectedTopic = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    // Listen for audio completion to reset playing state
    _audioPlayer.onPlayerComplete.listen((_) {
      if (mounted) {
        setState(() {
          _isPlaying = false;
          _playingSource = null;
        });
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _extractTopics() async {
    setState(() => _topicsLoading = true);
    try {
      _topics = await ApiService().extractTopics(widget.document.id);
    } catch (e) {
      // Silently fail
    }
    if (mounted) setState(() => _topicsLoading = false);
  }

  Future<void> _generateCheatsheet() async {
    setState(() => _cheatsheetLoading = true);
    try {
      _cheatsheet = await ApiService().generateCheatsheet(
        documentId: widget.document.id,
        language: _language,
        focusTopic: _selectedTopic,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
    if (mounted) setState(() => _cheatsheetLoading = false);
  }

  Future<void> _generateFlashcards() async {
    setState(() => _flashcardsLoading = true);
    try {
      _flashcards = await ApiService().generateFlashcards(
        documentId: widget.document.id,
        language: _language,
        focusTopic: _selectedTopic,
      );
      _currentCardIndex = 0;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
    if (mounted) setState(() => _flashcardsLoading = false);
  }

  Future<void> _generateDiagram() async {
    setState(() => _diagramLoading = true);
    try {
      _diagramCode = await ApiService().generateDiagram(
        documentId: widget.document.id,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
    if (mounted) setState(() => _diagramLoading = false);
  }

  Future<void> _toggleSpeak(String text, String source) async {
    // If already playing this source, stop it
    if (_isPlaying && _playingSource == source) {
      await _audioPlayer.stop();
      setState(() {
        _isPlaying = false;
        _playingSource = null;
      });
      return;
    }

    // Stop any currently playing audio first
    if (_isPlaying) {
      await _audioPlayer.stop();
    }

    setState(() {
      _isPlaying = true;
      _playingSource = source;
    });

    try {
      final url = await ApiService().textToSpeech(
        text: text.length > 500 ? text.substring(0, 500) : text,
        language: _language,
      );
      if (!mounted) return;
      await _audioPlayer.play(UrlSource(url));
    } catch (e) {
      if (mounted) {
        setState(() {
          _isPlaying = false;
          _playingSource = null;
        });
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('TTS error: $e')));
      }
    }
  }

  /// Strip markdown code fences that some LLMs wrap around their output
  String _stripCodeFences(String text) {
    var s = text.trim();
    // Remove leading ```markdown or ``` and trailing ```
    final fencePattern = RegExp(r'^```(?:markdown|md)?\s*\n?', caseSensitive: false);
    if (fencePattern.hasMatch(s)) {
      s = s.replaceFirst(fencePattern, '');
      // Remove trailing ```
      if (s.trimRight().endsWith('```')) {
        s = s.trimRight();
        s = s.substring(0, s.length - 3).trimRight();
      }
    }
    return s;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Study Materials'),
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
                .map((e) => PopupMenuItem(value: e.key, child: Text(e.value)))
                .toList(),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(icon: Icon(Icons.article_outlined), text: 'Cheatsheet'),
            Tab(icon: Icon(Icons.style_outlined), text: 'Flashcards'),
            Tab(icon: Icon(Icons.account_tree_outlined), text: 'Diagram'),
          ],
        ),
      ),
      body: Column(
        children: [
          // Topic selection bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: Colors.grey.shade50,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.topic, size: 16, color: Colors.grey.shade600),
                    const SizedBox(width: 6),
                    Text('Focus: ',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Colors.grey.shade600)),
                    Text(
                      _selectedTopic.isEmpty ? 'Full Document' : _selectedTopic,
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: ArcadiaTheme.primary),
                    ),
                    const Spacer(),
                    if (_topics.isEmpty)
                      TextButton.icon(
                        onPressed: _topicsLoading ? null : _extractTopics,
                        icon: _topicsLoading
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.auto_awesome, size: 14),
                        label: Text(_topicsLoading ? 'Loading...' : 'Extract Topics',
                            style: const TextStyle(fontSize: 12)),
                      ),
                  ],
                ),
                if (_topics.isNotEmpty)
                  SizedBox(
                    height: 42,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            label: const Text('All', style: TextStyle(fontSize: 12)),
                            selected: _selectedTopic.isEmpty,
                            onSelected: (_) =>
                                setState(() => _selectedTopic = ''),
                            selectedColor:
                                ArcadiaTheme.primary.withValues(alpha: 0.2),
                            visualDensity: VisualDensity.compact,
                          ),
                        ),
                        ..._topics.map((t) => Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: ChoiceChip(
                                label: Text(t.title,
                                    style: const TextStyle(fontSize: 12)),
                                selected: _selectedTopic == t.title,
                                onSelected: (_) =>
                                    setState(() => _selectedTopic = t.title),
                                selectedColor:
                                    ArcadiaTheme.primary.withValues(alpha: 0.2),
                                visualDensity: VisualDensity.compact,
                                tooltip: t.summary,
                              ),
                            )),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          // Tab content
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildCheatsheetTab(),
                _buildFlashcardsTab(),
                _buildDiagramTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── Cheatsheet Tab ────────────────────────────────────

  Widget _buildCheatsheetTab() {
    if (_cheatsheet == null) {
      return _buildGenerateButton(
        icon: Icons.article_outlined,
        title: 'One-Page Cheatsheet',
        description: 'AI-generated concise summary with key concepts, '
            'formulas, and important points from your notes.',
        onGenerate: _generateCheatsheet,
        loading: _cheatsheetLoading,
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                onPressed: () => _toggleSpeak(_cheatsheet!, 'cheatsheet'),
                icon: Icon(
                  _isPlaying && _playingSource == 'cheatsheet'
                      ? Icons.stop_circle_outlined
                      : Icons.volume_up_outlined,
                  color: _isPlaying && _playingSource == 'cheatsheet'
                      ? ArcadiaTheme.primary
                      : null,
                ),
                tooltip: _isPlaying && _playingSource == 'cheatsheet'
                    ? 'Stop reading'
                    : 'Read aloud',
              ),
              IconButton(
                onPressed: _generateCheatsheet,
                icon: const Icon(Icons.refresh),
                tooltip: 'Regenerate',
              ),
            ],
          ),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Markdown(
                data: _stripCodeFences(_cheatsheet!),
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
                  h1: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                  h2: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.black87),
                  h3: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  p: const TextStyle(fontSize: 14, height: 1.6),
                  listBullet: const TextStyle(fontSize: 14, height: 1.6),
                  strong: const TextStyle(fontWeight: FontWeight.w700),
                  blockSpacing: 12,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Flashcards Tab ────────────────────────────────────

  Widget _buildFlashcardsTab() {
    if (_flashcards.isEmpty) {
      return _buildGenerateButton(
        icon: Icons.style_outlined,
        title: 'Flashcard Deck',
        description: 'Spaced-repetition flashcards generated from your notes. '
            'Tap to flip and test your knowledge.',
        onGenerate: _generateFlashcards,
        loading: _flashcardsLoading,
      );
    }

    final card = _flashcards[_currentCardIndex];

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Counter
          Text(
            '${_currentCardIndex + 1} / ${_flashcards.length}',
            style: TextStyle(color: Colors.grey.shade600, fontSize: 14),
          ),
          const SizedBox(height: 16),

          // Flashcard
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => card.isFlipped = !card.isFlipped),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                child: Container(
                  key: ValueKey('${_currentCardIndex}_${card.isFlipped}'),
                  width: double.infinity,
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    gradient: card.isFlipped
                        ? ArcadiaTheme.accentGradient
                        : ArcadiaTheme.primaryGradient,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: (card.isFlipped
                                ? ArcadiaTheme.secondary
                                : ArcadiaTheme.primary)
                            .withValues(alpha: 0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        card.isFlipped ? Icons.lightbulb : Icons.help_outline,
                        color: Colors.white.withValues(alpha: 0.5),
                        size: 32,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        card.isFlipped ? 'ANSWER' : 'QUESTION',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.6),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 2,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        card.isFlipped ? card.back : card.front,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w500,
                          height: 1.5,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      Text(
                        'Tap to ${card.isFlipped ? "see question" : "reveal answer"}',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.5),
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Navigation
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton.outlined(
                onPressed: _currentCardIndex > 0
                    ? () => setState(() {
                          _currentCardIndex--;
                          _flashcards[_currentCardIndex].isFlipped = false;
                        })
                    : null,
                icon: const Icon(Icons.arrow_back),
              ),
              const SizedBox(width: 16),
              IconButton(
                onPressed: () => _toggleSpeak(
                    card.isFlipped ? card.back : card.front, 'flashcard'),
                icon: Icon(
                  _isPlaying && _playingSource == 'flashcard'
                      ? Icons.stop_circle_outlined
                      : Icons.volume_up_outlined,
                  color: _isPlaying && _playingSource == 'flashcard'
                      ? ArcadiaTheme.primary
                      : null,
                ),
              ),
              const SizedBox(width: 16),
              IconButton.outlined(
                onPressed: _currentCardIndex < _flashcards.length - 1
                    ? () => setState(() {
                          _currentCardIndex++;
                          _flashcards[_currentCardIndex].isFlipped = false;
                        })
                    : null,
                icon: const Icon(Icons.arrow_forward),
              ),
            ],
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: _generateFlashcards,
            child: const Text('Regenerate Deck'),
          ),
        ],
      ),
    );
  }

  // ─── Diagram Tab ───────────────────────────────────────

  Widget _buildDiagramTab() {
    if (_diagramCode == null) {
      return _buildGenerateButton(
        icon: Icons.account_tree_outlined,
        title: 'Concept Diagram',
        description: 'AI-generated visual diagram showing concept relationships '
            'and flows from your study material.',
        onGenerate: _generateDiagram,
        loading: _diagramLoading,
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              IconButton(
                onPressed: _generateDiagram,
                icon: const Icon(Icons.refresh),
                tooltip: 'Regenerate',
              ),
            ],
          ),
          MermaidDiagramView(key: ValueKey(_diagramCode), code: _diagramCode!),
        ],
      ),
    );
  }

  // ─── Common generate button ────────────────────────────

  Widget _buildGenerateButton({
    required IconData icon,
    required String title,
    required String description,
    required VoidCallback onGenerate,
    required bool loading,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 64, color: ArcadiaTheme.primary.withValues(alpha: 0.3)),
            const SizedBox(height: 16),
            Text(title,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Text(description,
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade600)),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: loading ? null : onGenerate,
              icon: loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                    )
                  : const Icon(Icons.auto_awesome),
              label: Text(loading ? 'Generating...' : 'Generate with AI'),
            ),
          ],
        ),
      ),
    );
  }
}
