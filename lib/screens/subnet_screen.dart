import 'package:flutter/material.dart';

import '../core/ipv4.dart';
import '../core/subnet.dart';
import 'common.dart';

class SubnetScreen extends StatefulWidget {
  const SubnetScreen({super.key});

  @override
  State<SubnetScreen> createState() => _SubnetScreenState();
}

class _SubnetScreenState extends State<SubnetScreen> {
  final _input = TextEditingController(text: '192.168.10.0/24');

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = _input.text;
    final cidr = Cidr.tryParse(text);
    return Scaffold(
      appBar: AppBar(title: const Text('Subnet Calculator')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _input,
            autocorrect: false,
            decoration: InputDecoration(
              labelText: 'IP address / prefix',
              helperText: 'e.g. 10.20.30.40/23  ·  192.168.1.10 255.255.255.0',
              border: const OutlineInputBorder(),
              errorText: (text.trim().isNotEmpty && cidr == null)
                  ? 'Not a valid IPv4 address, CIDR, or mask'
                  : null,
              suffixIcon: IconButton(
                icon: const Icon(Icons.clear),
                onPressed: () => setState(_input.clear),
              ),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          if (cidr != null) _ResultsCard(cidr: cidr),
        ],
      ),
    );
  }
}

class _ResultsCard extends StatelessWidget {
  final Cidr cidr;

  const _ResultsCard({required this.cidr});

  @override
  Widget build(BuildContext context) {
    final info = SubnetInfo(cidr);
    final rows = <(String, String)>[
      ('Network', '${cidr.network}/${cidr.prefix}'),
      ('Netmask', '${cidr.netmask}'),
      ('Wildcard', '${cidr.wildcard}'),
      ('Broadcast', cidr.prefix >= 31 ? 'n/a' : '${cidr.broadcast}'),
      ('Host range', '${info.firstHost} - ${info.lastHost}'),
      ('Usable hosts', formatInt(info.usableHosts)),
      ('Total addresses', formatInt(cidr.blockSize)),
      ('Scope', info.scope),
      ('Legacy class', info.legacyClass),
      ('Address binary', cidr.address.toBinary()),
      ('Netmask binary', cidr.netmask.toBinary()),
    ];
    return Card(
      child: Column(
        children: [
          for (final (label, value) in rows)
            ResultRow(label: label, value: value),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Text(
              'Tap a row to copy',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ),
        ],
      ),
    );
  }
}
