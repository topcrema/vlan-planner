/// Subnet detail computation for the Subnet calculator tab.
library;

import 'ipv4.dart';

class _SpecialRange {
  final Cidr block;
  final String label;
  const _SpecialRange(this.block, this.label);
}

const _specialRanges = <_SpecialRange>[
  _SpecialRange(Cidr(IPv4(0x00000000), 8), 'This network (RFC 791)'),
  _SpecialRange(Cidr(IPv4(0x0A000000), 8), 'Private (RFC 1918)'),
  _SpecialRange(Cidr(IPv4(0x64400000), 10), 'Carrier-grade NAT (RFC 6598)'),
  _SpecialRange(Cidr(IPv4(0x7F000000), 8), 'Loopback'),
  _SpecialRange(Cidr(IPv4(0xA9FE0000), 16), 'Link-local (APIPA)'),
  _SpecialRange(Cidr(IPv4(0xAC100000), 12), 'Private (RFC 1918)'),
  _SpecialRange(Cidr(IPv4(0xC0000200), 24), 'Documentation (TEST-NET-1)'),
  _SpecialRange(Cidr(IPv4(0xC0586300), 24), '6to4 relay anycast'),
  _SpecialRange(Cidr(IPv4(0xC0A80000), 16), 'Private (RFC 1918)'),
  _SpecialRange(Cidr(IPv4(0xC6120000), 15), 'Benchmarking (RFC 2544)'),
  _SpecialRange(Cidr(IPv4(0xC6336400), 24), 'Documentation (TEST-NET-2)'),
  _SpecialRange(Cidr(IPv4(0xCB007100), 24), 'Documentation (TEST-NET-3)'),
  _SpecialRange(Cidr(IPv4(0xE0000000), 4), 'Multicast'),
  _SpecialRange(Cidr(IPv4(0xF0000000), 4), 'Reserved (Class E)'),
];

class SubnetInfo {
  final Cidr cidr;

  SubnetInfo(this.cidr);

  bool get isPointToPoint => cidr.prefix == 31;
  bool get isHostRoute => cidr.prefix == 32;

  IPv4 get firstHost {
    if (cidr.prefix >= 31) return cidr.network;
    return IPv4(cidr.networkValue + 1);
  }

  IPv4 get lastHost {
    if (cidr.prefix == 32) return cidr.network;
    if (cidr.prefix == 31) return cidr.broadcast;
    return IPv4(cidr.networkValue + cidr.blockSize - 2);
  }

  /// /31 counts both addresses (RFC 3021); /32 is a single host route.
  int get usableHosts {
    if (cidr.prefix == 32) return 1;
    if (cidr.prefix == 31) return 2;
    return cidr.blockSize - 2;
  }

  /// Legacy classful letter for the address (A..E).
  String get legacyClass {
    final first = cidr.address.value ~/ 16777216;
    if (first < 128) return 'A';
    if (first < 192) return 'B';
    if (first < 224) return 'C';
    if (first < 240) return 'D';
    return 'E';
  }

  /// Special-use label, or 'Public (globally routable)' when none matches.
  String get scope {
    for (final r in _specialRanges) {
      if (r.block.contains(cidr.address)) return r.label;
    }
    return 'Public (globally routable)';
  }
}
