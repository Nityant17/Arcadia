import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:audioplayers/audioplayers.dart';
import '../theme.dart';
import '../config.dart';
import '../services/api_service.dart';
import '../models/models.dart';

class ChatScreen extends StatefulWidget {
  final ArcadiaDocument document;

  const ChatScreen({super.key, required this.document});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final _messages = <ChatMessage>[];
  final _audioPlayer = AudioPlayer();
  bool _loading = false;
  String _language = 'en';
  int? _playingIndex;
  bool _isPlaying = false;
  bool _translating = false;

  @override
  void initState() {
    super.initState();
    // Listen for audio completion to reset playing state
    _audioPlayer.onPlayerComplete.listen((_) {
      if (mounted) {
        setState(() {
          _playingIndex = null;
          _isPlaying = false;
        });
      }
    });
    // Welcome message
    _messages.add(ChatMessage(
      role: 'assistant',
      content: 'Hi! I\'m Arcadia, your AI study buddy. I\'ve read your notes '
          '"${widget.document.originalName}". Ask me anything about them!\n\n'
          'Try questions like:\n'
          '- "Explain the main concepts"\n'
          '- "Summarize this topic"\n'
          '- "What are the key formulas?"',
    ));
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _sendMessage() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _loading) return;

    setState(() {
      _messages.add(ChatMessage(role: 'user', content: text));
      _loading = true;
    });
    _controller.clear();
    _scrollToBottom();

    try {
      // Always fetch English answer so we can re-translate later
      final englishAnswer = await ApiService().chat(
        documentId: widget.document.id,
        message: text,
        language: 'en',
      );

      String displayAnswer = englishAnswer;
      // Translate to current language if not English
      if (_language != 'en') {
        try {
          displayAnswer = await ApiService().translate(
            text: englishAnswer,
            targetLanguage: _language,
            sourceLanguage: 'en',
          );
        } catch (_) {
          // Fall back to English if translation fails
          displayAnswer = englishAnswer;
        }
      }

      setState(() {
        _messages.add(ChatMessage(
          role: 'assistant',
          content: displayAnswer,
          originalContent: englishAnswer,
        ));
      });
    } catch (e) {
      setState(() {
        _messages.add(ChatMessage(
          role: 'assistant',
          content: 'Sorry, I encountered an error: $e',
        ));
      });
    } finally {
      setState(() => _loading = false);
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _toggleSpeak(int index, String text) async {
    // If already playing this message, stop it
    if (_isPlaying && _playingIndex == index) {
      await _audioPlayer.stop();
      setState(() {
        _isPlaying = false;
        _playingIndex = null;
      });
      return;
    }

    // Stop any currently playing audio first
    if (_isPlaying) {
      await _audioPlayer.stop();
    }

    setState(() {
      _playingIndex = index;
      _isPlaying = true;
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
          _playingIndex = null;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('TTS error: $e')),
        );
      }
    }
  }

  Future<void> _retranslateMessages(String newLang) async {
    // Stop any ongoing TTS
    if (_isPlaying) {
      await _audioPlayer.stop();
      _isPlaying = false;
      _playingIndex = null;
    }

    setState(() {
      _language = newLang;
      _translating = true;
    });

    if (newLang == 'en') {
      // Restore original English content
      setState(() {
        for (final msg in _messages) {
          if (msg.role == 'assistant') {
            msg.content = msg.originalContent;
          }
        }
        _translating = false;
      });
      return;
    }

    // Translate all assistant messages to new language
    try {
      for (int i = 0; i < _messages.length; i++) {
        if (_messages[i].role != 'assistant') continue;
        final translated = await ApiService().translate(
          text: _messages[i].originalContent,
          targetLanguage: newLang,
          sourceLanguage: 'en',
        );
        if (!mounted) return;
        setState(() => _messages[i].content = translated);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Translation error: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _translating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Chat', style: TextStyle(fontSize: 18)),
            Text(
              widget.document.originalName,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
          ],
        ),
        actions: [
          // Language selector
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
            onSelected: (lang) => _retranslateMessages(lang),
            itemBuilder: (ctx) => AppConfig.supportedLanguages.entries
                .map((e) => PopupMenuItem(
                      value: e.key,
                      child: Row(
                        children: [
                          if (_language == e.key)
                            const Icon(Icons.check, size: 18, color: ArcadiaTheme.primary)
                          else
                            const SizedBox(width: 18),
                          const SizedBox(width: 8),
                          Text(e.value),
                        ],
                      ),
                    ))
                .toList(),
          ),
        ],
      ),
      body: Column(
        children: [
          // Translation progress indicator
          if (_translating)
            const LinearProgressIndicator(minHeight: 2),
          // Messages
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              itemCount: _messages.length + (_loading ? 1 : 0),
              itemBuilder: (ctx, index) {
                if (index == _messages.length && _loading) {
                  return _buildTypingIndicator();
                }
                return _buildMessage(_messages[index]);
              },
            ),
          ),
          // Input area
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: SafeArea(
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      decoration: InputDecoration(
                        hintText: 'Ask about your notes...',
                        filled: true,
                        fillColor: ArcadiaTheme.background,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 12),
                      ),
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _sendMessage(),
                      maxLines: null,
                    ),
                  ),
                  const SizedBox(width: 8),
                  FloatingActionButton.small(
                    onPressed: _loading ? null : _sendMessage,
                    backgroundColor: ArcadiaTheme.primary,
                    child: Icon(
                      _loading ? Icons.hourglass_empty : Icons.send,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessage(ChatMessage msg) {
    final isUser = msg.role == 'user';
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment:
            isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          if (!isUser) ...[
            CircleAvatar(
              radius: 16,
              backgroundColor: ArcadiaTheme.primary,
              child: const Icon(Icons.auto_awesome, color: Colors.white, size: 16),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment:
                  isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isUser ? ArcadiaTheme.primary : Colors.white,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(isUser ? 16 : 4),
                      bottomRight: Radius.circular(isUser ? 4 : 16),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 5,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: isUser
                      ? Text(msg.content,
                          style: const TextStyle(color: Colors.white))
                      : MarkdownBody(
                          data: msg.content,
                          styleSheet: MarkdownStyleSheet(
                            p: const TextStyle(fontSize: 14, height: 1.5),
                            code: TextStyle(
                              backgroundColor: Colors.grey.shade100,
                              fontSize: 13,
                            ),
                          ),
                        ),
                ),
                if (!isUser) ...[
                  const SizedBox(height: 4),
                  Builder(builder: (context) {
                    final msgIndex = _messages.indexOf(msg);
                    final isThisPlaying = _isPlaying && _playingIndex == msgIndex;
                    return Row(
                      children: [
                        InkWell(
                          onTap: () => _toggleSpeak(msgIndex, msg.content),
                          child: Padding(
                            padding: const EdgeInsets.all(4),
                            child: Icon(
                              isThisPlaying ? Icons.stop_circle_outlined : Icons.volume_up_outlined,
                              size: 18,
                              color: isThisPlaying ? ArcadiaTheme.primary : Colors.grey.shade500,
                            ),
                          ),
                        ),
                      ],
                    );
                  }),
                ],
              ],
            ),
          ),
          if (isUser) const SizedBox(width: 8),
          if (isUser)
            CircleAvatar(
              radius: 16,
              backgroundColor: ArcadiaTheme.secondary,
              child: const Icon(Icons.person, color: Colors.white, size: 16),
            ),
        ],
      ),
    );
  }

  Widget _buildTypingIndicator() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: ArcadiaTheme.primary,
            child: const Icon(Icons.auto_awesome, color: Colors.white, size: 16),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _dot(0),
                const SizedBox(width: 4),
                _dot(1),
                const SizedBox(width: 4),
                _dot(2),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _dot(int index) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 600 + index * 200),
      builder: (ctx, val, child) {
        return Opacity(
          opacity: 0.3 + 0.7 * val,
          child: Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: Colors.grey.shade400,
              shape: BoxShape.circle,
            ),
          ),
        );
      },
    );
  }
}
