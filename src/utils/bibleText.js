export function normalizeBibleLine(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .replace(/\u00A0/g, ' ')
    .replace(/\u3000/g, ' ')
    .replace(/^[\s\t]+/g, '')
    .replace(/[\s\t]+$/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function normalizeBibleText(rawText) {
  if (rawText === null || rawText === undefined) return '';
  return String(rawText)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => normalizeBibleLine(line))
    .filter((line, idx, arr) => {
      // Collapse repeated empty lines while keeping intentional verse breaks.
      if (line !== '') return true;
      return idx > 0 && arr[idx - 1] !== '';
    })
    .join('\n')
    .trim();
}
