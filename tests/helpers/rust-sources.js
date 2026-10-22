// Reads the Rust sources without hard-coding which module a thing lives in.
// Guards that named a specific file (lib.rs) broke as soon as that file was
// split into modules, even though nothing they guard had changed.
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.resolve(__dirname, '..', '..', 'src-tauri', 'src');

const files = () =>
  fs
    .readdirSync(DIR)
    .filter((name) => name.endsWith('.rs'))
    .sort()
    .map((name) => ({ name, text: fs.readFileSync(path.join(DIR, name), 'utf8') }));

const matches = (text, needle) =>
  needle instanceof RegExp ? needle.test(text) : text.includes(needle);

/** Every Rust source joined, for "does this exist anywhere" checks. */
function allRust() {
  return files()
    .map((file) => file.text)
    .join('\n');
}

/**
 * The one source file holding `needle`, so a check can look at the code around
 * it. Returns '' when nothing matches, which lets a test report its own
 * message instead of a read error.
 */
function rustContaining(needle) {
  return files().find((file) => matches(file.text, needle))?.text ?? '';
}

/** Which file holds `needle`, for assertion messages. */
function rustFileContaining(needle) {
  return files().find((file) => matches(file.text, needle))?.name ?? null;
}

module.exports = { allRust, rustContaining, rustFileContaining };
