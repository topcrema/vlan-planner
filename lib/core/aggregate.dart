/// Route summarization: merge a list of CIDR blocks into the minimal
/// covering set (exact aggregation, no over-summarization).
library;

import 'dart:math' as math;

import 'ipv4.dart';

class _Range {
  int start;
  int end; // inclusive
  _Range(this.start, this.end);
}

List<Cidr> aggregate(List<Cidr> input) {
  if (input.isEmpty) return const [];

  final ranges = input
      .map((c) => _Range(c.networkValue, c.networkValue + c.blockSize - 1))
      .toList()
    ..sort((a, b) => a.start.compareTo(b.start));

  // Merge overlapping or adjacent ranges.
  final merged = <_Range>[ranges.first];
  for (final r in ranges.skip(1)) {
    final last = merged.last;
    if (r.start <= last.end + 1) {
      if (r.end > last.end) last.end = r.end;
    } else {
      merged.add(_Range(r.start, r.end));
    }
  }

  // Emit each merged range as the minimal list of aligned CIDR blocks.
  final out = <Cidr>[];
  for (final m in merged) {
    var start = m.start;
    while (start <= m.end) {
      final remaining = m.end - start + 1;
      var sizeLog = 0;
      while (sizeLog < 32 && pow2(sizeLog + 1) <= remaining) {
        sizeLog++;
      }
      var alignLog = 0;
      if (start == 0) {
        alignLog = 32;
      } else {
        while (alignLog < 32 && start % pow2(alignLog + 1) == 0) {
          alignLog++;
        }
      }
      final n = math.min(sizeLog, alignLog);
      out.add(Cidr(IPv4(start), 32 - n));
      start += pow2(n);
    }
  }
  return out;
}
