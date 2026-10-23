// Shared setup for the vitest component tests.
//
// Testing Library only registers its automatic cleanup when the test framework
// exposes `afterEach` as a global. This project runs vitest without globals, so
// cleanup is wired up explicitly here — otherwise each test would render into a
// DOM still holding the previous test's markup, and queries would match the
// wrong element.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
