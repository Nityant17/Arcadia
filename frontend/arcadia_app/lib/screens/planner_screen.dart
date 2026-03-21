import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../theme.dart';

class PlannerScreen extends StatefulWidget {
  final String userId;

  const PlannerScreen({super.key, required this.userId});

  @override
  State<PlannerScreen> createState() => _PlannerScreenState();
}

class _PlannerScreenState extends State<PlannerScreen> {
  bool _loading = false;
  bool _creating = false;
  String? _error;

  List<Map<String, dynamic>> _tasks = [];
  List<Map<String, dynamic>> _weakTopics = [];
  List<Map<String, dynamic>> _availableSubjects = [];
  List<Map<String, dynamic>> _activityHeatmap = [];
  final List<Map<String, dynamic>> _subjects = [];

  final _titleCtrl = TextEditingController(text: 'Exam Study Plan');
  final _subjectCtrl = TextEditingController();
  String? _selectedSubject;
  DateTime _examDate = DateTime.now().add(const Duration(days: 30));
  final _hoursCtrl = TextEditingController(text: '6');

  @override
  void initState() {
    super.initState();
    _loadTasks();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _subjectCtrl.dispose();
    _hoursCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadTasks() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ApiService().getPlanTasks(widget.userId);
      _tasks = List<Map<String, dynamic>>.from(data['tasks'] as List? ?? []);
      _weakTopics = List<Map<String, dynamic>>.from(data['weak_topics'] as List? ?? []);
      _availableSubjects = List<Map<String, dynamic>>.from(data['available_subjects'] as List? ?? []);
      _activityHeatmap = List<Map<String, dynamic>>.from(data['activity_heatmap'] as List? ?? []);
      if (_selectedSubject == null && _availableSubjects.isNotEmpty) {
        _selectedSubject = _availableSubjects.first['subject']?.toString();
      }
    } catch (e) {
      _error = e.toString();
    }
    if (mounted) setState(() => _loading = false);
  }

  void _addSubject() {
    final subject = (_selectedSubject ?? _subjectCtrl.text).trim();
    final hours = double.tryParse(_hoursCtrl.text.trim());

    if (subject.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select a subject before adding.')),
      );
      return;
    }
    if (hours == null || hours < 1) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Weekly hours must be at least 1.')),
      );
      return;
    }

    final exists = _subjects.any((s) => s['subject'] == subject);
    if (exists) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Subject already added in this plan.')),
      );
      return;
    }

    setState(() {
      _subjects.add({
        'subject': subject,
        'exam_date': DateFormat('yyyy-MM-dd').format(_examDate),
        'weekly_hours': hours,
      });
    });
  }

  Future<void> _createPlan() async {
    if (_subjects.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add at least one subject to generate a timetable.')),
      );
      return;
    }

    setState(() => _creating = true);
    try {
      await ApiService().createPlan(
        userId: widget.userId,
        title: _titleCtrl.text.trim().isEmpty ? 'Exam Study Plan' : _titleCtrl.text.trim(),
        subjects: _subjects,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Adaptive timetable generated successfully.')),
      );
      setState(() => _subjects.clear());
      await _loadTasks();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to generate plan: $e')),
      );
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  Future<void> _markDone(String taskId) async {
    try {
      await ApiService().completeTask(taskId);
      await _loadTasks();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to complete task: $e')),
      );
    }
  }

  String _formatDate(String raw) {
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw;
    return DateFormat('dd MMM yyyy, hh:mm a').format(parsed.toLocal());
  }

  @override
  Widget build(BuildContext context) {
    final pending = _tasks.where((t) => (t['status'] ?? 'pending') != 'completed').toList();
    final completed = _tasks.where((t) => (t['status'] ?? 'pending') == 'completed').toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Timetable & Spaced Repetition')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadTasks,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _usageCard(),
                  const SizedBox(height: 12),
                  _plannerBuilderCard(),
                  const SizedBox(height: 12),
                  _heatmapCard(),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Card(
                      color: Colors.red.shade50,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text('Planner error: $_error', style: const TextStyle(color: Colors.red)),
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  if (_weakTopics.isNotEmpty) _weakTopicsCard(),
                  const SizedBox(height: 12),
                  _pendingTimetableSection(pending),
                  const SizedBox(height: 12),
                  _taskSection('Completed Tasks', completed, true),
                ],
              ),
            ),
    );
  }

  Widget _usageCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('How this timetable works', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 10),
            _step(1, 'Select subjects from your uploaded notes.'),
            _step(2, 'System auto-allocates time by chapter size and weak performance.'),
            _step(3, 'Generate timetable to get real study blocks with start/end times.'),
            _step(4, 'Complete tasks to trigger spaced repetition tasks automatically.'),
          ],
        ),
      ),
    );
  }

  Widget _step(int n, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: ArcadiaTheme.primary,
              borderRadius: BorderRadius.circular(999),
            ),
            alignment: Alignment.center,
            child: Text('$n', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
          ),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: TextStyle(color: Colors.grey.shade700))),
        ],
      ),
    );
  }

  Widget _plannerBuilderCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Build Adaptive Timetable', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 10),
            TextField(
              controller: _titleCtrl,
              decoration: const InputDecoration(labelText: 'Plan title'),
            ),
            const SizedBox(height: 10),
            if (_availableSubjects.isNotEmpty)
              DropdownButtonFormField<String>(
                initialValue: _selectedSubject,
                items: _availableSubjects
                    .map((s) => DropdownMenuItem<String>(
                          value: s['subject'].toString(),
                          child: Text('${s['subject']}  •  ${s['chunks']} chunks'),
                        ))
                    .toList(),
                onChanged: (value) => setState(() => _selectedSubject = value),
                decoration: const InputDecoration(labelText: 'Subject (from uploaded notes)'),
              )
            else
              TextField(
                controller: _subjectCtrl,
                decoration: const InputDecoration(labelText: 'Subject (upload notes to auto-list subjects)'),
              ),
            const SizedBox(height: 10),
            TextField(
              controller: _hoursCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Total weekly study hours (auto-distributed)'),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: Text('Exam Date: ${DateFormat('dd MMM yyyy').format(_examDate)}')),
                TextButton(
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: context,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 3650)),
                      initialDate: _examDate,
                    );
                    if (picked != null) setState(() => _examDate = picked);
                  },
                  child: const Text('Pick date'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _addSubject,
                    icon: const Icon(Icons.add),
                    label: const Text('Add Subject'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _creating ? null : _createPlan,
                    icon: _creating
                        ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.calendar_month_outlined),
                    label: Text(_creating ? 'Generating...' : 'Generate Timetable'),
                  ),
                ),
              ],
            ),
            if (_subjects.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Text('Subjects in this plan', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              ..._subjects.asMap().entries.map((entry) {
                final idx = entry.key;
                final s = entry.value;
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: ArcadiaTheme.divider),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${s['subject']} • ${s['exam_date']} • ${s['weekly_hours']}h/week (adaptive)',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                      IconButton(
                        onPressed: () => setState(() => _subjects.removeAt(idx)),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ],
        ),
      ),
    );
  }

  Widget _heatmapCard() {
    final dayMap = <String, int>{};
    for (final row in _activityHeatmap) {
      final date = row['date']?.toString() ?? '';
      final count = int.tryParse(row['count']?.toString() ?? '0') ?? 0;
      if (date.isNotEmpty) dayMap[date] = count;
    }

    final today = DateTime.now();
    final start = today.subtract(const Duration(days: 119));
    final days = List<DateTime>.generate(120, (i) => DateTime(start.year, start.month, start.day).add(Duration(days: i)));

    Color levelColor(int c) {
      if (c <= 0) return Colors.grey.shade200;
      if (c == 1) return ArcadiaTheme.primary.withValues(alpha: 0.25);
      if (c == 2) return ArcadiaTheme.primary.withValues(alpha: 0.45);
      if (c <= 4) return ArcadiaTheme.primary.withValues(alpha: 0.7);
      return ArcadiaTheme.primary;
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Learning Activity Heatmap', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 8),
            Text('More color means more learning activity on that day.', style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: days.map((d) {
                final key = DateFormat('yyyy-MM-dd').format(d);
                final count = dayMap[key] ?? 0;
                return Tooltip(
                  message: '$key • $count activity',
                  child: Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: levelColor(count),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _weakTopicsCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Weak Topics Focus', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 8),
            ..._weakTopics.take(6).map((w) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  leading: const Icon(Icons.warning_amber_rounded, color: Colors.orange),
                  title: Text(w['topic']?.toString() ?? ''),
                  subtitle: Text('Weakness: ${(double.tryParse(w['weakness_score'].toString()) ?? 0).toStringAsFixed(2)}'),
                )),
          ],
        ),
      ),
    );
  }

  Widget _taskSection(String title, List<Map<String, dynamic>> rows, bool completed) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: (completed ? Colors.green : ArcadiaTheme.primary).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text('${rows.length}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (rows.isEmpty)
              Text(
                completed ? 'No completed tasks yet.' : 'No pending tasks. Generate a timetable above.',
                style: TextStyle(color: Colors.grey.shade600),
              )
            else
              ...rows.map((t) => Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: ArcadiaTheme.divider),
                    ),
                    child: ListTile(
                      leading: CircleAvatar(
                        radius: 16,
                        backgroundColor: completed ? Colors.green : ArcadiaTheme.primary,
                        child: Icon(completed ? Icons.check : Icons.schedule, color: Colors.white, size: 16),
                      ),
                      title: Text('${t['subject']} · ${t['task_type']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text('${_formatDate((t['start_time'] ?? t['due_date']).toString())} → ${_formatDate((t['end_time'] ?? t['due_date']).toString())} · ${t['estimated_minutes']} min'),
                      trailing: completed
                          ? const Text('Done')
                          : TextButton(
                              onPressed: () => _markDone(t['id'].toString()),
                              child: const Text('Complete'),
                            ),
                    ),
                  )),
          ],
        ),
      ),
    );
  }

  Widget _pendingTimetableSection(List<Map<String, dynamic>> rows) {
    DateTime parseStart(Map<String, dynamic> item) {
      final raw = (item['start_time'] ?? item['due_date'] ?? '').toString();
      return DateTime.tryParse(raw) ?? DateTime.now();
    }

    final sorted = [...rows]..sort((a, b) => parseStart(a).compareTo(parseStart(b)));
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final row in sorted) {
      final dayKey = DateFormat('yyyy-MM-dd').format(parseStart(row));
      grouped.putIfAbsent(dayKey, () => []).add(row);
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('Timetable (Pending)', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: ArcadiaTheme.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text('${rows.length}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text('Follow this day-wise schedule with time blocks.', style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
            const SizedBox(height: 10),
            if (grouped.isEmpty)
              Text('No pending tasks. Generate a timetable above.', style: TextStyle(color: Colors.grey.shade600))
            else
              ...grouped.entries.map((entry) {
                final day = DateTime.tryParse(entry.key) ?? DateTime.now();
                final items = entry.value;
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: ArcadiaTheme.divider),
                    color: Colors.white,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        DateFormat('EEE, dd MMM yyyy').format(day),
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                      ),
                      const SizedBox(height: 8),
                      ...items.map((t) {
                        final startRaw = (t['start_time'] ?? t['due_date']).toString();
                        final endRaw = (t['end_time'] ?? t['due_date']).toString();
                        final start = DateTime.tryParse(startRaw);
                        final end = DateTime.tryParse(endRaw);
                        final startText = start != null ? DateFormat('hh:mm a').format(start.toLocal()) : '--:--';
                        final endText = end != null ? DateFormat('hh:mm a').format(end.toLocal()) : '--:--';

                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              SizedBox(
                                width: 92,
                                child: Text(
                                  '$startText\n$endText',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, height: 1.4),
                                ),
                              ),
                              Container(
                                width: 2,
                                height: 56,
                                color: ArcadiaTheme.primary.withValues(alpha: 0.35),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: ArcadiaTheme.primary.withValues(alpha: 0.06),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${t['subject']} · ${t['task_type']}',
                                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                                      ),
                                      const SizedBox(height: 2),
                                      Text('${t['estimated_minutes']} min', style: TextStyle(color: Colors.grey.shade700, fontSize: 12)),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              TextButton(
                                onPressed: () => _markDone(t['id'].toString()),
                                child: const Text('Done'),
                              ),
                            ],
                          ),
                        );
                      }),
                    ],
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}
