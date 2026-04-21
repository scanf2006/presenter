import { resolveSectionFromPayloadType } from './queueItemMeta';

export const CURRENT_QUEUE_SCHEMA_VERSION = 2;

function normalizeQueueItem(rawItem, index = 0) {
  const payload = rawItem?.payload && typeof rawItem.payload === 'object' ? rawItem.payload : {};
  const payloadType = String(payload.type || rawItem?.type || '').toLowerCase();
  const createdAt = Number.isFinite(rawItem?.createdAt) ? rawItem.createdAt : Date.now();
  const updatedAt = Number.isFinite(rawItem?.updatedAt) ? rawItem.updatedAt : undefined;

  return {
    id: String(rawItem?.id || `${createdAt}-${index}`),
    title: String(
      rawItem?.title || payload?.name || payload?.reference || payloadType || 'Untitled Content'
    ),
    type: payloadType || 'text',
    payload,
    section: String(rawItem?.section || resolveSectionFromPayloadType(payloadType)),
    createdAt,
    ...(updatedAt ? { updatedAt } : {}),
  };
}

export function migrateQueuePayload(raw) {
  // V1 legacy: raw array.
  if (Array.isArray(raw)) {
    return {
      schemaVersion: CURRENT_QUEUE_SCHEMA_VERSION,
      items: raw.map((item, index) => normalizeQueueItem(item, index)),
    };
  }

  // V2+ envelope.
  if (raw && typeof raw === 'object' && Array.isArray(raw.items)) {
    return {
      schemaVersion: CURRENT_QUEUE_SCHEMA_VERSION,
      items: raw.items.map((item, index) => normalizeQueueItem(item, index)),
    };
  }

  return {
    schemaVersion: CURRENT_QUEUE_SCHEMA_VERSION,
    items: [],
  };
}

export function buildQueueEnvelope(items) {
  return {
    schemaVersion: CURRENT_QUEUE_SCHEMA_VERSION,
    items: Array.isArray(items) ? items.map((item, index) => normalizeQueueItem(item, index)) : [],
  };
}
