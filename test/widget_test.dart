import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:vlan_planner/main.dart';

void main() {
  testWidgets('App boots and tabs are reachable', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const VlanPlannerApp());
    await tester.pumpAndSettle();

    expect(find.text('Subnet Calculator'), findsOneWidget);
    // Default input renders results immediately.
    expect(find.text('255.255.255.0'), findsWidgets);

    await tester.tap(find.text('VLSM'));
    await tester.pumpAndSettle();
    expect(find.text('VLSM Designer'), findsOneWidget);

    await tester.tap(find.text('Summarize'));
    await tester.pumpAndSettle();
    expect(find.text('Route Summarization'), findsOneWidget);

    await tester.tap(find.text('Plan'));
    await tester.pumpAndSettle();
    expect(find.text('VLAN Plan'), findsOneWidget);
  });
}
