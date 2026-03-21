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
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ApiService().getDashboard();
      _stats = DashboardStats.fromJson(data['stats']);
      _mastery = (data['mastery'] as List).map((m) => TopicMastery.fromJson(m)).toList();
    } catch (e) {
      _error = e.toString();
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _resetProgress() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Reset all progress?'),
        content: const Text('This removes quiz attempts, mastery history, chat history, and cached audio.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Reset')),
        ],
      ),
    );

    if (ok != true) return;
    await ApiService().resetProgress();
    _loadDashboard();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_error != null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.cloud_off, size: 52),
              const SizedBox(height: 10),
              Text('Failed to load dashboard', style: TextStyle(color: Colors.grey.shade700)),
              TextButton(onPressed: _loadDashboard, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final s = _stats!;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Progress Dashboard'),
        actions: [
          IconButton(onPressed: _loadDashboard, icon: const Icon(Icons.refresh)),
          IconButton(onPressed: _resetProgress, icon: const Icon(Icons.delete_sweep_outlined)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadDashboard,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: ArcadiaTheme.primaryGradient,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Mastery Overview', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 22)),
                  const SizedBox(height: 6),
                  Text(
                    'Avg score ${(s.averageScore * 100).round()}% across ${s.totalQuizzesTaken} quizzes.',
                    style: const TextStyle(color: Colors.white70),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                _metricCard('Documents', '${s.totalDocuments}', Icons.description_outlined, ArcadiaTheme.primary),
                const SizedBox(width: 10),
                _metricCard('Quizzes', '${s.totalQuizzesTaken}', Icons.quiz_outlined, ArcadiaTheme.secondary),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                _metricCard('Avg Score', '${(s.averageScore * 100).round()}%', Icons.percent, ArcadiaTheme.accent),
                const SizedBox(width: 10),
                _metricCard('Mastered', '${s.topicsMastered}', Icons.emoji_events_outlined, const Color(0xFFFFB300)),
              ],
            ),
            const SizedBox(height: 20),
            const Text('Topic Mastery', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            if (_mastery.isEmpty)
              const Card(child: Padding(padding: EdgeInsets.all(20), child: Text('No mastery data yet. Take quizzes to populate this dashboard.')))
            else ...[
              SizedBox(
                height: 220,
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: BarChart(
                      BarChartData(
                        maxY: 100,
                        barGroups: _mastery.asMap().entries.map((entry) {
                          final m = entry.value;
                          return BarChartGroupData(
                            x: entry.key,
                            barRods: [
                              BarChartRodData(
                                toY: m.masteryScore * 100,
                                color: _barColor(m.masteryScore),
                                width: 20,
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
                              )
                            ],
                          );
                        }).toList(),
                        borderData: FlBorderData(show: false),
                        gridData: FlGridData(
                          drawVerticalLine: false,
                          getDrawingHorizontalLine: (value) => FlLine(color: Colors.grey.shade200),
                        ),
                        titlesData: FlTitlesData(
                          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                          leftTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              reservedSize: 30,
                              getTitlesWidget: (v, _) => Text('${v.toInt()}%', style: const TextStyle(fontSize: 10)),
                            ),
                          ),
                          bottomTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              getTitlesWidget: (v, _) {
                                final i = v.toInt();
                                if (i < 0 || i >= _mastery.length) return const SizedBox();
                                final name = _mastery[i].topic;
                                final short = name.length > 8 ? '${name.substring(0, 8)}…' : name;
                                return Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Text(short, style: const TextStyle(fontSize: 10)),
                                );
                              },
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              ..._mastery.map((m) => Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(child: Text(m.topic, style: const TextStyle(fontWeight: FontWeight.w700))),
                              Text('${(m.masteryScore * 100).round()}%', style: TextStyle(color: _barColor(m.masteryScore), fontWeight: FontWeight.w700)),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: LinearProgressIndicator(
                              minHeight: 10,
                              value: m.masteryScore,
                              backgroundColor: Colors.grey.shade200,
                              valueColor: AlwaysStoppedAnimation(_barColor(m.masteryScore)),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text('Tier ${m.tierUnlocked} unlocked · ${m.totalAttempts} attempts', style: TextStyle(color: Colors.grey.shade600)),
                        ],
                      ),
                    ),
                  )),
            ],
          ],
        ),
      ),
    );
  }

  Widget _metricCard(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, color: color, size: 18),
              ),
              const SizedBox(height: 8),
              Text(value, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 22, color: color)),
              Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }

  Color _barColor(double score) {
    if (score >= 0.8) return ArcadiaTheme.tier1;
    if (score >= 0.5) return ArcadiaTheme.tier2;
    return ArcadiaTheme.tier3;
  }
}
