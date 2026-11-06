import type { Meta, StoryObj } from '@storybook/react';

import { AudiencePage, CheckInPage, HomePage, MarketingPage, MoneyPage, SalesPage, TicketTypesPage } from './pages';

const meta: Meta = {
  title: 'Examples/Dashboards',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Complete dashboards on fictional data, built only from the public API.' } },
  },
  decorators: [
    (Story) => (
      <div className="sb-example">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj;

export const Home: Story = { render: () => <HomePage /> };
export const Sales: Story = { render: () => <SalesPage /> };
export const TicketTypes: Story = { name: 'Ticket types', render: () => <TicketTypesPage /> };
export const Audience: Story = { render: () => <AudiencePage /> };
export const Marketing: Story = { render: () => <MarketingPage /> };
export const Money: Story = { render: () => <MoneyPage /> };
export const CheckIn: Story = { name: 'Check-in', render: () => <CheckInPage /> };

const phone = { viewport: { defaultViewport: 'phone' } };
export const HomePhone: Story = { name: 'Home — phone', parameters: phone, render: () => <HomePage /> };
export const SalesPhone: Story = { name: 'Sales — phone', parameters: phone, render: () => <SalesPage /> };
export const CheckInPhone: Story = { name: 'Check-in — phone', parameters: phone, render: () => <CheckInPage /> };
