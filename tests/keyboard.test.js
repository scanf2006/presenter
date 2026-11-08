const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../src/utils/keyboard.js');

const target = (tagName, extra = {}) => ({ tagName, ...extra });

test('typing in a form control suppresses global shortcuts', async () => {
  const { isTypingTarget } = await load();

  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT', 'input', 'textarea', 'select']) {
    assert.equal(isTypingTarget(target(tag)), true, `${tag} should count as typing`);
  }
  assert.equal(isTypingTarget(target('DIV', { isContentEditable: true })), true);
});

test('ordinary elements do not suppress shortcuts', async () => {
  const { isTypingTarget } = await load();

  for (const tag of ['DIV', 'BUTTON', 'BODY', 'SPAN', 'A']) {
    assert.equal(isTypingTarget(target(tag)), false, `${tag} should not count as typing`);
  }
  assert.equal(isTypingTarget(target('DIV', { isContentEditable: false })), false);
});

test('a missing or shapeless target is handled without throwing', async () => {
  const { isTypingTarget } = await load();

  assert.equal(isTypingTarget(null), false);
  assert.equal(isTypingTarget(undefined), false);
  // The document itself has no tagName; a shortcut should still work.
  assert.equal(isTypingTarget({}), false);
  assert.equal(isTypingTarget(target('')), false);
});

test('modifier keys are recognised so letter shortcuts can stay out of the way', async () => {
  const { hasModifier } = await load();

  assert.equal(hasModifier({ ctrlKey: true }), true);
  assert.equal(hasModifier({ metaKey: true }), true);
  assert.equal(hasModifier({ altKey: true }), true);
  // Shift alone is not a modifier for this purpose: "?" needs it.
  assert.equal(hasModifier({ shiftKey: true }), false);
  assert.equal(hasModifier({}), false);
  assert.equal(hasModifier(null), false);
});

test('consuming an event stops every propagation path', async () => {
  const { consumeKeyEvent } = await load();
  const calls = [];
  consumeKeyEvent({
    preventDefault: () => calls.push('preventDefault'),
    stopPropagation: () => calls.push('stopPropagation'),
    stopImmediatePropagation: () => calls.push('stopImmediatePropagation'),
  });
  assert.deepEqual(calls.sort(), [
    'preventDefault',
    'stopImmediatePropagation',
    'stopPropagation',
  ]);
});

test('consuming tolerates an event missing the optional methods', async () => {
  const { consumeKeyEvent } = await load();
  // stopImmediatePropagation does not exist on a React synthetic event.
  assert.doesNotThrow(() => consumeKeyEvent({ preventDefault() {}, stopPropagation() {} }));
  assert.doesNotThrow(() => consumeKeyEvent({}));
  assert.doesNotThrow(() => consumeKeyEvent(null));
});
