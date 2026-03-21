import 'package:flutter/material.dart';
import 'theme.dart';
import 'screens/home_screen.dart';
import 'screens/auth_screen.dart';
import 'services/session_service.dart';
import 'services/api_service.dart';

void main() {
  runApp(const ArcadiaApp());
}

class ArcadiaApp extends StatelessWidget {
  const ArcadiaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Arcadia',
      debugShowCheckedModeBanner: false,
      theme: ArcadiaTheme.lightTheme,
      home: const _BootstrapScreen(),
    );
  }
}

class _BootstrapScreen extends StatefulWidget {
  const _BootstrapScreen();

  @override
  State<_BootstrapScreen> createState() => _BootstrapScreenState();
}

class _BootstrapScreenState extends State<_BootstrapScreen> {
  Map<String, String>? _session;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final session = await SessionService().loadSession();
    if (session != null) {
      ApiService().setToken(session['token']);
    }
    if (mounted) {
      setState(() {
        _session = session;
        _loading = false;
      });
    }
  }

  void _onAuth(Map<String, String> session) {
    ApiService().setToken(session['token']);
    setState(() => _session = session);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_session == null) {
      return AuthScreen(onAuthenticated: _onAuth);
    }
    return HomeScreen(session: _session!);
  }
}
