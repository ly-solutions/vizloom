/** Tiny SVG visuals for dashboard stories (the real sparkline lives in vizloom/charts). */
export function MiniBars({ values, color = 'currentColor' }: { values: readonly number[]; color?: string }) {
  const max = Math.max(1, ...values);
  const w = 100 / values.length;
  return (
    <svg className="sb-mini-bars" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">
      {values.map((v, i) => (
        <rect
          key={i}
          x={i * w + w * 0.15}
          y={36 - (v / max) * 34}
          width={w * 0.7}
          height={(v / max) * 34}
          rx={1}
          fill={color}
          opacity={i === values.length - 1 ? 1 : 0.55}
        />
      ))}
    </svg>
  );
}

export function SplitStrip({ parts }: { parts: readonly { share: number; color: string }[] }) {
  let x = 0;
  return (
    <svg className="sb-mini-bars" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
      {parts.map((p, i) => {
        const r = <rect key={i} x={x} y={0} width={Math.max(0, p.share * 100 - 1)} height={8} rx={2} fill={p.color} />;
        x += p.share * 100;
        return r;
      })}
    </svg>
  );
}
