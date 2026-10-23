// The UI ships in English and Simplified Chinese. A key added to one locale
// and forgotten in the other falls back to a raw key or the wrong language on
// screen, and nothing in the build or the lint catches it. The two locales were
// in perfect parity when this was written (219 keys each); this keeps them that
// way as features are added.
const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../src/i18n/messages.js');

const LOCALES = ['en', 'zh-CN'];

/** Every leaf path in a nested message object, e.g. "songs.importFailed". */
function leafKeys(node, prefix = '') {
  return Object.entries(node).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? leafKeys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  );
}

test('both locales exist and carry the same keys', async () => {
  const { messages } = await load();

  for (const locale of LOCALES) {
    assert.ok(messages[locale], `${locale} should be present`);
  }

  const [en, zh] = LOCALES.map((locale) => new Set(leafKeys(messages[locale])));
  const missingInZh = [...en].filter((key) => !zh.has(key)).sort();
  const missingInEn = [...zh].filter((key) => !en.has(key)).sort();

  assert.deepEqual(missingInZh, [], 'keys present in en but missing in zh-CN');
  assert.deepEqual(missingInEn, [], 'keys present in zh-CN but missing in en');
});

test('no message is left empty or still holding its English text in zh-CN', async () => {
  const { messages } = await load();
  const blank = [];

  for (const locale of LOCALES) {
    for (const key of leafKeys(messages[locale])) {
      const value = key.split('.').reduce((node, part) => node[part], messages[locale]);
      if (typeof value === 'string' && value.trim() === '') blank.push(`${locale}:${key}`);
    }
  }
  assert.deepEqual(blank, [], 'these messages are blank');
});

test('every leaf is a string, so nothing renders as an object', async () => {
  const { messages } = await load();

  for (const locale of LOCALES) {
    for (const key of leafKeys(messages[locale])) {
      const value = key.split('.').reduce((node, part) => node[part], messages[locale]);
      assert.equal(typeof value, 'string', `${locale}:${key} should be a string`);
    }
  }
});

test('resolveLocale maps what the app passes it', async () => {
  const { resolveLocale } = await load();

  assert.equal(resolveLocale('zh-CN'), 'zh-CN');
  assert.equal(resolveLocale('zh'), 'zh-CN', 'any Chinese tag should reach the zh-CN bundle');
  assert.equal(resolveLocale('zh-TW'), 'zh-CN');
  assert.equal(resolveLocale('en-US'), 'en');
  // An absent or unusable value must still produce a usable bundle.
  assert.equal(resolveLocale(''), 'en');
  assert.equal(resolveLocale(undefined), 'en');
  assert.equal(resolveLocale(null), 'en');
});
