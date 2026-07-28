import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // The auto-blocker's whole job is turning an inert tag into one that runs,
    // so the tests need jsdom to actually execute revived scripts.
    environmentOptions: {
      jsdom: { runScripts: 'dangerously' },
    },
    include: ['tests/**/*.test.ts'],
    globals: false,
    restoreMocks: true,
  },
});
