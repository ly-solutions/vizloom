import { type ReactNode, useState } from 'react';

import { cx, seriesColor, Swatch, useFormat } from '../../core';

export interface SplitPart {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly color?: string;
  /** `muted` — grey remainder ("not checked in yet"). */
  readonly tone?: 'default' | 'muted';
}

export interface SplitBarProps {
  readonly parts: readonly SplitPart[];
  /** Accessible name; parts are listed after it. */
  readonly title: string;
  /** Legend under the bar with share and value. Default true (false in `mini`). */
  readonly legend?: boolean;
  readonly formatValue?: (v: number) => string;
  /** Thin bar without legend for tiles. */
  readonly mini?: boolean;
  readonly height?: number;
  /** Text in the legend after the value. */
  readonly renderNote?: (part: SplitPart, share: number) => ReactNode;
  readonly className?: string;
}

/** Proportion strip: parts of a whole as one bar (paid / pending / refunded, came / not yet). */
export function SplitBar({ parts, title, legend, formatValue, mini = false, height, renderNote, className }: SplitBarProps) {
  const format = useFormat();
  const [focus, setFocus] = useState<string | null>(null);
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  const fmt = formatValue ?? ((v: number) => format.number(v));
  const colorOf = (p: SplitPart, i: number) => p.color ?? (p.tone === 'muted' ? 'var(--vl-neutral-soft)' : seriesColor(i));
  const share = (p: SplitPart) => (total > 0 ? Math.max(0, p.value) / total : 0);
  const spoken = `${title}: ${parts.map((p) => `${p.label} ${format.percent(share(p) * 100, 0)}`).join(', ')}`;
  const showLegend = legend ?? !mini;
  return (
    <div className={cx('vl-split', mini && 'vl-split--mini', focus && 'vl-split--focused', className)}>
      <div
        className="vl-split__bar"
        role="img"
        aria-label={spoken}
        ref={(n) => {
          if (n && height) n.style.setProperty('--vl-split-h', `${height}px`);
        }}
      >
        {parts.map((p, i) => (
          <span
            key={p.key}
            className="vl-split__part"
            data-focus={focus === p.key || undefined}
            title={`${p.label}: ${fmt(p.value)} · ${format.percent(share(p) * 100, 0)}`}
            ref={(n) => {
              if (!n) return;
              n.style.setProperty('--vl-split-grow', String(Math.max(share(p), 0.0001)));
              n.style.setProperty('--vl-split-color', colorOf(p, i));
            }}
            onPointerEnter={() => setFocus(p.key)}
            onPointerLeave={() => setFocus(null)}
          />
        ))}
      </div>
      {showLegend ? (
        <ul className="vl-split__legend">
          {parts.map((p, i) => (
            <li
              key={p.key}
              className="vl-split__item"
              data-focus={focus === p.key || undefined}
              onPointerEnter={() => setFocus(p.key)}
              onPointerLeave={() => setFocus(null)}
            >
              <Swatch color={colorOf(p, i)} shape="square" />
              <span className="vl-split__label">{p.label}</span>
              <span className="vl-split__share">{format.percent(share(p) * 100, 0)}</span>
              <span className="vl-split__value">{fmt(p.value)}</span>
              {renderNote ? <span className="vl-split__note">{renderNote(p, share(p))}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
