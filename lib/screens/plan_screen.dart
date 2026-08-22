import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/vlan_plan.dart';
import 'common.dart';

const _storageKey = 'vlan_plan_v1';

class PlanScreen extends StatefulWidget {
  const PlanScreen({super.key});

  @override
  State<PlanScreen> createState() => _PlanScreenState();
}

class _PlanScreenState extends State<PlanScreen> {
  List<VlanEntry> _entries = [];
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final sp = await SharedPreferences.getInstance();
    final raw = sp.getString(_storageKey);
    if (raw != null) {
      try {
        _entries = (jsonDecode(raw) as List)
            .map((e) => VlanEntry.fromJson(e as Map<String, dynamic>))
            .toList();
      } catch (_) {
        _entries = [];
      }
    }
    if (mounted) setState(() => _loaded = true);
  }

  Future<void> _save() async {
    final sp = await SharedPreferences.getInstance();
    await sp.setString(
        _storageKey, jsonEncode([for (final e in _entries) e.toJson()]));
  }

  Future<void> _addOrEdit([VlanEntry? existing]) async {
    final result = await showDialog<VlanEntry>(
      context: context,
      builder: (_) => _EntryDialog(existing: existing),
    );
    if (result == null) return;
    setState(() {
      if (existing != null) {
        final i = _entries.indexOf(existing);
        _entries[i] = result;
      } else {
        _entries.add(result);
      }
      _entries.sort((a, b) => a.vlanId.compareTo(b.vlanId));
    });
    await _save();
  }

  Future<void> _delete(VlanEntry entry) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete VLAN?'),
        content: Text('Remove VLAN ${entry.vlanId} (${entry.name})'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete')),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _entries.remove(entry));
    await _save();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final issues = validatePlan(_entries);
    final errors =
        issues.where((i) => i.severity == IssueSeverity.error).toList();
    final warnings =
        issues.where((i) => i.severity == IssueSeverity.warning).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('VLAN Plan'),
        actions: [
          if (_entries.isNotEmpty)
            IconButton(
              tooltip: 'Copy plan as CSV',
              icon: const Icon(Icons.copy_all),
              onPressed: () => copyWithToast(context, planToCsv(_entries),
                  message: 'Copied ${_entries.length} VLANs as CSV'),
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _addOrEdit(),
        icon: const Icon(Icons.add),
        label: const Text('Add VLAN'),
      ),
      body: !_loaded
          ? const Center(child: CircularProgressIndicator())
          : _entries.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Text(
                      'Build your site VLAN table here.\n\n'
                      'Each entry holds a VLAN ID, subnet, and gateway. '
                      'Overlaps, duplicate IDs, and bad gateways are flagged '
                      'automatically. The plan is saved on this device.',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyLarge?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant),
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                  children: [
                    if (errors.isNotEmpty)
                      _IssueCard(
                        color: theme.colorScheme.errorContainer,
                        textColor: theme.colorScheme.onErrorContainer,
                        icon: Icons.error_outline,
                        messages: [for (final i in errors) i.message],
                      ),
                    if (warnings.isNotEmpty)
                      _IssueCard(
                        color: theme.colorScheme.tertiaryContainer,
                        textColor: theme.colorScheme.onTertiaryContainer,
                        icon: Icons.warning_amber_outlined,
                        messages: [for (final i in warnings) i.message],
                      ),
                    for (final e in _entries)
                      Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            child: Text('${e.vlanId}',
                                style: const TextStyle(fontSize: 12)),
                          ),
                          title: Text(e.name.isEmpty ? '(unnamed)' : e.name),
                          subtitle: Text([
                            if (e.cidr.isNotEmpty) e.cidr,
                            if (e.gateway.isNotEmpty) 'GW ${e.gateway}',
                            if (e.purpose.isNotEmpty) e.purpose,
                          ].join('  ·  ')),
                          onTap: () => _addOrEdit(e),
                          trailing: IconButton(
                            icon: const Icon(Icons.delete_outline),
                            tooltip: 'Delete',
                            onPressed: () => _delete(e),
                          ),
                        ),
                      ),
                  ],
                ),
    );
  }
}

class _IssueCard extends StatelessWidget {
  final Color color;
  final Color textColor;
  final IconData icon;
  final List<String> messages;

  const _IssueCard({
    required this.color,
    required this.textColor,
    required this.icon,
    required this.messages,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      color: color,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final m in messages)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(icon, size: 18, color: textColor),
                    const SizedBox(width: 8),
                    Expanded(child: Text(m, style: TextStyle(color: textColor))),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _EntryDialog extends StatefulWidget {
  final VlanEntry? existing;

  const _EntryDialog({this.existing});

  @override
  State<_EntryDialog> createState() => _EntryDialogState();
}

class _EntryDialogState extends State<_EntryDialog> {
  late final TextEditingController _id;
  late final TextEditingController _name;
  late final TextEditingController _purpose;
  late final TextEditingController _cidr;
  late final TextEditingController _gateway;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _id = TextEditingController(text: e == null ? '' : '${e.vlanId}');
    _name = TextEditingController(text: e?.name ?? '');
    _purpose = TextEditingController(text: e?.purpose ?? '');
    _cidr = TextEditingController(text: e?.cidr ?? '');
    _gateway = TextEditingController(text: e?.gateway ?? '');
  }

  @override
  void dispose() {
    for (final c in [_id, _name, _purpose, _cidr, _gateway]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final idValue = int.tryParse(_id.text.trim());
    return AlertDialog(
      title: Text(widget.existing == null ? 'Add VLAN' : 'Edit VLAN'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _id,
              keyboardType: TextInputType.number,
              autofocus: widget.existing == null,
              decoration: const InputDecoration(
                  labelText: 'VLAN ID (1-4094)', border: OutlineInputBorder()),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _name,
              decoration: const InputDecoration(
                  labelText: 'Name', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _cidr,
              autocorrect: false,
              decoration: const InputDecoration(
                  labelText: 'Subnet (CIDR)',
                  hintText: '10.10.90.0/24',
                  border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _gateway,
              autocorrect: false,
              decoration: const InputDecoration(
                  labelText: 'Gateway',
                  hintText: '10.10.90.1',
                  border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _purpose,
              decoration: const InputDecoration(
                  labelText: 'Purpose / note', border: OutlineInputBorder()),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: idValue == null
              ? null
              : () => Navigator.pop(
                    context,
                    VlanEntry(
                      vlanId: idValue,
                      name: _name.text.trim(),
                      purpose: _purpose.text.trim(),
                      cidr: _cidr.text.trim(),
                      gateway: _gateway.text.trim(),
                    ),
                  ),
          child: const Text('Save'),
        ),
      ],
    );
  }
}
