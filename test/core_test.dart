import 'package:flutter_test/flutter_test.dart';
import 'package:vlan_planner/core/aggregate.dart';
import 'package:vlan_planner/core/ipv4.dart';
import 'package:vlan_planner/core/subnet.dart';
import 'package:vlan_planner/core/vlan_plan.dart';
import 'package:vlan_planner/core/vlsm.dart';

void main() {
  group('IPv4 / Cidr parsing', () {
    test('parses dotted quad', () {
      expect(IPv4.tryParse('10.10.90.5').toString(), '10.10.90.5');
      expect(IPv4.tryParse('0.0.0.0')!.value, 0);
      expect(IPv4.tryParse('255.255.255.255')!.value, 0xFFFFFFFF);
    });

    test('rejects invalid addresses', () {
      for (final bad in ['256.1.1.1', '1.2.3', '1.2.3.4.5', 'a.b.c.d', '', '1..2.3']) {
        expect(IPv4.tryParse(bad), isNull, reason: bad);
      }
    });

    test('parses CIDR, mask form, and bare address', () {
      expect(Cidr.tryParse('10.10.90.5/23').toString(), '10.10.90.5/23');
      expect(Cidr.tryParse('192.168.1.10 255.255.255.0')!.prefix, 24);
      expect(Cidr.tryParse('192.168.1.10/255.255.255.0')!.prefix, 24);
      expect(Cidr.tryParse('8.8.8.8')!.prefix, 32);
      expect(Cidr.tryParse('10.0.0.0/33'), isNull);
      expect(Cidr.tryParse('10.0.0.0/255.0.255.0'), isNull);
    });
  });

  group('Subnet math', () {
    test('/23 example', () {
      final c = Cidr.tryParse('10.10.90.5/23')!;
      final info = SubnetInfo(c);
      expect(c.network.toString(), '10.10.90.0');
      expect(c.broadcast.toString(), '10.10.91.255');
      expect(c.netmask.toString(), '255.255.254.0');
      expect(c.wildcard.toString(), '0.0.1.255');
      expect(info.firstHost.toString(), '10.10.90.1');
      expect(info.lastHost.toString(), '10.10.91.254');
      expect(info.usableHosts, 510);
      expect(c.blockSize, 512);
    });

    test('/31 and /32 conventions', () {
      final p2p = SubnetInfo(Cidr.tryParse('10.0.0.0/31')!);
      expect(p2p.usableHosts, 2);
      expect(p2p.firstHost.toString(), '10.0.0.0');
      expect(p2p.lastHost.toString(), '10.0.0.1');

      final host = SubnetInfo(Cidr.tryParse('10.0.0.5/32')!);
      expect(host.usableHosts, 1);
      expect(host.firstHost.toString(), '10.0.0.5');
    });

    test('/0 covers everything', () {
      final all = Cidr.tryParse('0.0.0.0/0')!;
      expect(all.blockSize, 4294967296);
      expect(all.broadcast.toString(), '255.255.255.255');
    });

    test('scope classification', () {
      expect(SubnetInfo(Cidr.tryParse('10.1.2.3/24')!).scope,
          'Private (RFC 1918)');
      expect(SubnetInfo(Cidr.tryParse('172.20.0.1/16')!).scope,
          'Private (RFC 1918)');
      expect(SubnetInfo(Cidr.tryParse('192.168.0.1/24')!).scope,
          'Private (RFC 1918)');
      expect(SubnetInfo(Cidr.tryParse('100.90.0.1/10')!).scope,
          'Carrier-grade NAT (RFC 6598)');
      expect(SubnetInfo(Cidr.tryParse('8.8.8.8/32')!).scope,
          'Public (globally routable)');
      expect(SubnetInfo(Cidr.tryParse('224.0.0.5/32')!).scope, 'Multicast');
      expect(SubnetInfo(Cidr.tryParse('169.254.10.1/16')!).scope,
          'Link-local (APIPA)');
    });

    test('legacy class letters', () {
      expect(SubnetInfo(Cidr.tryParse('10.0.0.1')!).legacyClass, 'A');
      expect(SubnetInfo(Cidr.tryParse('172.16.0.1')!).legacyClass, 'B');
      expect(SubnetInfo(Cidr.tryParse('203.0.113.1')!).legacyClass, 'C');
      expect(SubnetInfo(Cidr.tryParse('239.1.1.1')!).legacyClass, 'D');
      expect(SubnetInfo(Cidr.tryParse('250.1.1.1')!).legacyClass, 'E');
    });
  });

  group('VLSM', () {
    test('prefix sizing', () {
      expect(prefixForHosts(1), 30);
      expect(prefixForHosts(2), 30);
      expect(prefixForHosts(3), 29);
      expect(prefixForHosts(50), 26);
      expect(prefixForHosts(254), 24);
      expect(prefixForHosts(255), 23);
      expect(prefixForHosts(0), isNull);
    });

    test('classic allocation', () {
      final result = allocateVlsm(Cidr.tryParse('192.168.0.0/24')!, const [
        VlsmRequest('Sales', 100),
        VlsmRequest('Eng', 50),
        VlsmRequest('Mgmt', 20),
        VlsmRequest('P2P', 2),
      ]);
      expect(result.ok, isTrue);
      final bySubnet =
          result.allocations.map((a) => '${a.request.name}:${a.subnet}').toList();
      expect(bySubnet, [
        'Sales:192.168.0.0/25',
        'Eng:192.168.0.128/26',
        'Mgmt:192.168.0.192/27',
        'P2P:192.168.0.224/30',
      ]);
      expect(result.addressesUsed, 128 + 64 + 32 + 4);
      expect(result.addressesTotal, 256);
    });

    test('exhaustion is reported', () {
      final result = allocateVlsm(Cidr.tryParse('10.0.0.0/26')!, const [
        VlsmRequest('TooBig', 100),
      ]);
      expect(result.ok, isFalse);
      expect(result.error, contains('TooBig'));
    });

    test('base address is normalized to its network', () {
      final result = allocateVlsm(Cidr.tryParse('10.0.0.77/24')!, const [
        VlsmRequest('A', 10),
      ]);
      expect(result.allocations.single.subnet.toString(), '10.0.0.0/28');
    });
  });

  group('Aggregation', () {
    Cidr c(String s) => Cidr.tryParse(s)!;

    test('merges adjacent pair', () {
      expect(aggregate([c('192.168.0.0/24'), c('192.168.1.0/24')]),
          [c('192.168.0.0/23')]);
    });

    test('keeps non-adjacent blocks apart', () {
      expect(aggregate([c('10.0.0.0/24'), c('10.0.2.0/24')]),
          [c('10.0.0.0/24'), c('10.0.2.0/24')]);
    });

    test('absorbs contained blocks', () {
      expect(aggregate([c('10.0.0.0/8'), c('10.1.0.0/16')]), [c('10.0.0.0/8')]);
    });

    test('splits ranges that are not block-aligned', () {
      // .1.0/24 + .2.0/24 are adjacent but cannot form a single block.
      expect(aggregate([c('10.0.1.0/24'), c('10.0.2.0/24')]),
          [c('10.0.1.0/24'), c('10.0.2.0/24')]);
    });

    test('four /26 become one /24', () {
      expect(
          aggregate([
            c('172.16.5.0/26'),
            c('172.16.5.64/26'),
            c('172.16.5.128/26'),
            c('172.16.5.192/26'),
          ]),
          [c('172.16.5.0/24')]);
    });
  });

  group('VLAN plan validation', () {
    test('flags duplicates, overlaps, and bad gateways', () {
      final entries = [
        VlanEntry(vlanId: 10, name: 'Servers', cidr: '10.10.90.0/23', gateway: '10.10.90.1'),
        VlanEntry(vlanId: 10, name: 'Dup', cidr: '10.10.92.0/24'),
        VlanEntry(vlanId: 20, name: 'Overlap', cidr: '10.10.91.0/24'),
        VlanEntry(vlanId: 30, name: 'BadGw', cidr: '10.10.93.0/24', gateway: '10.10.94.1'),
        VlanEntry(vlanId: 5000, name: 'BadId'),
      ];
      final issues = validatePlan(entries);
      final errors = issues
          .where((i) => i.severity == IssueSeverity.error)
          .map((i) => i.message)
          .toList();
      expect(errors.any((m) => m.contains('Duplicate VLAN ID 10')), isTrue);
      expect(errors.any((m) => m.contains('Subnet overlap')), isTrue);
      expect(errors.any((m) => m.contains('gateway 10.10.94.1')), isTrue);
      expect(errors.any((m) => m.contains('must be 1..4094')), isTrue);
    });

    test('clean plan has no errors', () {
      final entries = [
        VlanEntry(vlanId: 10, name: 'Servers', cidr: '10.10.90.0/24', gateway: '10.10.90.1'),
        VlanEntry(vlanId: 20, name: 'Clients', cidr: '10.10.91.0/24', gateway: '10.10.91.1'),
      ];
      final errors = validatePlan(entries)
          .where((i) => i.severity == IssueSeverity.error);
      expect(errors, isEmpty);
    });

    test('CSV export', () {
      final csv = planToCsv([
        VlanEntry(vlanId: 20, name: 'B, with comma', cidr: '10.0.1.0/24'),
        VlanEntry(vlanId: 10, name: 'A', cidr: '10.0.0.0/24', gateway: '10.0.0.1'),
      ]);
      final lines = csv.split('\r\n');
      expect(lines.first, startsWith('VLAN ID,Name'));
      expect(lines[1], startsWith('10,A,'));
      expect(lines[2], contains('"B, with comma"'));
      expect(lines[1], contains('10.0.0.1 - 10.0.0.254'));
    });
  });
}
