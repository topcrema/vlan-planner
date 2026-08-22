import 'package:flutter/material.dart';

import '../core/aggregate.dart';
import '../core/ipv4.dart';
import 'common.dart';

class AggregateScreen extends StatefulWidget {
  const AggregateScreen({super.key});

  @override
  State<AggregateScreen> createState() => _AggregateScreenState();
}

class _AggregateScreenState extends State<AggregateScreen> {
  final _input = TextEditingController(text: '192.168.0.0/24\n192.168.1.0/24');

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final lines = _input.text
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();
    final parsed = <Cidr>[];
    final invalid = <String>[];
    for (final line in lines) {
      final c = Cidr.tryParse(line);
      if (c == null) {
        invalid.add(line);
      } else {
        parsed.add(c);
      }
    }
    final summarized = aggregate(parsed);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Route Summarization'),
        actions: [
          if (summarized.isNotEmpty)
            IconButton(
              tooltip: 'Copy result',
              icon: const Icon(Icons.copy_all),
              onPressed: () => copyWithToast(
                  context, summarized.map((c) => c.toString()).join('\n'),
                  message: 'Copied ${summarized.length} summarized routes'),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _input,
            maxLines: 8,
            autocorrect: false,
            decoration: const InputDecoration(
              labelText: 'Networks (one per line)',
              helperText: 'Adjacent and contained blocks are merged exactly',
              border: OutlineInputBorder(),
              alignLabelWithHint: true,
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          if (invalid.isNotEmpty)
            Card(
              color: theme.colorScheme.errorContainer,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text('Ignored invalid lines: ${invalid.join(', ')}',
                    style: TextStyle(color: theme.colorScheme.onErrorContainer)),
              ),
            ),
          if (summarized.isNotEmpty) ...[
            Text(
              '${parsed.length} input → ${summarized.length} summarized',
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Card(
              child: Column(
                children: [
                  for (final c in summarized)
                    ResultRow(label: c.netmask.toString(), value: c.toString()),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
