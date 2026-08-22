# VLAN Planner

Offline subnet, VLSM, and VLAN design calculator for network engineers. Built with Flutter.

## Features

- **Subnet calculator** — CIDR or dotted-mask input; network, broadcast, wildcard, host range, usable hosts, special-range detection (RFC 1918, CGN, link-local, multicast, ...), binary view. Handles /31 (RFC 3021) and /32 correctly.
- **VLSM designer** — give it a base block and a list of subnets with host counts; it allocates right-sized, aligned subnets largest-first and reports utilization. Export as CSV.
- **Route summarization** — merges a list of CIDR blocks into the minimal exact covering set.
- **VLAN plan** — a persistent per-site VLAN table (ID, name, subnet, gateway, purpose) with live validation: duplicate IDs, reserved IDs, subnet overlaps, gateways outside their subnet. Export as CSV.

Fully offline. No accounts, no analytics, no data collection ([privacy policy](docs/privacy.html)).

## Development

```
flutter pub get
flutter test
flutter run -d chrome   # quick local preview; also runs on iOS/Android
```

Core calculation logic lives in `lib/core/` as pure Dart with unit tests in `test/core_test.dart`.

## CI/CD

- `ci.yml` — analyze + test on every push/PR.
- `ios-release.yml` — on a `v*` tag (or manual dispatch), builds a signed IPA on the macOS runner and uploads it to TestFlight. Signing uses [fastlane match](https://docs.fastlane.tools/actions/match/) with certificates stored in a **separate private repo**; see the secrets list at the top of the workflow file.

## License

MIT
