/**
 * Guards the Jest configuration, not the maths.
 *
 * The chart layer in `@setframe/domain` is built on d3's headless modules
 * (ADR 0010), which ship as untranspiled ESM with `"type": "module"`. Metro
 * and Vite handle that; Jest does not, unless `d3-*` is whitelisted in
 * `transformIgnorePatterns`. Without it every mobile suite that renders a
 * chart fails with `SyntaxError: Unexpected token 'export'`.
 *
 * That failure mode is why this test exists rather than being left implicit:
 * a broken module mapping in this repo has already made eight suites
 * unrunnable while reporting itself as a *configuration error* rather than a
 * test failure, which is easy to scroll past. This asserts the integration
 * directly, so it shows up as a red test.
 */
import { buildSmallMultiples, buildStackedChart } from '@setframe/domain';

describe('d3-backed chart math under jest', () => {
  it('parses and runs the stacked layout', () => {
    const chart = buildStackedChart(
      [{ localDate: '2026-06-01', values: { squat: 100, hinge: 50 } }],
      { x: 0, y: 0, width: 300, height: 120 },
      { keys: ['squat', 'hinge'] },
    );
    expect(chart.columns[0]!.total).toBe(150);
    expect(chart.segments).toHaveLength(2);
  });

  it('parses and runs the small-multiples layout, emitting a real path', () => {
    const result = buildSmallMultiples(
      [
        {
          id: 'a',
          name: 'A',
          points: [
            { localDate: '2026-05-01', value: 100 },
            { localDate: '2026-06-01', value: 110 },
          ],
        },
      ],
      { panel: { width: 300, height: 90 } },
    );
    expect(result.panels[0]!.path).toMatch(/^M[\d.-]+,[\d.-]+/);
  });
});
