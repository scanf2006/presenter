export function getPayloadTypeFromItem(item) {
  // Some historical queue entries persisted type at item level, newer ones in payload.type.
  return String(item?.payload?.type || item?.type || '').toLowerCase();
}

export function getQueueItemTitleFromPayload(payload) {
  if (!payload) return 'Untitled Content';
  if (payload.type === 'text') return payload.text?.split('\n')?.[0]?.slice(0, 24) || 'Free Text';
  if (payload.type === 'lyrics')
    return payload.text?.split('\n')?.[0]?.slice(0, 24) || 'Lyrics Section';
  if (payload.type === 'bible') return payload.reference || 'Bible';
  if (payload.type === 'song') return payload.songTitle || 'Song';
  if (payload.type === 'image' || payload.type === 'video' || payload.type === 'pdf')
    return payload.name || 'Media';
  return payload.name || payload.type || 'Untitled Content';
}

export function resolveSectionFromPayloadType(payloadType) {
  // Keep this mapping as the single source of truth for sidebar section routing.
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
  // Compact labels are used in dense queue cards where width is limited.
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
