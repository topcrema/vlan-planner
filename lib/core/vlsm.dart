/// VLSM allocation: split a base network into right-sized subnets.
library;

import 'ipv4.dart';

class VlsmRequest {
  final String name;
  final int hostsNeeded;
  const VlsmRequest(this.name, this.hostsNeeded);
}

class VlsmAllocation {
  final VlsmRequest request;
  final Cidr subnet;
  const VlsmAllocation(this.request, this.subnet);

  IPv4 get firstHost => IPv4(subnet.networkValue + 1);
  IPv4 get lastHost => IPv4(subnet.networkValue + subnet.blockSize - 2);
  int get usableHosts => subnet.blockSize - 2;
}

class VlsmResult {
  final List<VlsmAllocation> allocations;
  final String? error;
  final int addressesUsed;
  final int addressesTotal;

  const VlsmResult({
    required this.allocations,
    this.error,
    required this.addressesUsed,
    required this.addressesTotal,
  });

  bool get ok => error == null;
}

/// Smallest prefix that fits [hosts] usable hosts (network/broadcast
/// excluded), or null when hosts < 1 or it cannot fit in IPv4.
int? prefixForHosts(int hosts) {
  if (hosts < 1) return null;
  final needed = hosts + 2;
  for (var p = 30; p >= 0; p--) {
    if (pow2(32 - p) >= needed) return p;
  }
  return null;
}

/// First-fit allocation, largest request first (guarantees alignment and
/// minimal waste for power-of-two blocks).
VlsmResult allocateVlsm(Cidr base, List<VlsmRequest> requests) {
  final baseNet = base.normalized;
  final total = baseNet.blockSize;
  final endExclusive = baseNet.networkValue + total;

  final sorted = [...requests]
    ..sort((a, b) => b.hostsNeeded.compareTo(a.hostsNeeded));

  var cursor = baseNet.networkValue;
  final allocations = <VlsmAllocation>[];

  for (final req in sorted) {
    final prefix = prefixForHosts(req.hostsNeeded);
    if (prefix == null) {
      return VlsmResult(
        allocations: allocations,
        error: '"${req.name}": host count must be at least 1',
        addressesUsed: cursor - baseNet.networkValue,
        addressesTotal: total,
      );
    }
    if (prefix < baseNet.prefix) {
      return VlsmResult(
        allocations: allocations,
        error:
            '"${req.name}" needs a /$prefix, larger than the base network /${baseNet.prefix}',
        addressesUsed: cursor - baseNet.networkValue,
        addressesTotal: total,
      );
    }
    final size = pow2(32 - prefix);
    final aligned = (cursor + size - 1) ~/ size * size;
    if (aligned + size > endExclusive) {
      return VlsmResult(
        allocations: allocations,
        error: 'Base network exhausted while placing "${req.name}"',
        addressesUsed: cursor - baseNet.networkValue,
        addressesTotal: total,
      );
    }
    allocations.add(VlsmAllocation(req, Cidr(IPv4(aligned), prefix)));
    cursor = aligned + size;
  }

  return VlsmResult(
    allocations: allocations,
    addressesUsed: cursor - baseNet.networkValue,
    addressesTotal: total,
  );
}
