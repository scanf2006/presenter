const CURRENT_QUEUE_SCHEMA_VERSION = 2;

function resolveSectionFromPayloadType(type) {
  if (type === 'text') return 'text';
  if (type === 'bible') return 'bible';
  if (type === 'song' || type === 'lyrics') return 'songs';
  return 'media';
}

function normalizeQueueItem(rawItem, index) {
  const payload = rawItem?.payload && typeof rawItem.payload === 'object' ? rawItem.payload : {};
  const type = String(payload.type || rawItem?.type || '').toLowerCase();
  const createdAt = Number.isFinite(rawItem?.createdAt) ? rawItem.createdAt : Date.now();
  return {
    id: String(rawItem?.id || `${createdAt}-${index}`),
    title: String(rawItem?.title || payload.name || payload.reference || type || 'Untitled Content'),
    type: type || 'text', payload, section: String(rawItem?.section || resolveSectionFromPayloadType(type)), createdAt,
    ...(Number.isFinite(rawItem?.updatedAt) ? { updatedAt: rawItem.updatedAt } : {}),
  };
}

export function migrateQueuePayload(raw) {
  const items = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : null;
  return { schemaVersion: CURRENT_QUEUE_SCHEMA_VERSION, items: items ? items.map(normalizeQueueItem) : [] };
}

export function buildQueueEnvelope(items) {
  return { schemaVersion: CURRENT_QUEUE_SCHEMA_VERSION, items: Array.isArray(items) ? items.map(normalizeQueueItem) : [] };
}
