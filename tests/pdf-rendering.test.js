// Verifies the bundled PDF.js can actually open a PDF, rather than only that
// the package is installed. PDF.js was upgraded across a major version to clear
// GHSA-hq66-cqwq-w95j (arbitrary script execution from a malicious PDF), and
// the app loads the `legacy` build by dynamic import, so this test exercises
// that exact entry point and the API the components call.
const test = require('node:test');
const assert = require('node:assert/strict');

// A minimal one-page PDF drawing the word CDPTEST, built here so the test
// depends on no fixture file.
const SAMPLE_PDF = [
  '%PDF-1.4',
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R' +
    '/Resources<</Font<</F1 5 0 R>>>>>>endobj',
  '4 0 obj<</Length 47>>stream',
  'BT /F1 24 Tf 20 100 Td (CDPTEST) Tj ET',
  'endstream',
  'endobj',
  '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
  'trailer<</Root 1 0 R/Size 6>>',
  '%%EOF',
].join('\n');

const loadPdfjs = () => import('pdfjs-dist/legacy/build/pdf.min.mjs');
const loadCloser = () => import('../src/utils/pdfDocument.js');

const openSample = async (pdfjsLib) => {
  const task = pdfjsLib.getDocument({
    data: new Uint8Array(Buffer.from(SAMPLE_PDF, 'latin1')),
    // Node has no worker and no DOM; the components supply a worker URL in the
    // app. Parsing is what this test covers.
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  return task.promise;
};

test('the legacy build the app imports still exposes the API the components use', async () => {
  const pdfjsLib = await loadPdfjs();

  assert.equal(typeof pdfjsLib.getDocument, 'function');
  assert.ok(pdfjsLib.GlobalWorkerOptions, 'components set GlobalWorkerOptions.workerSrc');
  assert.equal(typeof pdfjsLib.version, 'string');
});

test('a PDF opens and reports its page count', async () => {
  const pdfjsLib = await loadPdfjs();
  const pdf = await openSample(pdfjsLib);

  try {
    assert.equal(pdf.numPages, 1);
    const page = await pdf.getPage(1);
    // PdfRenderer and PdfThumbnail both size their canvas from a viewport.
    const viewport = page.getViewport({ scale: 1 });
    assert.equal(Math.round(viewport.width), 300);
    assert.equal(Math.round(viewport.height), 200);
  } finally {
    await (await loadCloser()).closePdfDocument(pdf);
  }
});

test('page content is decoded, so a rendered page would not come out blank', async () => {
  const pdfjsLib = await loadPdfjs();
  const pdf = await openSample(pdfjsLib);

  try {
    const page = await pdf.getPage(1);
    const text = (await page.getTextContent()).items.map((item) => item.str).join('');
    assert.match(text, /CDPTEST/);
  } finally {
    await (await loadCloser()).closePdfDocument(pdf);
  }
});

test('a damaged PDF is rejected instead of hanging or passing silently', async () => {
  const pdfjsLib = await loadPdfjs();

  await assert.rejects(
    pdfjsLib.getDocument({ data: new Uint8Array(Buffer.from('not a pdf at all', 'latin1')) })
      .promise
  );
});

test('the toHex polyfill the app installs for its WebView stays harmless here', () => {
  // main.jsx adds Uint8Array.prototype.toHex for the desktop WebView. If a
  // future PDF.js ships its own, the app's version must still agree with it.
  const bytes = new Uint8Array([0, 15, 16, 255]);
  const polyfill = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  assert.equal(polyfill, '000f10ff');
  if (typeof bytes.toHex === 'function') {
    assert.equal(bytes.toHex(), polyfill, 'native toHex should match the polyfill');
  }
});

test('closePdfDocument really releases a document from this PDF.js version', async () => {
  // The upgrade moved destroy() off the document proxy, which broke eight call
  // sites at runtime. This asserts the helper works against the installed
  // library rather than against an assumed shape.
  const pdfjsLib = await loadPdfjs();
  const { closePdfDocument } = await loadCloser();
  const pdf = await openSample(pdfjsLib);

  assert.equal(typeof pdf.destroy, 'undefined', 'document proxies no longer expose destroy()');
  await closePdfDocument(pdf);

  // Once released, using the document must fail rather than quietly work on a
  // torn-down worker. PDF.js throws synchronously here, so accept either shape.
  let failed = false;
  try {
    await pdf.getPage(1);
  } catch {
    failed = true;
  }
  assert.equal(failed, true, 'the worker should be gone after closing');
});

test('closePdfDocument is safe when there is nothing to close', async () => {
  const { closePdfDocument } = await loadCloser();

  await closePdfDocument(null);
  await closePdfDocument(undefined);
  await closePdfDocument({});
  // Closing twice happens when an unmount races a reload.
  const noisy = {
    loadingTask: {
      destroy() {
        throw new Error('already gone');
      },
    },
  };
  await closePdfDocument(noisy);
});

test('closePdfDocument still works with the older 5.x document shape', async () => {
  const { closePdfDocument } = await loadCloser();
  let closed = false;
  await closePdfDocument({
    destroy() {
      closed = true;
      return Promise.resolve();
    },
  });
  assert.equal(closed, true);
});
