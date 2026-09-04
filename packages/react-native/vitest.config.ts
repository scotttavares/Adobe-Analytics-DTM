import { defineConfig } from 'vitest/config';

// Only the platform-agnostic plumbing is unit-tested here (adapter, storage,
// wiring) — it imports no react-native, so it runs in plain Node. The UI
// components (.tsx) need a device/simulator and are verified there, not in CI.
export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
