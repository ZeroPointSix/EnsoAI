import { vi } from 'vitest';

vi.mock('@/stores/settings', () => ({
  useSettingsStore: {
    getState: () => ({
      terminalScrollback: 10_000,
    }),
  },
}));
