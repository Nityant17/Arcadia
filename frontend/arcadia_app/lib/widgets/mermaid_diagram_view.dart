import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter/services.dart';
import '../theme.dart';

// Web-specific imports
import 'dart:ui_web' as ui_web;
import 'package:web/web.dart' as web;

/// Renders a Mermaid.js diagram inline using an iframe (Flutter Web only).
/// Falls back to copyable code display on non-web platforms.
class MermaidDiagramView extends StatefulWidget {
  final String code;

  const MermaidDiagramView({super.key, required this.code});

  @override
  State<MermaidDiagramView> createState() => _MermaidDiagramViewState();
}

class _MermaidDiagramViewState extends State<MermaidDiagramView> {
  late final String _viewType;

  @override
  void initState() {
    super.initState();
    _viewType = 'mermaid-${DateTime.now().millisecondsSinceEpoch}-${widget.code.hashCode}';
    _registerView();
  }

  void _registerView() {
    ui_web.platformViewRegistry.registerViewFactory(_viewType, (int viewId) {
      final escapedCode = widget.code
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;');

      final htmlContent = '''
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<style>
  body {
    margin: 0;
    padding: 0;
    background: #fafafa;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    overflow: hidden;
    width: 100%;
    height: 100%;
  }
  #container {
    width: 100%;
    height: 100vh;
    overflow: hidden;
    cursor: grab;
    position: relative;
  }
  #container:active { cursor: grabbing; }
  #diagram-wrap {
    transform-origin: 0 0;
    padding: 24px;
    display: inline-block;
  }
  .mermaid svg {
    height: auto !important;
  }
  #controls {
    position: fixed;
    bottom: 12px;
    right: 12px;
    display: flex;
    gap: 6px;
    z-index: 10;
  }
  #controls button {
    width: 32px; height: 32px;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: white;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  }
  #controls button:hover { background: #f0f0f0; }
</style>
</head>
<body>
<div id="container">
  <div id="diagram-wrap">
    <pre class="mermaid">$escapedCode</pre>
  </div>
</div>
<div id="controls">
  <button id="zoom-in" title="Zoom in">+</button>
  <button id="zoom-out" title="Zoom out">&minus;</button>
  <button id="zoom-reset" title="Reset">&#8634;</button>
</div>
<script>
  mermaid.initialize({
    startOnLoad: true,
    theme: 'default',
    flowchart: { useMaxWidth: false, htmlLabels: true },
    securityLevel: 'loose'
  });

  // Pan & zoom logic
  let scale = 1, panX = 0, panY = 0;
  let isPanning = false, startX = 0, startY = 0;
  const wrap = document.getElementById('diagram-wrap');
  const container = document.getElementById('container');

  function applyTransform() {
    wrap.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
  }

  container.addEventListener('wheel', function(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    scale = Math.min(Math.max(0.2, scale + delta), 5);
    applyTransform();
  }, {passive: false});

  container.addEventListener('mousedown', function(e) {
    isPanning = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
  });
  window.addEventListener('mousemove', function(e) {
    if (!isPanning) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applyTransform();
  });
  window.addEventListener('mouseup', function() { isPanning = false; });

  document.getElementById('zoom-in').onclick = function() {
    scale = Math.min(scale + 0.2, 5);
    applyTransform();
  };
  document.getElementById('zoom-out').onclick = function() {
    scale = Math.max(scale - 0.2, 0.2);
    applyTransform();
  };
  document.getElementById('zoom-reset').onclick = function() {
    scale = 1; panX = 0; panY = 0;
    applyTransform();
  };
</script>
</body>
</html>
''';

      final iframe = web.HTMLIFrameElement()
        ..style.setProperty('border', 'none')
        ..style.setProperty('width', '100%')
        ..style.setProperty('height', '100%')
        ..style.setProperty('border-radius', '12px');
      iframe.setAttribute('srcdoc', htmlContent);
      return iframe;
    });
  }

  void _copyCode() {
    Clipboard.setData(ClipboardData(text: widget.code));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Mermaid code copied to clipboard'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  Future<void> _openInNewTab() async {
    // Create a standalone HTML page with the diagram and open it
    final escapedCode = widget.code
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');

    final htmlContent = '''
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Arcadia - Concept Diagram</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<style>
  body { margin: 40px; font-family: -apple-system, sans-serif; background: #f5f5f5; }
  h2 { color: #333; }
  .container { background: white; border-radius: 16px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .mermaid svg { max-width: 100% !important; height: auto !important; }
</style>
</head>
<body>
<div class="container">
<h2>Concept Diagram</h2>
<pre class="mermaid">$escapedCode</pre>
</div>
<script>mermaid.initialize({startOnLoad: true, theme: 'default'});</script>
</body>
</html>
''';

    final dataUri = Uri.dataFromString(htmlContent,
        mimeType: 'text/html', encoding: utf8);
    if (await canLaunchUrl(dataUri)) {
      await launchUrl(dataUri, mode: LaunchMode.externalApplication);
    } else {
      // Fallback: open mermaid.live
      final mermaidLiveUrl = Uri.parse('https://mermaid.live/edit');
      await launchUrl(mermaidLiveUrl, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Action buttons
        Row(
          children: [
            IconButton(
              onPressed: _copyCode,
              icon: const Icon(Icons.copy),
              tooltip: 'Copy Mermaid code',
            ),
            IconButton(
              onPressed: _openInNewTab,
              icon: const Icon(Icons.open_in_new),
              tooltip: 'Open in new tab',
            ),
          ],
        ),
        const SizedBox(height: 8),
        // Rendered diagram
        Container(
          height: 400,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.shade200),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: HtmlElementView(viewType: _viewType),
        ),
        const SizedBox(height: 12),
        // Collapsible code view
        ExpansionTile(
          title: const Text('View Mermaid Code',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
          leading: Icon(Icons.code, color: ArcadiaTheme.primary, size: 20),
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.shade900,
                borderRadius: BorderRadius.circular(8),
              ),
              child: SelectableText(
                widget.code,
                style: const TextStyle(
                  color: Colors.greenAccent,
                  fontFamily: 'monospace',
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
