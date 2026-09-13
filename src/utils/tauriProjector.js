import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

export function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

export async function getTauriDisplays() {
  const displays = await invoke('get_displays');
  return displays.map(({ is_primary: isPrimary, ...display }) => ({
    ...display,
    isPrimary,
    bounds: { x: display.x, y: display.y, width: display.width, height: display.height },
    size: { width: display.width, height: display.height },
  }));
}

export const showTauriProjector = (displayId) => invoke('show_projector', { displayId: String(displayId) });
export const hideTauriProjector = () => invoke('hide_projector');
export const sendToTauriProjector = (payload) => invoke('send_to_projector', { payload });
export const sendTauriProjectorTransition = (payload) => invoke('send_projector_transition', { payload });
export const sendTauriProjectorMediaCommand = (payload) => invoke('send_projector_media_command', { payload });
export const exportTauriSetupBundle = (folder) => invoke('export_setup_bundle', { folder });
export const importTauriSetupBundle = (folder) => invoke('import_setup_bundle', { folder });
export const getTauriBibleBooks = (version) => invoke('bible_get_books', { version });
export const getTauriBibleVerses = (version, bookSn, chapter) =>
  invoke('bible_get_verses', { version, bookSn, chapter });
export const searchTauriBible = (version, keyword) =>
  invoke('bible_search', { version, keyword });
export const listTauriMedia = (filter) => invoke('get_media_list', { filter });
export const importTauriMedia = (filePaths) => invoke('import_media_files', { filePaths });
export const deleteTauriMedia = (filePath) => invoke('delete_media_file', { filePath });
export const convertTauriPpt = (pptPath) => invoke('convert_ppt', { pptPath });
export const listTauriSongs = () => invoke('songs_list');
export const saveTauriSong = (song) => invoke('songs_save', { song });
export const deleteTauriSong = (songId) => invoke('songs_delete', { songId });
export const minimizeTauriWindow = () => invoke('minimize_main_window');
export const toggleMaximizeTauriWindow = () => invoke('toggle_maximize_main_window');
export const closeTauriWindow = () => invoke('close_main_window');
export const downloadTauriYouTube = (inputUrl) => invoke('youtube_cache_download', { inputUrl });
export const loadTauriQueue = () => invoke('queue_load');
export const saveTauriQueue = (items) => invoke('queue_save', { items });
export function getMediaUrl(filePath) {
  if (!filePath || /^https?:\/\//i.test(filePath)) return filePath || '';
  return isTauriRuntime()
    ? convertFileSrc(filePath)
    : `local-media://${encodeURIComponent(filePath)}`;
}

const MEDIA_FILTERS = {
  image: [{ name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'] }],
  video: [{ name: 'Video Files', extensions: ['mp4', 'webm', 'mkv', 'avi', 'mov'] }],
  pdf: [{ name: 'PDF Files', extensions: ['pdf'] }],
  ppt: [{ name: 'PPT Files', extensions: ['pptx', 'ppt'] }],
};

export async function selectTauriMediaFiles(type) {
  const selected = await open({ multiple: true, filters: MEDIA_FILTERS[type] || Object.values(MEDIA_FILTERS).flat() });
  return Array.isArray(selected) ? selected.map(String) : selected ? [String(selected)] : [];
}
