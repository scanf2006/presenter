import { useEffect } from 'react';
import { consumeKeyEvent, hasModifier, isTypingTarget } from '../utils/keyboard';
import { GLOBAL_SHORTCUTS } from '../constants/shortcuts';

/**
 * Binds the shortcuts that must work from anywhere in the app.
 *
 * Only two are bound here, and the restraint is deliberate. Blackout is the one
 * action that has to be instant: when the wrong thing is on the screen in front
 * of a congregation, reaching for the mouse is too slow. The help key makes the
 * rest discoverable.
 *
 * Starting and stopping projection is deliberately NOT bound. A mis-keyed
 * projector stop in the middle of a service costs far more than the few seconds
 * a shortcut would save, and the button is right there.
 */
export default function useGlobalShortcuts({ onBlackout, onShowHelp, enabled = true }) {
  useEffect(() => {
    if (!enabled) return;

    const handlers = {
      blackout: onBlackout,
      help: onShowHelp,
    };

    const onKeyDown = (event) => {
      // Never while the operator is typing, and never when a modifier means the
      // key belongs to something else.
      if (isTypingTarget(event.target)) return;
      if (hasModifier(event)) return;

      const pressed = String(event.key || '');
      const match = GLOBAL_SHORTCUTS.find(
        (shortcut) => shortcut.key && shortcut.key.toLowerCase() === pressed.toLowerCase()
      );
      if (!match) return;

      const handler = handlers[match.id];
      if (typeof handler !== 'function') return;

      consumeKeyEvent(event);
      handler();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, onBlackout, onShowHelp]);
}
