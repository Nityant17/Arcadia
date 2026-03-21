import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/session_service.dart';
import '../theme.dart';

class AuthScreen extends StatefulWidget {
  final void Function(Map<String, String> session) onAuthenticated;

  const AuthScreen({super.key, required this.onAuthenticated});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _isLogin = true;
  bool _loading = false;

  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _loading = true);
    try {
      final api = ApiService();
      Map<String, dynamic> data;
      if (_isLogin) {
        data = await api.login(
          email: _emailCtrl.text.trim(),
          password: _passwordCtrl.text,
        );
      } else {
        data = await api.register(
          name: _nameCtrl.text.trim(),
          email: _emailCtrl.text.trim(),
          password: _passwordCtrl.text,
        );
      }

      final session = {
        'user_id': data['user_id'] as String,
        'name': data['name'] as String,
        'email': data['email'] as String,
        'token': data['token'] as String,
      };
      await SessionService().saveSession(
        userId: session['user_id']!,
        name: session['name']!,
        email: session['email']!,
        token: session['token']!,
      );
      widget.onAuthenticated(session);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Auth failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Card(
            margin: const EdgeInsets.all(24),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Welcome to Arcadia',
                      style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Text(_isLogin ? 'Sign in to continue' : 'Create your account',
                      style: TextStyle(color: Colors.grey.shade600)),
                  const SizedBox(height: 20),
                  if (!_isLogin) ...[
                    TextField(
                      controller: _nameCtrl,
                      decoration: const InputDecoration(labelText: 'Full name'),
                    ),
                    const SizedBox(height: 12),
                  ],
                  TextField(
                    controller: _emailCtrl,
                    decoration: const InputDecoration(labelText: 'Email'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _passwordCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Password'),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: _loading ? null : _submit,
                    style: ElevatedButton.styleFrom(backgroundColor: ArcadiaTheme.primary),
                    child: _loading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : Text(_isLogin ? 'Sign In' : 'Create Account'),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _loading ? null : () => setState(() => _isLogin = !_isLogin),
                    child: Text(_isLogin
                        ? 'New user? Create account'
                        : 'Already have an account? Sign in'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
