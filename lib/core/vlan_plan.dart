/// VLAN plan model, validation, and CSV export.
library;

import 'ipv4.dart';

class VlanEntry {
  int vlanId;
  String name;
  String purpose;
  String cidr;
  String gateway;

  VlanEntry({
    required this.vlanId,
    required this.name,
    this.purpose = '',
    this.cidr = '',
    this.gateway = '',
  });

  Cidr? get parsedCidr => cidr.trim().isEmpty ? null : Cidr.tryParse(cidr);
  IPv4? get parsedGateway =>
      gateway.trim().isEmpty ? null : IPv4.tryParse(gateway);

  Map<String, dynamic> toJson() => {
        'vlanId': vlanId,
        'name': name,
        'purpose': purpose,
        'cidr': cidr,
        'gateway': gateway,
      };

  factory VlanEntry.fromJson(Map<String, dynamic> json) => VlanEntry(
        vlanId: json['vlanId'] as int,
        name: json['name'] as String? ?? '',
        purpose: json['purpose'] as String? ?? '',
        cidr: json['cidr'] as String? ?? '',
        gateway: json['gateway'] as String? ?? '',
      );
}

enum IssueSeverity { error, warning }

class PlanIssue {
  final IssueSeverity severity;
  final String message;
  const PlanIssue(this.severity, this.message);
}

List<PlanIssue> validatePlan(List<VlanEntry> entries) {
  final issues = <PlanIssue>[];

  final seenIds = <int, String>{};
  for (final e in entries) {
    final label = 'VLAN ${e.vlanId} (${e.name})';

    if (e.vlanId < 1 || e.vlanId > 4094) {
      issues.add(PlanIssue(
          IssueSeverity.error, '$label: VLAN ID must be 1..4094'));
    } else {
      if (e.vlanId == 1) {
        issues.add(const PlanIssue(IssueSeverity.warning,
            'VLAN 1 is the default VLAN; avoid using it for production traffic'));
      }
      if (e.vlanId >= 1002 && e.vlanId <= 1005) {
        issues.add(PlanIssue(IssueSeverity.warning,
            '$label: 1002-1005 are reserved legacy VLANs on Cisco switches'));
      }
    }

    if (seenIds.containsKey(e.vlanId)) {
      issues.add(PlanIssue(IssueSeverity.error,
          'Duplicate VLAN ID ${e.vlanId}: "${seenIds[e.vlanId]}" and "${e.name}"'));
    } else {
      seenIds[e.vlanId] = e.name;
    }

    if (e.cidr.trim().isNotEmpty && e.parsedCidr == null) {
      issues.add(PlanIssue(
          IssueSeverity.error, '$label: subnet "${e.cidr}" is not valid'));
    }
    if (e.gateway.trim().isNotEmpty) {
      final gw = e.parsedGateway;
      if (gw == null) {
        issues.add(PlanIssue(IssueSeverity.error,
            '$label: gateway "${e.gateway}" is not a valid address'));
      } else {
        final net = e.parsedCidr;
        if (net != null && !net.contains(gw)) {
          issues.add(PlanIssue(IssueSeverity.error,
              '$label: gateway ${e.gateway} is outside ${net.normalized}'));
        }
      }
    }
  }

  // Pairwise subnet overlap check.
  final withNets = entries.where((e) => e.parsedCidr != null).toList();
  for (var i = 0; i < withNets.length; i++) {
    for (var j = i + 1; j < withNets.length; j++) {
      final a = withNets[i].parsedCidr!.normalized;
      final b = withNets[j].parsedCidr!.normalized;
      final aEnd = a.networkValue + a.blockSize - 1;
      final bEnd = b.networkValue + b.blockSize - 1;
      final overlap = a.networkValue <= bEnd && b.networkValue <= aEnd;
      if (overlap) {
        issues.add(PlanIssue(IssueSeverity.error,
            'Subnet overlap: VLAN ${withNets[i].vlanId} ($a) and VLAN ${withNets[j].vlanId} ($b)'));
      }
    }
  }

  return issues;
}

String _csvField(String s) {
  if (s.contains(',') || s.contains('"') || s.contains('\n')) {
    return '"${s.replaceAll('"', '""')}"';
  }
  return s;
}

String planToCsv(List<VlanEntry> entries) {
  final rows = <String>[
    'VLAN ID,Name,Purpose,Subnet,Netmask,Gateway,Usable Range,Usable Hosts'
  ];
  final sorted = [...entries]..sort((a, b) => a.vlanId.compareTo(b.vlanId));
  for (final e in sorted) {
    final net = e.parsedCidr?.normalized;
    var netmask = '';
    var range = '';
    var hosts = '';
    if (net != null) {
      netmask = net.netmask.toString();
      if (net.prefix <= 30) {
        range =
            '${IPv4(net.networkValue + 1)} - ${IPv4(net.networkValue + net.blockSize - 2)}';
        hosts = '${net.blockSize - 2}';
      } else {
        range = '${net.network} - ${net.broadcast}';
        hosts = '${net.blockSize}';
      }
    }
    rows.add([
      '${e.vlanId}',
      _csvField(e.name),
      _csvField(e.purpose),
      net?.toString() ?? _csvField(e.cidr),
      netmask,
      e.gateway,
      range,
      hosts,
    ].join(','));
  }
  return rows.join('\r\n');
}
