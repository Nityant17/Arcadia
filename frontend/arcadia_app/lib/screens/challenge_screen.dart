import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import '../theme.dart';

class ChallengeScreen extends StatefulWidget {
  final List<ArcadiaDocument> documents;

  const ChallengeScreen({super.key, required this.documents});

  @override
  State<ChallengeScreen> createState() => _ChallengeScreenState();
}

class _ChallengeScreenState extends State<ChallengeScreen> {
  final _codeCtrl = TextEditingController();
  ArcadiaDocument? _selectedDoc;
  int _tier = 1;
  bool _extractingTopics = false;
  List<TopicItem> _topics = [];
  String _selectedTopic = '';

  bool _loading = false;
  String? _roomCode;
  Map<String, dynamic>? _room;
  final Map<int, int> _answers = {};

  @override
  void initState() {
    super.initState();
    if (widget.documents.isNotEmpty) {
      _selectedDoc = widget.documents.first;
    }
  }

  @override
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _createRoom() async {
    if (_selectedDoc == null) return;
    setState(() => _loading = true);
    try {
      final data = await ApiService().createChallengeRoom(
        documentId: _selectedDoc!.id,
        tier: _tier,
        numQuestions: 5,
        focusTopic: _selectedTopic,
      );
      _roomCode = data['code'].toString();
      await _refreshRoom();
    } catch (e) {
      _showError('Create room failed: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _extractTopics() async {
    if (_selectedDoc == null) return;
    setState(() => _extractingTopics = true);
    try {
      final topics = await ApiService().extractTopics(_selectedDoc!.id);
      if (!mounted) return;
      setState(() {
        _topics = topics;
        if (_selectedTopic.isNotEmpty && !_topics.any((t) => t.title == _selectedTopic)) {
          _selectedTopic = '';
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Extracted ${topics.length} topics')),
      );
    } catch (e) {
      _showError('Topic extraction failed: $e');
    } finally {
      if (mounted) setState(() => _extractingTopics = false);
    }
  }

  Future<void> _joinRoom() async {
    if (_codeCtrl.text.trim().isEmpty) return;
    setState(() => _loading = true);
    try {
      final data = await ApiService().joinChallengeRoom(_codeCtrl.text.trim().toUpperCase());
      _roomCode = data['code'].toString();
      await _refreshRoom();
    } catch (e) {
      _showError('Join room failed: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _refreshRoom() async {
    if (_roomCode == null) return;
    try {
      final room = await ApiService().getChallengeRoom(_roomCode!);
      if (mounted) setState(() => _room = room);
    } catch (e) {
      _showError('Failed to load room: $e');
    }
  }

  Future<void> _startRoom() async {
    if (_roomCode == null) return;
    try {
      await ApiService().startChallengeRoom(_roomCode!);
      await _refreshRoom();
    } catch (e) {
      _showError('Start failed: $e');
    }
  }

  Future<void> _submitChallenge() async {
    if (_roomCode == null || _room == null) return;
    final questions = List<Map<String, dynamic>>.from(_room!['questions'] as List? ?? []);
    if (questions.isEmpty) return;
    if (_answers.length != questions.length) {
      _showError('Please answer all questions first');
      return;
    }

    final payload = _answers.entries
        .map((e) => {'question_id': e.key, 'selected_option': e.value})
        .toList();

    try {
      final result = await ApiService().submitChallenge(_roomCode!, payload);
      await _refreshRoom();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Submitted! Score: ${(result['score'] * 100).round()}%')),
        );
      }
    } catch (e) {
      _showError('Submit failed: $e');
    }
  }

  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final roomStatus = (_room?['status'] ?? 'none').toString();
    final participants = List<Map<String, dynamic>>.from(_room?['participants'] as List? ?? []);
    final questions = List<Map<String, dynamic>>.from(_room?['questions'] as List? ?? []);

    return Scaffold(
      appBar: AppBar(title: const Text('Friends Challenge Rooms')),
      body: RefreshIndicator(
        onRefresh: _refreshRoom,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Create Challenge Room',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    const SizedBox(height: 4),
                    Text(
                      'Pick a document, optionally extract/select a topic, and challenge your friends on that focus area.',
                      style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<ArcadiaDocument>(
                      initialValue: _selectedDoc,
                      items: widget.documents
                          .map((d) => DropdownMenuItem(value: d, child: Text(d.originalName)))
                          .toList(),
                      onChanged: (d) => setState(() {
                        _selectedDoc = d;
                        _topics = [];
                        _selectedTopic = '';
                      }),
                      decoration: const InputDecoration(labelText: 'Document'),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _extractingTopics || _selectedDoc == null ? null : _extractTopics,
                            icon: _extractingTopics
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : const Icon(Icons.auto_awesome_motion_outlined),
                            label: Text(_extractingTopics ? 'Extracting...' : 'Extract Topics'),
                          ),
                        ),
                      ],
                    ),
                    if (_topics.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      DropdownButtonFormField<String>(
                        initialValue: _selectedTopic.isEmpty ? '' : _selectedTopic,
                        items: [
                          const DropdownMenuItem(value: '', child: Text('All topics')),
                          ..._topics.map((t) => DropdownMenuItem(value: t.title, child: Text(t.title))),
                        ],
                        onChanged: (v) => setState(() => _selectedTopic = v ?? ''),
                        decoration: const InputDecoration(labelText: 'Focus Topic (optional)'),
                      ),
                    ],
                    const SizedBox(height: 10),
                    DropdownButtonFormField<int>(
                      initialValue: _tier,
                      items: const [
                        DropdownMenuItem(value: 1, child: Text('Tier 1 - Recall')),
                        DropdownMenuItem(value: 2, child: Text('Tier 2 - Application')),
                        DropdownMenuItem(value: 3, child: Text('Tier 3 - Analysis')),
                      ],
                      onChanged: (v) => setState(() => _tier = v ?? 1),
                      decoration: const InputDecoration(labelText: 'Tier'),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _loading ? null : _createRoom,
                        icon: const Icon(Icons.add_circle_outline),
                        label: Text(
                          _selectedTopic.isEmpty ? 'Create Room' : 'Create Room for "$_selectedTopic"',
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Join Existing Room',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _codeCtrl,
                            textCapitalization: TextCapitalization.characters,
                            decoration: const InputDecoration(labelText: 'Room code'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(onPressed: _loading ? null : _joinRoom, child: const Text('Join')),
                      ],
                    )
                  ],
                ),
              ),
            ),
            if (_roomCode != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: ArcadiaTheme.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.meeting_room_outlined, color: ArcadiaTheme.primary),
                    const SizedBox(width: 8),
                    Expanded(child: Text('Room Code: $_roomCode · Status: $roomStatus')),
                    TextButton(onPressed: _refreshRoom, child: const Text('Refresh')),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Participants', style: TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      ...participants.map((p) => ListTile(
                            dense: true,
                            leading: CircleAvatar(child: Text((p['name'] ?? 'U').toString().substring(0, 1))),
                            title: Text((p['name'] ?? '').toString()),
                            subtitle: Text('Score: ${(((p['score'] ?? 0.0) as num) * 100).round()}%'),
                            trailing: Icon(
                              p['submitted'] == true ? Icons.check_circle : Icons.hourglass_top,
                              color: p['submitted'] == true ? Colors.green : Colors.orange,
                            ),
                          )),
                      if (roomStatus == 'waiting')
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: _startRoom,
                            icon: const Icon(Icons.play_circle_outline),
                            label: const Text('Start Challenge'),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
            if (roomStatus == 'active' && questions.isNotEmpty) ...[
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Challenge Questions', style: TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      ...questions.map((q) {
                        final qid = (q['id'] as num).toInt();
                        final options = List<String>.from(q['options'] as List? ?? []);
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(q['question'].toString(), style: const TextStyle(fontWeight: FontWeight.w600)),
                              const SizedBox(height: 6),
                              ...List.generate(options.length, (idx) {
                                final selected = _answers[qid] == idx;
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 6),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(10),
                                    onTap: () => setState(() => _answers[qid] = idx),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                                      decoration: BoxDecoration(
                                        color: selected
                                            ? ArcadiaTheme.primary.withValues(alpha: 0.1)
                                            : Colors.grey.shade50,
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(
                                          color: selected ? ArcadiaTheme.primary : Colors.grey.shade300,
                                        ),
                                      ),
                                      child: Row(
                                        children: [
                                          Icon(
                                            selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                                            size: 18,
                                            color: selected ? ArcadiaTheme.primary : Colors.grey.shade600,
                                          ),
                                          const SizedBox(width: 8),
                                          Expanded(child: Text(options[idx])),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              }),
                            ],
                          ),
                        );
                      }),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _submitChallenge,
                          child: const Text('Submit Challenge'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
