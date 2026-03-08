import 'package:flutter/material.dart';
import '../theme.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import 'upload_screen.dart';
import 'chat_screen.dart';
import 'quiz_screen.dart';
import 'study_materials_screen.dart';
import 'dashboard_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

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
    setState(() { _loading = true; _error = null; });
    try {
      _documents = await ApiService().getDocuments();
    } catch (e) {
      _error = e.toString();
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      _buildHomeContent(),
      const UploadScreen(),
      const DashboardScreen(),
    ];

    return Scaffold(
      body: screens[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (i) => setState(() {
          _currentIndex = i;
          if (i == 0) _loadDocuments();
        }),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.upload_file_outlined),
            selectedIcon: Icon(Icons.upload_file),
            label: 'Upload',
          ),
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
        ],
      ),
    );
  }

  Widget _buildHomeContent() {
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _loadDocuments,
        child: CustomScrollView(
          slivers: [
            // Header
            SliverToBoxAdapter(child: _buildHeader()),
            // Error
            if (_error != null)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Card(
                    color: Colors.red.shade50,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline, color: Colors.red),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Cannot connect to backend. Is the server running?\n$_error',
                              style: const TextStyle(color: Colors.red, fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            // Loading
            if (_loading)
              const SliverToBoxAdapter(
                child: Center(child: Padding(
                  padding: EdgeInsets.all(40),
                  child: CircularProgressIndicator(),
                )),
              ),
            // Empty state
            if (!_loading && _documents.isEmpty && _error == null)
              SliverToBoxAdapter(child: _buildEmptyState()),
            // Document list
            if (!_loading && _documents.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'Your Notes (${_documents.length})',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: ArcadiaTheme.textPrimary,
                    ),
                  ),
                ),
              ),
            if (!_loading && _documents.isNotEmpty)
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _buildDocumentCard(_documents[index]),
                    childCount: _documents.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: ArcadiaTheme.primaryGradient,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.auto_awesome, color: Colors.white, size: 28),
              ),
              const SizedBox(width: 12),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Arcadia',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    'AI Study Buddy',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            'Upload your notes, chat with them, take adaptive quizzes, '
            'and master every concept — in your language.',
            style: TextStyle(color: Colors.white70, fontSize: 14, height: 1.5),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          children: [
            Icon(Icons.note_add_outlined, size: 80, color: Colors.grey.shade300),
            const SizedBox(height: 16),
            const Text(
              'No notes uploaded yet',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Text(
              'Upload a PDF or photo of your handwritten notes to get started.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => setState(() => _currentIndex = 1),
              icon: const Icon(Icons.upload_file),
              label: const Text('Upload Notes'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDocumentCard(ArcadiaDocument doc) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _showDocumentActions(doc),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: ArcadiaTheme.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      doc.originalName.endsWith('.pdf')
                          ? Icons.picture_as_pdf
                          : Icons.image,
                      color: ArcadiaTheme.primary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          doc.originalName,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${doc.subject} · ${doc.chunkCount} chunks',
                          style: TextStyle(
                            color: Colors.grey.shade600,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () async {
                      await ApiService().deleteDocument(doc.id);
                      _loadDocuments();
                    },
                    icon: Icon(Icons.delete_outline, color: Colors.grey.shade400),
                  ),
                ],
              ),
              if (doc.extractedTextPreview.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  doc.extractedTextPreview,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                ),
              ],
              const SizedBox(height: 12),
              // Action buttons
              Row(
                children: [
                  _actionChip(Icons.chat_bubble_outline, 'Chat', () {
                    Navigator.push(context, MaterialPageRoute(
                      builder: (_) => ChatScreen(document: doc),
                    ));
                  }),
                  const SizedBox(width: 8),
                  _actionChip(Icons.quiz_outlined, 'Quiz', () {
                    Navigator.push(context, MaterialPageRoute(
                      builder: (_) => QuizScreen(document: doc),
                    ));
                  }),
                  const SizedBox(width: 8),
                  _actionChip(Icons.auto_stories_outlined, 'Study', () {
                    Navigator.push(context, MaterialPageRoute(
                      builder: (_) => StudyMaterialsScreen(document: doc),
                    ));
                  }),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _actionChip(IconData icon, String label, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: ArcadiaTheme.primary.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: ArcadiaTheme.primary),
            const SizedBox(width: 6),
            Text(label, style: const TextStyle(
              color: ArcadiaTheme.primary,
              fontWeight: FontWeight.w500,
              fontSize: 13,
            )),
          ],
        ),
      ),
    );
  }

  void _showDocumentActions(ArcadiaDocument doc) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(doc.originalName,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text('${doc.subject} · ${doc.chunkCount} chunks indexed',
              style: TextStyle(color: Colors.grey.shade600)),
            const SizedBox(height: 20),
            _sheetTile(Icons.chat_bubble_outline, 'Chat with this document', () {
              Navigator.pop(ctx);
              Navigator.push(context, MaterialPageRoute(
                builder: (_) => ChatScreen(document: doc),
              ));
            }),
            _sheetTile(Icons.quiz_outlined, 'Take a quiz', () {
              Navigator.pop(ctx);
              Navigator.push(context, MaterialPageRoute(
                builder: (_) => QuizScreen(document: doc),
              ));
            }),
            _sheetTile(Icons.auto_stories_outlined, 'Study materials', () {
              Navigator.pop(ctx);
              Navigator.push(context, MaterialPageRoute(
                builder: (_) => StudyMaterialsScreen(document: doc),
              ));
            }),
            _sheetTile(Icons.delete_outline, 'Delete', () async {
              Navigator.pop(ctx);
              await ApiService().deleteDocument(doc.id);
              _loadDocuments();
            }, color: Colors.red),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _sheetTile(IconData icon, String text, VoidCallback onTap,
      {Color? color}) {
    return ListTile(
      leading: Icon(icon, color: color ?? ArcadiaTheme.primary),
      title: Text(text, style: TextStyle(color: color)),
      onTap: onTap,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    );
  }
}
