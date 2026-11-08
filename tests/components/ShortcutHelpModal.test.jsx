import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/contexts/I18nContext', () => ({
  useI18n: () => ({ t: (_key, fallback) => fallback }),
}));

const { default: ShortcutHelpModal } = await import(
  '../../src/components/control-panel/ShortcutHelpModal.jsx'
);
const { SHORTCUT_GROUPS, ALL_SHORTCUTS, GLOBAL_SHORTCUTS } = await import(
  '../../src/constants/shortcuts.js'
);

describe('visibility', () => {
  test('renders nothing while closed', () => {
    const { container } = render(<ShortcutHelpModal open={false} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  test('renders as a dialog when open', () => {
    render(<ShortcutHelpModal open onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeDefined();
  });
});

describe('contents', () => {
  test('every documented shortcut is listed, so the list cannot go stale', () => {
    render(<ShortcutHelpModal open onClose={() => {}} />);

    for (const group of SHORTCUT_GROUPS) {
      expect(screen.getByText(group.titleFallback), `group ${group.id}`).toBeDefined();
    }
    for (const item of ALL_SHORTCUTS) {
      expect(screen.getByText(item.labelFallback), `item ${item.id}`).toBeDefined();
      for (const key of item.display) {
        // A key can appear in more than one row, so just require at least one.
        expect(screen.getAllByText(key).length, `key ${key}`).toBeGreaterThan(0);
      }
    }
  });

  test('blackout is described as a toggle, not a one-way action', () => {
    render(<ShortcutHelpModal open onClose={() => {}} />);
    expect(screen.getByText(/bring back what was on it/i)).toBeDefined();
  });

  test('it says shortcuts are suppressed while typing', () => {
    render(<ShortcutHelpModal open onClose={() => {}} />);
    expect(screen.getByText(/ignored while you are typing/i)).toBeDefined();
  });
});

describe('closing', () => {
  test('the Close button closes it', async () => {
    const onClose = vi.fn();
    render(<ShortcutHelpModal open onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('clicking the backdrop closes it', async () => {
    const onClose = vi.fn();
    const { container } = render(<ShortcutHelpModal open onClose={onClose} />);

    await userEvent.click(container.querySelector('.cp-modal-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('clicking inside the card does not close it', async () => {
    const onClose = vi.fn();
    const { container } = render(<ShortcutHelpModal open onClose={onClose} />);

    await userEvent.click(container.querySelector('.cp-modal-card'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('the shortcut definitions behind it', () => {
  test('only the two global shortcuts declare a key to listen for', () => {
    expect(GLOBAL_SHORTCUTS.map((item) => item.id).sort()).toEqual(['blackout', 'help']);
    // Everything bound globally must say which key, or the hook cannot match it.
    for (const item of GLOBAL_SHORTCUTS) {
      expect(typeof item.key, `${item.id} needs a key`).toBe('string');
      expect(item.key.length).toBeGreaterThan(0);
    }
  });

  test('every shortcut has something to show and something to say', () => {
    for (const item of ALL_SHORTCUTS) {
      expect(Array.isArray(item.display) && item.display.length > 0, item.id).toBe(true);
      expect(typeof item.labelKey, item.id).toBe('string');
      expect(typeof item.labelFallback, item.id).toBe('string');
    }
  });

  test('ids are unique, so the help list cannot render duplicate rows', () => {
    const ids = ALL_SHORTCUTS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
