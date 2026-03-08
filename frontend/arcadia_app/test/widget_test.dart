import 'package:flutter_test/flutter_test.dart';
import 'package:arcadia_app/main.dart';

void main() {
  testWidgets('Arcadia app smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const ArcadiaApp());
    expect(find.text('Arcadia'), findsOneWidget);
  });
}
