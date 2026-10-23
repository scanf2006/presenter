// Closing a PDF document moved between PDF.js major versions: up to 5.x the
// document proxy had `destroy()`, from 6.x it only has `cleanup()` and the
// `destroy()` lives on the loading task that produced it. The app opened and
// closed documents in several places, so every one of them broke on the
// upgrade with "destroy is not a function". This keeps that difference in one
// place and tolerates either shape.

/**
 * Releases a PDF document and its worker. Safe to call with null, twice, or
 * with a document whose worker is already gone: it never throws and always
 * returns a promise, so callers can ignore the result.
 */
export function closePdfDocument(pdfDocument) {
  if (!pdfDocument) return Promise.resolve();
  try {
    const task = pdfDocument.loadingTask;
    if (task && typeof task.destroy === 'function') {
      return Promise.resolve(task.destroy()).catch(() => {});
    }
    if (typeof pdfDocument.destroy === 'function') {
      return Promise.resolve(pdfDocument.destroy()).catch(() => {});
    }
    if (typeof pdfDocument.cleanup === 'function') {
      return Promise.resolve(pdfDocument.cleanup()).catch(() => {});
    }
  } catch {
    // A document torn down by a previous call is already in the state we want.
  }
  return Promise.resolve();
}

export default closePdfDocument;
