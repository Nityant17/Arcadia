import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../theme.dart';
import '../services/api_service.dart';
import '../models/models.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _loading = true;
  DashboardStats? _stats;
  List<TopicMastery> _mastery = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ApiService().getDashboard();
      _stats = DashboardStats.fromJson(data['stats']);
      _mastery = (data['mastery'] as List)
          .map((m) => TopicMastery.fromJson(m))
          .toList();
    } catch (e) {
      _error = e.toString();
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _resetProgress() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reset All Progress'),
        content: const Text(
          'This will permanently delete all quiz attempts, mastery scores, '
          'chat history, and cached audio.\n\n'
          'Uploaded documents will NOT be deleted.\n\n'
          'This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: ArcadiaTheme.accent),
            child: const Text('Reset Everything'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await ApiService().resetProgress();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('All progress has been reset')),
        );
        _loadDashboard();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Reset failed: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_sweep_outlined),
            tooltip: 'Reset all progress',
            onPressed: _resetProgress,
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadDashboard,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.cloud_off, size: 48, color: Colors.grey),
                      const SizedBox(height: 16),
                      Text('Cannot load dashboard',
                          style: TextStyle(color: Colors.grey.shade600)),
                      const SizedBox(height: 8),
                      TextButton(
                          onPressed: _loadDashboard,
                          child: const Text('Retry')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadDashboard,
                  child: _buildDashboard(),
                ),
    );
  }

  Widget _buildDashboard() {
    final stats = _stats!;
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Stats grid
          Row(
            children: [
              Expanded(child: _statCard(
                Icons.description_outlined,
                '${stats.totalDocuments}',
                'Documents',
                ArcadiaTheme.primary,
              )),
              const SizedBox(width: 12),
              Expanded(child: _statCard(
                Icons.quiz_outlined,
                '${stats.totalQuizzesTaken}',
                'Quizzes',
                ArcadiaTheme.secondary,
              )),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _statCard(
                Icons.percent,
                '${(stats.averageScore * 100).round()}%',
                'Avg Score',
                ArcadiaTheme.accent,
              )),
              const SizedBox(width: 12),
              Expanded(child: _statCard(
                Icons.emoji_events_outlined,
                '${stats.topicsMastered}',
                'Mastered',
                const Color(0xFFFFB300),
              )),
            ],
          ),

          const SizedBox(height: 24),

          // Mastery overview
          const Text(
            'Topic Mastery',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),

          if (_mastery.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: Column(
                    children: [
                      Icon(Icons.school_outlined,
                          size: 48, color: Colors.grey.shade300),
                      const SizedBox(height: 12),
                      Text('No mastery data yet',
                          style: TextStyle(color: Colors.grey.shade600)),
                      const Text('Take a quiz to start tracking mastery!'),
                    ],
                  ),
                ),
              ),
            )
          else ...[
            // Bar chart
            SizedBox(
              height: 200,
              child: BarChart(
                BarChartData(
                  alignment: BarChartAlignment.spaceAround,
                  maxY: 100,
                  barGroups: _mastery.asMap().entries.map((e) {
                    final m = e.value;
                    return BarChartGroupData(
                      x: e.key,
                      barRods: [
                        BarChartRodData(
                          toY: m.masteryScore * 100,
                          color: m.masteryScore >= 0.8
                              ? ArcadiaTheme.tier1
                              : m.masteryScore >= 0.5
                                  ? ArcadiaTheme.tier2
                                  : ArcadiaTheme.tier3,
                          width: 20,
                          borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(6)),
                        ),
                      ],
                    );
                  }).toList(),
                  titlesData: FlTitlesData(
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 35,
                        getTitlesWidget: (v, _) => Text(
                          '${v.toInt()}%',
                          style: TextStyle(
                              color: Colors.grey.shade600, fontSize: 11),
                        ),
                      ),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (v, _) {
                          final idx = v.toInt();
                          if (idx >= _mastery.length) return const SizedBox();
                          return Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              _mastery[idx]
                                  .topic
                                  .substring(0, _mastery[idx].topic.length.clamp(0, 8)),
                              style: TextStyle(
                                  color: Colors.grey.shade600, fontSize: 10),
                            ),
                          );
                        },
                      ),
                    ),
                    topTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                  ),
                  gridData: FlGridData(
                    drawVerticalLine: false,
                    getDrawingHorizontalLine: (v) => FlLine(
                      color: Colors.grey.shade200,
                      strokeWidth: 1,
                    ),
                  ),
                  borderData: FlBorderData(show: false),
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Mastery list
            ...(_mastery.map((m) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: _masteryColor(m.masteryScore).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Center(
                            child: Text(
                              '${(m.masteryScore * 100).round()}%',
                              style: TextStyle(
                                color: _masteryColor(m.masteryScore),
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                m.topic.isNotEmpty
                                    ? m.topic
                                    : m.documentId.substring(0, 8),
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Tier ${m.tierUnlocked} unlocked · ${m.totalAttempts} attempts',
                                style: TextStyle(
                                    color: Colors.grey.shade600, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        // Tier badges
                        ...List.generate(3, (i) {
                          final tier = i + 1;
                          final unlocked = tier <= m.tierUnlocked;
                          return Container(
                            margin: const EdgeInsets.only(left: 4),
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              color: unlocked
                                  ? _tierColor(tier)
                                  : Colors.grey.shade200,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Center(
                              child: Text(
                                '$tier',
                                style: TextStyle(
                                  color: unlocked ? Colors.white : Colors.grey,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          );
                        }),
                      ],
                    ),
                  ),
                ))),
          ],
        ],
      ),
    );
  }

  Widget _statCard(IconData icon, String value, String label, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 12),
            Text(value,
                style: TextStyle(
                    fontSize: 28, fontWeight: FontWeight.w700, color: color)),
            Text(label,
                style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
          ],
        ),
      ),
    );
  }

  Color _masteryColor(double score) {
    if (score >= 0.8) return ArcadiaTheme.tier1;
    if (score >= 0.5) return ArcadiaTheme.tier2;
    return ArcadiaTheme.tier3;
  }

  Color _tierColor(int tier) {
    switch (tier) {
      case 1: return ArcadiaTheme.tier1;
      case 2: return ArcadiaTheme.tier2;
      case 3: return ArcadiaTheme.tier3;
      default: return Colors.grey;
    }
  }
}
