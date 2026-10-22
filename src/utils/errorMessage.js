// Tauri rejects an invoke with the plain string a Rust command returned in `Err`,
// not with an Error object. Reading `.message` alone therefore discards the
// backend's own wording -- "Trial expired. Please activate license to continue
// projection." becomes "Unknown error" exactly when the operator needs to read it.
export function describeError(error, fallback = 'Unknown error') {
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
  return fallback;
}

export default describeError;
