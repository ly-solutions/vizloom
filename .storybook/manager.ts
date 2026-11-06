import { addons } from 'storybook/internal/manager-api';
import { create } from 'storybook/internal/theming/create';

addons.setConfig({ theme: create({ base: 'light', brandTitle: 'vizloom', brandUrl: 'https://github.com/ly-solutions/vizloom' }) });
