// Pure, testable chart-geometry helpers for the tracker's inline SVG charts. No DOM, no fetch.
export function smoothPath(values: number[], width = 680, height = 170): string {
  if (!values.length) return '';
  const max = Math.max(1, ...values);
  const points = values.map((v, i) => [i * width / Math.max(1, values.length - 1), height - Math.max(0, v) / max * height]);
  return points.reduce((path, [x, y], i) => {
    if (!i) return `M ${x} ${y}`;
    const [px, py] = points[i - 1];
    const mid = (px + x) / 2;
    return `${path} C ${mid} ${py}, ${mid} ${y}, ${x} ${y}`;
  }, '');
}

export function money(cents: number): string {
  const value = cents / 100;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function pct(ratio: number): string { return `${(ratio * 100).toFixed(1)}%`; }

export function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}
