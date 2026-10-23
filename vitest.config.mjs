// Component tests. The project had no renderer at all, which is why splitting
// the large components, moving to React 19 and verifying PDF rendering were all
// blocked: a broken render could not be caught by anything.
//
// This runs alongside the existing `node:test` suite rather than replacing it.
// That suite covers pure logic and needs no DOM, and migrating 62 working tests
// would be churn for its own sake. The two are separated by extension:
// `*.test.js` belongs to node:test, `*.test.jsx` to vitest.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.jsx'],
    // Keep the DOM and any module mocks from leaking between tests.
    restoreMocks: true,
    clearMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    setupFiles: ['tests/setup/component-tests.js'],
  },
});
