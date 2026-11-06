import { type ReactNode, useEffect, useRef } from 'react';

import { cx, useFormat, useReducedMotion } from '../core';

export interface FeedItem {
  readonly id: string;
  readonly at: number;
  readonly title: ReactNode;
  readonly sub?: ReactNode;
  /** Formatted amount, e.g. "+$120" / "−$40". */
  readonly amount?: ReactNode;
  readonly tone?: 'positive' | 'negative' | 'neutral';
  readonly icon?: ReactNode;
}

export interface ActivityFeedProps {
  readonly items: readonly FeedItem[];
  /** Group header per day. */
  readonly groupByDay?: boolean;
  /** "now" for relative times (injectable for SSR/tests). */
  readonly now?: number;
  readonly empty?: ReactNode;
  readonly maxHeight?: number;
  readonly 'aria-label': string;
  readonly className?: string;
}

/** Live activity feed (purchases, refunds): new items slide in on top, relative times. */
export function ActivityFeed({ items, groupByDay = true, now, empty, maxHeight, className, 'aria-label': ariaLabel }: ActivityFeedProps) {
  const format = useFormat();
  const reduced = useReducedMotion();
  const seen = useRef<Set<string> | null>(null);
  const first = seen.current === null;
  if (seen.current === null) seen.current = new Set(items.map((i) => i.id));
  const fresh = new Set(first ? [] : items.filter((i) => !seen.current!.has(i.id)).map((i) => i.id));
  useEffect(() => {
    for (const i of items) seen.current!.add(i.id);
  }, [items]);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (ref.current && maxHeight) ref.current.style.setProperty('--vl-feed-max-h', `${maxHeight}px`);
  }, [maxHeight]);
  const ref0 = now ?? items[0]?.at ?? 0;
  if (!items.length) return <div className={cx('vl-feed', 'vl-feed--empty', className)}>{empty ?? format.locale.strings.noData}</div>;
  const groups: { day: string; items: FeedItem[] }[] = [];
  for (const item of items) {
    const day = groupByDay ? format.day(item.at) : '';
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return (
    <div
      ref={ref}
      className={cx('vl-feed', maxHeight && 'vl-feed--scroll', className)}
      role="log"
      aria-label={ariaLabel}
      aria-live="polite"
    >
      {groups.map((g) => (
        <div key={g.day || 'all'} className="vl-feed__group">
          {groupByDay ? <div className="vl-feed__day">{g.day}</div> : null}
          <ul className="vl-feed__list">
            {g.items.map((item) => (
              <li
                key={item.id}
                className={cx('vl-feed__item', fresh.has(item.id) && !reduced && 'vl-feed__item--new')}
                data-tone={item.tone ?? 'neutral'}
              >
                {item.icon ? <span className="vl-feed__icon">{item.icon}</span> : null}
                <span className="vl-feed__text">
                  <span className="vl-feed__title">{item.title}</span>
                  {item.sub ? <span className="vl-feed__sub">{item.sub}</span> : null}
                </span>
                <span className="vl-feed__side">
                  {item.amount ? <span className="vl-feed__amount">{item.amount}</span> : null}
                  <time className="vl-feed__time" dateTime={new Date(item.at).toISOString()}>
                    {format.relative(item.at, Math.max(ref0, item.at))}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
