import type { Decorator, Preview } from '@storybook/react';
import { type ReactNode, useEffect } from 'react';

import { VizProvider } from '../src/core';

import '../src/styles/index.css';
import '../src/charts/charts.css';
import '../src/table/table.css';
import '../src/dashboard/dashboard.css';
import './preview.css';

function ThemeRoot({ theme, locale, children }: { theme: string; locale: string; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset['vlTheme'] = theme;
    document.documentElement.lang = locale;
  }, [theme, locale]);
  return (
    <VizProvider locale={locale}>
      <div className="sb-vl-root" data-vl-theme={theme}>
        {children}
      </div>
    </VizProvider>
  );
}

const withTheme: Decorator = (Story, context) => (
  <ThemeRoot
    theme={(context.globals['theme'] as string | undefined) ?? 'light'}
    locale={(context.globals['locale'] as string | undefined) ?? 'en'}
  >
    <Story />
  </ThemeRoot>
);

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: 'Locale for number and date formatting',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: [
          { value: 'en', title: 'English' },
          { value: 'ru', title: 'Русский' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light', locale: 'en' },
  parameters: {
    layout: 'padded',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    viewport: {
      viewports: {
        phone: { name: 'Phone 390', styles: { width: '390px', height: '844px' }, type: 'mobile' },
        phoneSmall: { name: 'Phone 360', styles: { width: '360px', height: '740px' }, type: 'mobile' },
        tablet: { name: 'Tablet 820', styles: { width: '820px', height: '1180px' }, type: 'tablet' },
        desktop: { name: 'Desktop 1440', styles: { width: '1440px', height: '900px' }, type: 'desktop' },
      },
    },
    options: {
      storySort: { order: ['Introduction', 'Getting started', 'Guides', 'Recipes', 'Core', 'Charts', 'Table', 'Dashboard', 'Examples'] },
    },
    a11y: { test: 'todo' },
  },
};
export default preview;
