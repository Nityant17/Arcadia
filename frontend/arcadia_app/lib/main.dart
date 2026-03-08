import 'package:flutter/material.dart';
import 'theme.dart';
import 'screens/home_screen.dart';

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
      home: const HomeScreen(),
    );
  }
}
