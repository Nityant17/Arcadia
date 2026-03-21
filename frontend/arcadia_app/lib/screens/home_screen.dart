import 'package:flutter/material.dart';
import '../theme.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import 'upload_screen.dart';
import 'chat_screen.dart';
import 'quiz_screen.dart';
import 'study_materials_screen.dart';
import 'dashboard_screen.dart';
import 'planner_screen.dart';
import 'challenge_screen.dart';

class HomeScreen extends StatefulWidget {
  final Map<String, String> session;

  const HomeScreen({super.key, required this.session});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  List<ArcadiaDocument> _documents = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDocuments();
  }

  Future<void> _loadDocuments() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      _documents = await ApiService().getDocuments();
    } catch (e) {
      _error = e.toString();
    }
    if (mounted) setState(() => _loading = false);
  }

  List<Widget> _screens() => [
        _buildHomePage(),
        const UploadScreen(),
        PlannerScreen(userId: widget.session['user_id'] ?? 'guest'),
        ChallengeScreen(documents: _documents),
        const DashboardScreen(),
      ];

  @override
  Widget build(BuildContext context) {
    final screens = _screens();
    final isWide = MediaQuery.of(context).size.width > 1080;

    if (isWide) {
      return Scaffold(
        body: Row(
          children: [
            _sideNav(),
            Expanded(
              child: Column(
                children: [
                  _topBar(),
                  Expanded(child: screens[_currentIndex]),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      body: screens[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (i) {
          setState(() => _currentIndex = i);
          if (i == 0) _loadDocuments();
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.upload_file_outlined), selectedIcon: Icon(Icons.upload_file), label: 'Upload'),
          NavigationDestination(icon: Icon(Icons.calendar_month_outlined), selectedIcon: Icon(Icons.calendar_month), label: 'Planner'),
          NavigationDestination(icon: Icon(Icons.groups_outlined), selectedIcon: Icon(Icons.groups), label: 'Challenge'),
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: 'Dashboard'),
        ],
      ),
    );
  }

  Widget _sideNav() {
    final items = const [
      (Icons.home_outlined, Icons.home, 'Home'),
      (Icons.upload_file_outlined, Icons.upload_file, 'Upload'),
      (Icons.calendar_month_outlined, Icons.calendar_month, 'Planner'),
      (Icons.groups_outlined, Icons.groups, 'Challenge'),
      (Icons.dashboard_outlined, Icons.dashboard, 'Dashboard'),
    ];

    return Container(
      width: 92,
      color: Colors.white,
      child: Column(
        children: [
          const SizedBox(height: 14),
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              gradient: ArcadiaTheme.primaryGradient,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.auto_awesome, color: Colors.white),
          ),
          const SizedBox(height: 16),
          ...List.generate(items.length, (i) {
            final selected = i == _currentIndex;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () {
                  setState(() => _currentIndex = i);
                  if (i == 0) _loadDocuments();
                },
                child: Container(
                  width: 74,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: selected ? ArcadiaTheme.primary.withValues(alpha: 0.1) : Colors.transparent,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    children: [
                      Icon(selected ? items[i].$2 : items[i].$1, color: selected ? ArcadiaTheme.primary : Colors.grey.shade500),
                      const SizedBox(height: 4),
                      Text(
                        items[i].$3,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                          color: selected ? ArcadiaTheme.primary : Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _topBar() {
    return Container(
      height: 72,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFE5E7EB))),
      ),
      child: Row(
        children: [
          const Text('Arcadia', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: ArcadiaTheme.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text('Signed in: ${widget.session['name'] ?? 'Student'}', style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  Widget _buildHomePage() {
    if (_loading) return const Center(child: CircularProgressIndicator());

    return RefreshIndicator(
      onRefresh: _loadDocuments,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isWide = constraints.maxWidth > 1180;
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              _heroCard(),
              const SizedBox(height: 14),
              _quickStats(),
              const SizedBox(height: 18),
              if (_error != null)
                Card(
                  color: Colors.red.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Text('Backend error: $_error', style: const TextStyle(color: Colors.red)),
                  ),
                ),
              if (isWide)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(flex: 7, child: _knowledgeColumn()),
                    const SizedBox(width: 16),
                    Expanded(flex: 3, child: _rightInsightColumn()),
                  ],
                )
              else ...[
                _knowledgeColumn(),
                const SizedBox(height: 14),
                _rightInsightColumn(),
              ]
            ],
          );
        },
      ),
    );
  }

  Widget _knowledgeColumn() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text('Your Knowledge Base', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const Spacer(),
            TextButton.icon(onPressed: _loadDocuments, icon: const Icon(Icons.refresh), label: const Text('Refresh')),
          ],
        ),
        const SizedBox(height: 8),
        if (_documents.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Icon(Icons.folder_open, size: 56, color: Colors.grey.shade300),
                  const SizedBox(height: 12),
                  const Text('No notes uploaded yet', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
                  const SizedBox(height: 6),
                  Text('Upload PDFs or images to start chat, quiz, planning, and challenge rooms.',
                      style: TextStyle(color: Colors.grey.shade600)),
                  const SizedBox(height: 12),
                  ElevatedButton.icon(onPressed: () => setState(() => _currentIndex = 1), icon: const Icon(Icons.upload), label: const Text('Upload Notes')),
                ],
              ),
            ),
          )
        else
          ..._documents.map(_docCard),
      ],
    );
  }

  Widget _rightInsightColumn() {
    final topicMap = <String, int>{};
    for (final d in _documents) {
      final topic = d.topic.trim().isEmpty ? 'Untagged' : d.topic.trim();
      topicMap[topic] = (topicMap[topic] ?? 0) + 1;
    }
    final topTopics = topicMap.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return Column(
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Quick Start', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 10),
                _quickTile(Icons.upload_file_outlined, 'Add New Notes', 'Upload PDF/image/txt', () => setState(() => _currentIndex = 1)),
                const SizedBox(height: 8),
                _quickTile(Icons.calendar_month_outlined, 'Build Timetable', 'Generate spaced plan', () => setState(() => _currentIndex = 2)),
                const SizedBox(height: 8),
                _quickTile(Icons.groups_outlined, 'Start Challenge', 'Compete with friends', () => setState(() => _currentIndex = 3)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Topic Coverage', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 10),
                if (topTopics.isEmpty)
                  Text('No topics yet', style: TextStyle(color: Colors.grey.shade600))
                else
                  ...topTopics.take(5).map((t) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            Expanded(child: Text(t.key, maxLines: 1, overflow: TextOverflow.ellipsis)),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: ArcadiaTheme.primary.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text('${t.value}', style: const TextStyle(fontWeight: FontWeight.w600)),
                            ),
                          ],
                        ),
                      )),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _quickTile(IconData icon, String title, String subtitle, VoidCallback onTap) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: ArcadiaTheme.divider),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: ArcadiaTheme.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 18, color: ArcadiaTheme.primary),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                  Text(subtitle, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right),
          ],
        ),
      ),
    );
  }

  Widget _heroCard() {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: ArcadiaTheme.primaryGradient,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(color: ArcadiaTheme.primary.withValues(alpha: 0.18), blurRadius: 18, offset: const Offset(0, 6)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.psychology_alt_outlined, color: Colors.white),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text('Your AI Study Command Center', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Chat with multiple PDFs, track weak topics, practice adaptive quizzes, use whiteboard hints, and challenge your friends live.',
            style: TextStyle(color: Colors.white70, height: 1.5),
          ),
        ],
      ),
    );
  }

  Widget _quickStats() {
    final topicCount = _documents.map((e) => e.topic).toSet().where((t) => t.isNotEmpty).length;
    final chunks = _documents.fold<int>(0, (acc, d) => acc + d.chunkCount);

    Widget box(String label, String value, IconData icon, Color color) {
      return Expanded(
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
                  child: Icon(icon, color: color),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 20)),
                    Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                  ],
                )
              ],
            ),
          ),
        ),
      );
    }

    return Row(
      children: [
        box('Documents', '${_documents.length}', Icons.description_outlined, ArcadiaTheme.primary),
        const SizedBox(width: 10),
        box('Topics', '$topicCount', Icons.topic_outlined, ArcadiaTheme.secondary),
        const SizedBox(width: 10),
        box('Indexed Chunks', '$chunks', Icons.hub_outlined, ArcadiaTheme.accent),
      ],
    );
  }

  Widget _docCard(ArcadiaDocument doc) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: ArcadiaTheme.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(doc.originalName.endsWith('.pdf') ? Icons.picture_as_pdf : Icons.image, color: ArcadiaTheme.primary),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(doc.originalName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      Text('${doc.subject} • ${doc.topic.isEmpty ? 'Untagged topic' : doc.topic} • ${doc.chunkCount} chunks',
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () async {
                    await ApiService().deleteDocument(doc.id);
                    _loadDocuments();
                  },
                  icon: const Icon(Icons.delete_outline),
                )
              ],
            ),
            const SizedBox(height: 10),
            Text(doc.extractedTextPreview, maxLines: 3, overflow: TextOverflow.ellipsis, style: TextStyle(color: Colors.grey.shade700)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _docAction('Chat', 'Ask from notes', Icons.chat_bubble_outline, () {
                  final docsInTopic = doc.topic.isNotEmpty
                      ? _documents.where((d) => d.topic == doc.topic).map((d) => d.id).toList()
                      : <String>[];
                  final useTopicScope = docsInTopic.length > 1;
                  Navigator.push(context, MaterialPageRoute(
                    builder: (_) => ChatScreen(
                      document: doc,
                      userId: widget.session['user_id'] ?? 'guest',
                      topicScope: useTopicScope ? doc.topic : null,
                      documentIds: useTopicScope ? docsInTopic : null,
                    ),
                  ));
                }),
                _docAction('Quiz', 'Practice now', Icons.quiz_outlined, () {
                  Navigator.push(context, MaterialPageRoute(
                    builder: (_) => QuizScreen(document: doc, userId: widget.session['user_id'] ?? 'guest'),
                  ));
                }),
                _docAction('Study', 'Cheatsheet/cards', Icons.auto_stories_outlined, () {
                  Navigator.push(context, MaterialPageRoute(builder: (_) => StudyMaterialsScreen(document: doc)));
                }),
                _docAction('Challenge', 'Room with friends', Icons.groups_outlined, () {
                  setState(() => _currentIndex = 3);
                }),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _docAction(String title, String subtitle, IconData icon, VoidCallback onTap) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        width: 170,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: Colors.white,
          border: Border.all(color: ArcadiaTheme.primary.withValues(alpha: 0.25)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: ArcadiaTheme.primary),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: Colors.grey.shade600, fontSize: 11)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
