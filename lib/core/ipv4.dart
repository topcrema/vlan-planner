/// Pure-Dart IPv4 / CIDR primitives shared by all calculators.
///
/// No Flutter dependencies. All arithmetic stays web-safe: bitwise ops are
/// kept within unsigned 32-bit range and block sizes (which can reach 2^32)
/// are computed without shifts.
library;

/// 2^n for n in 0..32 without using `<<` (which is 32-bit-truncated on web).
int pow2(int n) {
  assert(n >= 0 && n <= 32);
  var v = 1;
  for (var i = 0; i < n; i++) {
    v *= 2;
  }
  return v;
}

class IPv4 implements Comparable<IPv4> {
  /// Unsigned 32-bit address value.
  final int value;

  const IPv4(this.value) : assert(value >= 0 && value <= 0xFFFFFFFF);

  static IPv4? tryParse(String input) {
    final parts = input.trim().split('.');
    if (parts.length != 4) return null;
    var v = 0;
    for (final part in parts) {
      if (part.isEmpty || part.length > 3) return null;
      final n = int.tryParse(part);
      if (n == null || n < 0 || n > 255) return null;
      v = v * 256 + n;
    }
    return IPv4(v);
  }

  @override
  String toString() {
    final a = value ~/ 16777216;
    final b = (value ~/ 65536) % 256;
    final c = (value ~/ 256) % 256;
    final d = value % 256;
    return '$a.$b.$c.$d';
  }

  String toBinary() {
    final octets = <String>[];
    for (var i = 3; i >= 0; i--) {
      final octet = (value ~/ pow2(8 * i)) % 256;
      octets.add(octet.toRadixString(2).padLeft(8, '0'));
    }
    return octets.join('.');
  }

  @override
  int compareTo(IPv4 other) => value.compareTo(other.value);

  @override
  bool operator ==(Object other) => other is IPv4 && other.value == value;

  @override
  int get hashCode => value.hashCode;
}

/// Netmask value for a prefix length (0..32).
int maskFromPrefix(int prefix) {
  assert(prefix >= 0 && prefix <= 32);
  return 0xFFFFFFFF - (pow2(32 - prefix) - 1);
}

/// Prefix length for a dotted netmask value, or null if not contiguous.
int? prefixFromMask(int mask) {
  for (var p = 0; p <= 32; p++) {
    if (maskFromPrefix(p) == mask) return p;
  }
  return null;
}

class Cidr {
  final IPv4 address;
  final int prefix;

  const Cidr(this.address, this.prefix)
      : assert(prefix >= 0 && prefix <= 32);

  /// Accepts "a.b.c.d/nn", "a.b.c.d nn", "a.b.c.d a.b.c.d" (dotted mask),
  /// or a bare address (treated as /32).
  static Cidr? tryParse(String input) {
    final s = input.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (s.isEmpty) return null;
    String ipPart;
    String? suffix;
    if (s.contains('/')) {
      final i = s.indexOf('/');
      ipPart = s.substring(0, i).trim();
      suffix = s.substring(i + 1).trim();
    } else if (s.contains(' ')) {
      final i = s.indexOf(' ');
      ipPart = s.substring(0, i);
      suffix = s.substring(i + 1);
    } else {
      ipPart = s;
    }
    final ip = IPv4.tryParse(ipPart);
    if (ip == null) return null;
    if (suffix == null) return Cidr(ip, 32);
    if (suffix.isEmpty) return null;
    final p = int.tryParse(suffix);
    if (p != null) {
      if (p < 0 || p > 32) return null;
      return Cidr(ip, p);
    }
    final mask = IPv4.tryParse(suffix);
    if (mask == null) return null;
    final prefix = prefixFromMask(mask.value);
    if (prefix == null) return null;
    return Cidr(ip, prefix);
  }

  int get maskValue => maskFromPrefix(prefix);
  IPv4 get netmask => IPv4(maskValue);
  IPv4 get wildcard => IPv4(0xFFFFFFFF - maskValue);

  int get networkValue => address.value - (address.value % blockSize);
  IPv4 get network => IPv4(networkValue);
  IPv4 get broadcast => IPv4(networkValue + blockSize - 1);

  /// Total addresses in the block (2 .. 2^32).
  int get blockSize => pow2(32 - prefix);

  bool contains(IPv4 ip) =>
      ip.value >= networkValue && ip.value <= networkValue + blockSize - 1;

  /// The same block expressed from its network address.
  Cidr get normalized => Cidr(network, prefix);

  @override
  String toString() => '$address/$prefix';

  @override
  bool operator ==(Object other) =>
      other is Cidr && other.address == address && other.prefix == prefix;

  @override
  int get hashCode => Object.hash(address, prefix);
}
