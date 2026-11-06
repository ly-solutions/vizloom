import { type ReactNode, useState } from 'react';

import { cx, useLocale } from '../core';

export interface Insight {
  readonly id: string;
  /** `risk` sorts first and is red; `warn` amber; `info` neutral. */
  readonly tone: 'risk' | 'warn' | 'info';
  readonly title: ReactNode;
  readonly detail?: ReactNode;
  /** Mini visual: split bar, progress, sparkline. */
  readonly visual?: ReactNode;
  readonly action?: { readonly label: string; readonly onClick: () => void };
}

export interface InsightListProps {
  readonly title: ReactNode;
  readonly items: readonly Insight[];
  /** Show this many, the rest behind "N more". Default 3 on narrow containers is up to the caller. */
  readonly collapseAfter?: number;
  readonly className?: string;
}

const ORDER = { risk: 0, warn: 1, info: 2 } as const;

/** "Needs attention": insight cells, risks first, collapsible tail. */
export function InsightList({ title, items, collapseAfter = 6, className }: InsightListProps) {
  const s = useLocale().strings;
  const [open, setOpen] = useState(false);
  const sorted = [...items].sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
  const visible = open ? sorted : sorted.slice(0, collapseAfter);
  const rest = sorted.length - collapseAfter;
  return (
    <section className={cx('vl-insights', className)}>
      <h3 className="vl-insights__title">
        {title} <span className="vl-insights__count">{items.length}</span>
      </h3>
      <ul className="vl-insights__list">
        {visible.map((item) => (
          <li key={item.id} className="vl-insight" data-tone={item.tone}>
            <span className="vl-insight__dot" aria-hidden="true" />
            <div className="vl-insight__body">
              <div className="vl-insight__title">{item.title}</div>
              {item.detail ? <div className="vl-insight__detail">{item.detail}</div> : null}
              {item.visual ? <div className="vl-insight__visual">{item.visual}</div> : null}
              {item.action ? (
                <button type="button" className="vl-insight__action" onClick={item.action.onClick}>
                  {item.action.label}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {rest > 0 ? (
        <button
          type="button"
          className="vl-button vl-button--ghost vl-insights__more"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? s.showLess : s.more(rest)}
        </button>
      ) : null}
    </section>
  );
}
