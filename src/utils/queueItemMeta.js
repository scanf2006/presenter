export function getPayloadTypeFromItem(item) {
  return String(item?.payload?.type || item?.type || '').toLowerCase();
}

export function resolveSectionFromPayloadType(payloadType) {
  if (payloadType === 'text') return 'text';
  if (payloadType === 'bible') return 'bible';
  if (payloadType === 'song' || payloadType === 'lyrics') return 'songs';
  return 'media';
}

export function resolveSectionForPayload(payload) {
  const payloadType = String(payload?.type || '').toLowerCase();
  return resolveSectionFromPayloadType(payloadType);
}

export function resolveSectionForQueueItem(item) {
  const payloadType = getPayloadTypeFromItem(item);
  return resolveSectionFromPayloadType(payloadType);
}

export function getQueueTypeLabel(item) {
  const payloadType = getPayloadTypeFromItem(item);
  if (payloadType === 'song' || payloadType === 'lyrics') return 'SONG';
  if (payloadType === 'bible') return 'BIBLE';
  if (payloadType === 'text') return 'TEXT';
  if (payloadType === 'video') return 'VIDEO';
  if (payloadType === 'image') return 'IMAGE';
  if (payloadType === 'pdf') return 'PDF';
  if (payloadType === 'ppt') return 'PPT';
  if (payloadType === 'youtube') return 'YT';
  return 'MEDIA';
}

export function isSongQueueItem(item) {
  const payloadType = getPayloadTypeFromItem(item);
  return payloadType === 'song' || payloadType === 'lyrics';
}

export function isBibleQueueItem(item) {
  const payloadType = getPayloadTypeFromItem(item);
  return payloadType === 'bible';
}
