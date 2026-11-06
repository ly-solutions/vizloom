import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { contrastRatio, readThemeColors, sampleRamp, sequentialRamp, divergingRamp, toHex, useThemeVersion } from '..';

const meta: Meta = { title: 'Core/Palette and tokens' };
export default meta;

export const Palettes: StoryObj = {
  name: 'Categorical, comparison, sequential, diverging',
  render: function Render() {
    const [el, setEl] = useState<HTMLDivElement | null>(null);
    useThemeVersion();
    const c = readThemeColors(el);
    const seq = sampleRamp(sequentialRamp(c.sequential[0], c.sequential[1]), 9);
    const div = sampleRamp(divergingRamp(c.diverging[0], c.diverging[1], c.diverging[2]), 9);
    return (
      <div ref={setEl} className="sb-stack">
        <h4>Categorical (contrast vs surface)</h4>
        <div className="sb-row">
          {c.categorical.map((col, i) => (
            <figure key={i} className="sb-chip-swatch">
              <svg viewBox="0 0 40 40" aria-hidden="true">
                <rect width="40" height="40" rx="8" fill={toHex(col)} />
              </svg>
              <figcaption>
                --vl-cat-{i + 1}
                <br />
                {contrastRatio(col, c.surface).toFixed(1)}:1
              </figcaption>
            </figure>
          ))}
        </div>
        <h4>Comparison</h4>
        <div className="sb-row">
          {c.compare.map((col, i) => (
            <svg key={i} viewBox="0 0 40 8" width="80" aria-hidden="true">
              <line x1="0" y1="4" x2="40" y2="4" stroke={toHex(col)} strokeWidth="2" strokeDasharray="4 3" />
            </svg>
          ))}
        </div>
        <h4>Sequential</h4>
        <div className="sb-ramp">
          {seq.map((col, i) => (
            <svg key={i} viewBox="0 0 10 10" aria-hidden="true">
              <rect width="10" height="10" fill={toHex(col)} />
            </svg>
          ))}
        </div>
        <h4>Diverging</h4>
        <div className="sb-ramp">
          {div.map((col, i) => (
            <svg key={i} viewBox="0 0 10 10" aria-hidden="true">
              <rect width="10" height="10" fill={toHex(col)} />
            </svg>
          ))}
        </div>
      </div>
    );
  },
};
