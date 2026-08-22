import 'package:flutter/material.dart';

import 'screens/aggregate_screen.dart';
import 'screens/plan_screen.dart';
import 'screens/subnet_screen.dart';
import 'screens/vlsm_screen.dart';

void main() {
  runApp(const VlanPlannerApp());
}

class VlanPlannerApp extends StatelessWidget {
  const VlanPlannerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VLAN Planner',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF2563EB),
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF60A5FA),
        brightness: Brightness.dark,
      ),
      home: const HomeShell(),
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: const [
          SubnetScreen(),
          VlsmScreen(),
          AggregateScreen(),
          PlanScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.calculate_outlined),
              selectedIcon: Icon(Icons.calculate),
              label: 'Subnet'),
          NavigationDestination(
              icon: Icon(Icons.call_split), label: 'VLSM'),
          NavigationDestination(
              icon: Icon(Icons.merge_type), label: 'Summarize'),
          NavigationDestination(
              icon: Icon(Icons.grid_on_outlined),
              selectedIcon: Icon(Icons.grid_on),
              label: 'Plan'),
        ],
      ),
    );
  }
}
