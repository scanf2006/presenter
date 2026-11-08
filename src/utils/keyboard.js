// Shared keyboard helpers.
//
// Every global key handler in the app has to answer the same question first:
// is the operator typing? Without that check, searching for a hymn would
// advance slides on screen while the letters are being entered. The check was
// written out separately in each handler; it lives here now so a new handler
// cannot forget it and so it can be tested on its own.

/**
 * True when the event target is somewhere the operator is entering text, so a
 * global shortcut must stay out of the way.
 */
export function isTypingTarget(target) {
  if (!target) return false;
  // Cross-realm safety: an element from another document fails `instanceof`,
  // so fall back to the shape instead of waving the event through.
  const tag = String(target.tagName || '').toLowerCase();
  if (!tag) return false;
  if (target.isContentEditable) return true;
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

/**
 * True when the event carries a modifier that means it belongs to the system or
 * to a different shortcut. Single-letter shortcuts must ignore these, or Ctrl+B
 * in a text field would reach them.
 */
export function hasModifier(event) {
  return Boolean(event?.ctrlKey || event?.metaKey || event?.altKey);
}

/** Stops an event from reaching anything else, including other key handlers. */
export function consumeKeyEvent(event) {
  if (!event) return;
  if (typeof event.preventDefault === 'function') event.preventDefault();
  if (typeof event.stopPropagation === 'function') event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
}

export default isTypingTarget;
