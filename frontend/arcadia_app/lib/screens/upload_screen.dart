import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../theme.dart';
import '../services/api_service.dart';
import '../models/models.dart';

class UploadScreen extends StatefulWidget {
  const UploadScreen({super.key});

  @override
  State<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends State<UploadScreen> {
  static const String _customSubjectValue = '__custom_subject__';
  bool _uploading = false;
  String? _status;
  String _subject = 'General';
  String _customSubject = '';
  String _topic = '';
  ArcadiaDocument? _uploadedDoc;

  final _subjects = [
    'General', 'Physics', 'Chemistry', 'Biology', 'Mathematics',
    'Computer Science', 'English', 'History', 'Geography', 'Economics',
    'Philosophy', 'Arts', 'Law', 'Engineering',
  ];

  Future<void> _pickAndUpload() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg', 'txt', 'webp'],
      withData: true,
    );

    if (result == null || result.files.isEmpty) return;

    final file = result.files.first;
    if (file.bytes == null) {
      setState(() => _status = 'Error: Could not read file data');
      return;
    }

    if (_subject == _customSubjectValue && _customSubject.trim().isEmpty) {
      setState(() => _status = 'Please type your custom subject before uploading');
      return;
    }

    final resolvedSubject = _subject == _customSubjectValue
        ? _customSubject.trim()
        : _subject;

    setState(() {
      _uploading = true;
      _status = 'Uploading & processing "${file.name}"...';
      _uploadedDoc = null;
    });

    try {
      final doc = await ApiService().uploadDocument(
        fileName: file.name,
        fileBytes: file.bytes!,
        subject: resolvedSubject,
        topic: _topic.isNotEmpty ? _topic : file.name.split('.').first,
      );
      setState(() {
        _uploading = false;
        _uploadedDoc = doc;
        _status = 'Successfully processed! ${doc.chunkCount} chunks indexed.';
      });
    } catch (e) {
      setState(() {
        _uploading = false;
        _status = 'Error: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Upload Knowledge Source')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('One workspace for all your study sources',
                style: TextStyle(color: Colors.grey.shade700, fontSize: 14)),
            const SizedBox(height: 14),

            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    GestureDetector(
                      onTap: _uploading ? null : _pickAndUpload,
                      child: Container(
                        height: 180,
                        decoration: BoxDecoration(
                          color: ArcadiaTheme.primary.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: ArcadiaTheme.primary.withValues(alpha: 0.25),
                            width: 1.5,
                          ),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            if (_uploading)
                              const CircularProgressIndicator()
                            else ...[
                              Icon(Icons.cloud_upload_outlined,
                                  size: 46, color: ArcadiaTheme.primary.withValues(alpha: 0.8)),
                              const SizedBox(height: 10),
                              const Text(
                                'Select file to upload',
                                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                              ),
                              const SizedBox(height: 4),
                              Text('PDF, PNG, JPG, TXT, WEBP',
                                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                            ],
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),

                    DropdownButtonFormField<String>(
                      initialValue: _subject,
                      decoration: const InputDecoration(
                        labelText: 'Subject',
                        prefixIcon: Icon(Icons.school_outlined),
                      ),
                      items: [
                        ..._subjects.map((s) => DropdownMenuItem(value: s, child: Text(s))),
                        const DropdownMenuItem(
                          value: _customSubjectValue,
                          child: Text('Other (type custom subject)'),
                        ),
                      ],
                      onChanged: (v) => setState(() => _subject = v ?? 'General'),
                    ),

                    if (_subject == _customSubjectValue) ...[
                      const SizedBox(height: 12),
                      TextField(
                        decoration: const InputDecoration(
                          labelText: 'Custom Subject',
                          hintText: 'e.g., Political Science, Cybersecurity',
                          prefixIcon: Icon(Icons.edit_note_outlined),
                        ),
                        onChanged: (v) => _customSubject = v,
                      ),
                    ],

                    const SizedBox(height: 12),

                    TextField(
                      decoration: const InputDecoration(
                        labelText: 'Topic (optional)',
                        hintText: 'e.g., Newton\'s Laws, Thermodynamics',
                        prefixIcon: Icon(Icons.topic_outlined),
                      ),
                      onChanged: (v) => _topic = v,
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Status
            if (_status != null)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: _uploadedDoc != null 
                      ? Colors.green.shade50 
                      : (_uploading ? Colors.blue.shade50 : Colors.red.shade50),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(
                      _uploadedDoc != null
                          ? Icons.check_circle
                          : (_uploading ? Icons.hourglass_empty : Icons.error_outline),
                      color: _uploadedDoc != null
                          ? Colors.green
                          : (_uploading ? Colors.blue : Colors.red),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Text(_status!)),
                  ],
                ),
              ),

            // Uploaded doc details
            if (_uploadedDoc != null) ...[
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _uploadedDoc!.originalName,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Subject: ${_uploadedDoc!.subject}',
                        style: TextStyle(color: Colors.grey.shade600),
                      ),
                      Text(
                        'Chunks indexed: ${_uploadedDoc!.chunkCount}',
                        style: TextStyle(color: Colors.grey.shade600),
                      ),
                      const SizedBox(height: 12),
                      if (_uploadedDoc!.extractedTextPreview.isNotEmpty) ...[
                        const Text('Preview:',
                            style: TextStyle(fontWeight: FontWeight.w500)),
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade50,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _uploadedDoc!.extractedTextPreview,
                            maxLines: 5,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 13),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],

            const SizedBox(height: 24),

            // How it works
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('How it works',
                        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                    const SizedBox(height: 12),
                    _stepRow('1', 'Upload your notes (PDF or photo)'),
                    _stepRow('2', 'AI extracts and understands the text (OCR)'),
                    _stepRow('3', 'Content is chunked and indexed for search'),
                    _stepRow('4', 'Chat, quiz, and study from your own notes!'),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _stepRow(String num, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          CircleAvatar(
            radius: 14,
            backgroundColor: ArcadiaTheme.primary,
            child: Text(num,
                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 14))),
        ],
      ),
    );
  }
}
