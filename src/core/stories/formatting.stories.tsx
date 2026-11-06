import type { Meta, StoryObj } from '@storybook/react';

import { createFormatter, currencyUnit, en, fixedOffsetZone, HOUR, ru, UNIT_PERCENT } from '..';

const meta: Meta = { title: 'Core/Formatting' };
export default meta;

const T = Date.UTC(2026, 9, 7, 14, 0);
const SAMPLES = [
  ['number(1234567)', (f: ReturnType<typeof createFormatter>) => f.number(1234567)],
  ['compact(1234)', (f: ReturnType<typeof createFormatter>) => f.compact(1234)],
  ['compact(48 000)', (f: ReturnType<typeof createFormatter>) => f.compact(48000)],
  ['compact(1.5M)', (f: ReturnType<typeof createFormatter>) => f.compact(1_500_000)],
  ['currency(248 000, USD)', (f: ReturnType<typeof createFormatter>) => f.currency(248000, 'USD')],
  ['currency(248 000, RUB)', (f: ReturnType<typeof createFormatter>) => f.currency(248000, 'RUB')],
  ['value(248 000, EUR, short)', (f: ReturnType<typeof createFormatter>) => f.value(248000, currencyUnit('EUR'))],
  ['value(12.34, percent)', (f: ReturnType<typeof createFormatter>) => f.value(12.34, UNIT_PERCENT)],
  ['delta(24)', (f: ReturnType<typeof createFormatter>) => f.delta(24)],
  ['delta(−42)', (f: ReturnType<typeof createFormatter>) => f.delta(-42)],
  ['day(t)', (f: ReturnType<typeof createFormatter>) => f.day(T)],
  ['date(t)', (f: ReturnType<typeof createFormatter>) => f.date(T)],
  ['time(t)', (f: ReturnType<typeof createFormatter>) => f.time(T)],
  ['bucket(hour)', (f: ReturnType<typeof createFormatter>) => f.bucket(T, 'hour', HOUR)],
  ['bucket(day)', (f: ReturnType<typeof createFormatter>) => f.bucket(T, 'day', 24 * HOUR)],
  ['range(t, t+44h)', (f: ReturnType<typeof createFormatter>) => f.range(T, T + 44 * HOUR)],
  ['span(44h)', (f: ReturnType<typeof createFormatter>) => f.span(44 * HOUR)],
  ['relative(t−3min)', (f: ReturnType<typeof createFormatter>) => f.relative(T - 180_000, T)],
  ['relative(t+2d)', (f: ReturnType<typeof createFormatter>) => f.relative(T + 48 * HOUR, T)],
] as const;

export const Locales: StoryObj = {
  name: 'en vs ru, UTC vs UTC+3',
  render: () => {
    const fmts = [
      ['en · UTC', createFormatter(en)],
      ['ru · UTC+3', createFormatter(ru, fixedOffsetZone(3))],
    ] as const;
    return (
      <table className="vl-data-table-fallback">
        <thead>
          <tr>
            <th>Call</th>
            {fmts.map(([n]) => (
              <th key={n}>{n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SAMPLES.map(([name, fn]) => (
            <tr key={name}>
              <th scope="row">
                <code>{name}</code>
              </th>
              {fmts.map(([n, f]) => (
                <td key={n}>{fn(f)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
};
