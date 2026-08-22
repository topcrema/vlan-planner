import 'package:flutter/material.dart';

import '../core/ipv4.dart';
import '../core/vlsm.dart';
import 'common.dart';

class _ReqRow {
  final name = TextEditingController();
  final hosts = TextEditingController();

  _ReqRow([String? n, String? h]) {
    if (n != null) name.text = n;
    if (h != null) hosts.text = h;
  }

  void dispose() {
    name.dispose();
    hosts.dispose();
  }
}

class VlsmScreen extends StatefulWidget {
  const VlsmScreen({super.key});

  @override
  State<VlsmScreen> createState() => _VlsmScreenState();
}

class _VlsmScreenState extends State<VlsmScreen> {
  final _base = TextEditingController(text: '10.0.0.0/22');
  final _rows = <_ReqRow>[
    _ReqRow('Clients', '400'),
    _ReqRow('Servers', '120'),
    _ReqRow('Voice', '50'),
  ];

  @override
  void dispose() {
    _base.dispose();
    for (final r in _rows) {
      r.dispose();
    }
    super.dispose();
  }

  List<VlsmRequest> _requests() {
    final reqs = <VlsmRequest>[];
    for (var i = 0; i < _rows.length; i++) {
      final hosts = int.tryParse(_rows[i].hosts.text.trim());
      if (hosts == null || hosts < 1) continue;
      final name = _rows[i].name.text.trim();
      reqs.add(VlsmRequest(name.isEmpty ? 'Subnet ${i + 1}' : name, hosts));
    }
    return reqs;
  }

  String _csv(VlsmResult result) {
    final rows = <String>['Name,Hosts Needed,Subnet,Netmask,Usable Range,Gateway'];
    for (final a in result.allocations) {
      rows.add('${a.request.name},${a.request.hostsNeeded},${a.subnet},'
          '${a.subnet.netmask},${a.firstHost} - ${a.lastHost},${a.firstHost}');
    }
    return rows.join('\r\n');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = Cidr.tryParse(_base.text);
    final requests = _requests();
    final result =
        (base != null && requests.isNotEmpty) ? allocateVlsm(base, requests) : null;

    return Scaffold(
      appBar: AppBar(
        title: const Text('VLSM Designer'),
        actions: [
          if (result != null && result.ok && result.allocations.isNotEmpty)
            IconButton(
              tooltip: 'Copy as CSV',
              icon: const Icon(Icons.copy_all),
              onPressed: () => copyWithToast(context, _csv(result),
                  message: 'Copied VLSM plan as CSV'),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _base,
            autocorrect: false,
            decoration: InputDecoration(
              labelText: 'Base network',
              helperText: 'The block to carve up, e.g. 10.0.0.0/22',
              border: const OutlineInputBorder(),
              errorText: (_base.text.trim().isNotEmpty && base == null)
                  ? 'Not a valid network'
                  : null,
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          Text('Subnets needed', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          for (var i = 0; i < _rows.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: TextField(
                      controller: _rows[i].name,
                      decoration: InputDecoration(
                        labelText: 'Name',
                        hintText: 'Subnet ${i + 1}',
                        isDense: true,
                        border: const OutlineInputBorder(),
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: TextField(
                      controller: _rows[i].hosts,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Hosts',
                        isDense: true,
                        border: OutlineInputBorder(),
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.remove_circle_outline),
                    tooltip: 'Remove',
                    onPressed: _rows.length <= 1
                        ? null
                        : () => setState(() => _rows.removeAt(i).dispose()),
                  ),
                ],
              ),
            ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => setState(() => _rows.add(_ReqRow())),
              icon: const Icon(Icons.add),
              label: const Text('Add subnet'),
            ),
          ),
          const SizedBox(height: 8),
          if (result != null) ...[
            if (!result.ok)
              Card(
                color: theme.colorScheme.errorContainer,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(result.error!,
                      style: TextStyle(color: theme.colorScheme.onErrorContainer)),
                ),
              ),
            if (result.allocations.isNotEmpty) ...[
              Card(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: DataTable(
                    columns: const [
                      DataColumn(label: Text('Name')),
                      DataColumn(label: Text('Hosts'), numeric: true),
                      DataColumn(label: Text('Subnet')),
                      DataColumn(label: Text('Netmask')),
                      DataColumn(label: Text('Usable range')),
                      DataColumn(label: Text('Fits'), numeric: true),
                    ],
                    rows: [
                      for (final a in result.allocations)
                        DataRow(cells: [
                          DataCell(Text(a.request.name)),
                          DataCell(Text('${a.request.hostsNeeded}')),
                          DataCell(Text('${a.subnet}', style: monoDigits)),
                          DataCell(Text('${a.subnet.netmask}', style: monoDigits)),
                          DataCell(Text('${a.firstHost} - ${a.lastHost}',
                              style: monoDigits)),
                          DataCell(Text(formatInt(a.usableHosts))),
                        ]),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(8),
                child: Text(
                  result.ok
                      ? 'Used ${formatInt(result.addressesUsed)} of '
                          '${formatInt(result.addressesTotal)} addresses '
                          '(${(result.addressesUsed * 100 / result.addressesTotal).toStringAsFixed(1)}%)'
                      : 'Partial allocation shown above',
                  style: theme.textTheme.bodySmall,
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
