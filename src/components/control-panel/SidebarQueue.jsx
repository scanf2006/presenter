import React, { useRef, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useQueueContext } from '../../contexts/QueueContext';
import { useI18n } from '../../contexts/I18nContext';
import { getQueueTypeLabel } from '../../utils/queueItemMeta';

function NavIcon({ type }) {
  const common = {
    width: '15',
    height: '15',
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.6',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  if (type === 'displays') {
    return (
      <svg {...common}>
        <rect x="2.5" y="3" width="11" height="7.5" rx="1.2" />
        <path d="M6.2 13h3.6M8 10.5V13" />
      </svg>
    );
  }
  if (type === 'text') {
    return (
      <svg {...common}>
        <path d="M3 4h10M8 4v8M5.2 12h5.6" />
      </svg>
    );
  }
  if (type === 'songs') {
    return (
      <svg {...common}>
        <path d="M6 3.5v7.2a1.8 1.8 0 1 1-1-1.6V5.1l6-1.4v6.3a1.8 1.8 0 1 1-1-1.6V3.5z" />
      </svg>
    );
  }
  if (type === 'bible') {
    return (
      <svg {...common}>
        <path d="M3 3.5h4.5a2 2 0 0 1 2 2V13H5a2 2 0 0 1-2-2z" />
        <path d="M13 3.5H8.5a2 2 0 0 0-2 2V13H11a2 2 0 0 0 2-2z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2.5" y="4" width="11" height="8.5" rx="1.4" />
      <path d="M2.8 6.2l4.2 3 2.2-1.7 3 2.3" />
    </svg>
  );
}

function SidebarQueue({ openDisplays, openText, openSongs, openBible, openMedia }) {
  const { t, locale } = useI18n();
  const useChineseMenu = String(locale || 'en').toLowerCase().startsWith('zh');
  const [dropHint, setDropHint] = useState({ index: -1, position: 'before' });
  const queueListRef = useRef(null);
  const draggingQueueIdRef = useRef('');
  const { activeSection } = useAppContext();
  const {
    projectorQueue,
    activeQueueIndex,
    draggingQueueId,
    setDraggingQueueId,
    editingQueueId,
    editingQueueTitle,
    setEditingQueueTitle,
    moveQueueItemByIndex,
    commitRenameSelectedQueueItem,
    cancelRenameSelectedQueueItem,
    playQueueItem,
    startRenameSelectedQueueItem,
    removeSelectedQueueItem,
    clearAllQueueItems,
    showQueueTypeTags,
    setShowQueueTypeTags,
  } = useQueueContext();

  const getDisplayTitle = (rawTitle) =>
    String(rawTitle || '')
      .replace(/^\s*Song:\s*/i, '')
      .replace(/^\s*[📖]\s*/u, '')
      .trim();

  const navItems = [
    {
      key: 'displays',
      label: useChineseMenu ? t('sidebar.displays', 'Displays') : 'Displays',
      onClick: openDisplays,
    },
    {
      key: 'text',
      label: useChineseMenu ? t('sidebar.text', 'Free Text') : 'Free Text',
      onClick: openText,
    },
    { key: 'songs', label: useChineseMenu ? t('sidebar.songs', 'Songs') : 'Songs', onClick: openSongs },
    { key: 'bible', label: useChineseMenu ? t('sidebar.bible', 'Bible') : 'Bible', onClick: openBible },
    { key: 'media', label: useChineseMenu ? t('sidebar.media', 'Media') : 'Media', onClick: openMedia },
  ];

  const resolveDropTargetIndex = (fromIndex, targetIndex, position) => {
    const insertionSlot = position === 'after' ? targetIndex + 1 : targetIndex;
    const adjusted = insertionSlot > fromIndex ? insertionSlot - 1 : insertionSlot;
    const maxIndex = Math.max(0, projectorQueue.length - 1);
    return Math.max(0, Math.min(maxIndex, adjusted));
  };

  const autoScrollQueueList = (clientY) => {
    const listEl = queueListRef.current;
    if (!listEl) return;
    const rect = listEl.getBoundingClientRect();
    const edge = 34;
    const step = 16;
    if (clientY - rect.top < edge) {
      listEl.scrollTop -= step;
      return;
    }
    if (rect.bottom - clientY < edge) {
      listEl.scrollTop += step;
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-nav">
        <div className="sidebar-nav-card">
          <div className="sidebar__section-title">
            {useChineseMenu ? t('sidebar.mainMenu', 'Main Menu') : 'Main Menu'}
          </div>
          {navItems.map((item) => {
            const isActive = activeSection === item.key;
            return (
              <button
                key={item.key}
                className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
                onClick={item.onClick}
              >
                <span className="sidebar__item-core">
                  <span className="sidebar__item-icon"><NavIcon type={item.key} /></span>
                  <span className="sidebar__item-text">
                    <span className="sidebar__item-label">{item.label}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sidebar-playlist">
        <div className="cp-queue-head">
          <div className="sidebar__section-title sidebar__section-title--flush-top">
            {useChineseMenu ? t('sidebar.queue', 'Queue') : 'Queue'}
          </div>
          <button
            className="btn btn--ghost cp-queue-head-btn"
            onClick={() => setShowQueueTypeTags((v) => !v)}
            title={
              showQueueTypeTags
                ? useChineseMenu
                  ? t('sidebar.hideQueueTypeTags', 'Hide queue type tags')
                  : 'Hide queue type tags'
                : useChineseMenu
                  ? t('sidebar.showQueueTypeTags', 'Show queue type tags')
                  : 'Show queue type tags'
            }
          >
            {showQueueTypeTags
              ? useChineseMenu
                ? t('sidebar.hideTags', 'Hide Tags')
                : 'Hide Tags'
              : useChineseMenu
                ? t('sidebar.showTags', 'Show Tags')
                : 'Show Tags'}
          </button>
        </div>
        <div
          ref={queueListRef}
          className="cp-queue-list"
        >
          {projectorQueue.length === 0 && (
            <div className="cp-queue-empty">
              {useChineseMenu
                ? t('sidebar.queueEmpty', 'Add items from Media or Free Text.')
                : 'Add items from Media or Free Text.'}
            </div>
          )}
          {projectorQueue.map((item, index) => (
            <div
              key={item.id}
              data-queue-id={item.id}
              className={`cp-queue-card ${index === activeQueueIndex ? 'cp-queue-card--active' : ''} ${draggingQueueId === item.id ? 'cp-queue-card--dragging' : ''} ${dropHint.index === index && dropHint.position === 'before' ? 'cp-queue-card--drop-before' : ''} ${dropHint.index === index && dropHint.position === 'after' ? 'cp-queue-card--drop-after' : ''}`}
            >
              <div className="cp-queue-row">
                <span
                  title={useChineseMenu ? '按住并拖动排序' : 'Hold and drag to reorder'}
                  className="cp-queue-drag"
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    setDraggingQueueId(item.id);
                    draggingQueueIdRef.current = item.id;
                  }}
                  onPointerMove={(e) => {
                    if (draggingQueueIdRef.current !== item.id) return;
                    autoScrollQueueList(e.clientY);
                    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-queue-id]');
                    const targetId = target?.getAttribute('data-queue-id');
                    const targetIndex = projectorQueue.findIndex((queueItem) => queueItem.id === targetId);
                    if (targetIndex < 0 || targetId === item.id) return;
                    const rect = target.getBoundingClientRect();
                    setDropHint({ index: targetIndex, position: e.clientY - rect.top > rect.height / 2 ? 'after' : 'before' });
                  }}
                  onPointerUp={(e) => {
                    if (draggingQueueIdRef.current !== item.id) return;
                    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-queue-id]');
                    const targetId = target?.getAttribute('data-queue-id');
                    const targetIndex = projectorQueue.findIndex((queueItem) => queueItem.id === targetId);
                    if (targetIndex >= 0 && targetId !== item.id) {
                      const rect = target.getBoundingClientRect();
                      const position = e.clientY - rect.top > rect.height / 2 ? 'after' : 'before';
                      moveQueueItemByIndex(index, resolveDropTargetIndex(index, targetIndex, position));
                    }
                    setDraggingQueueId(null);
                    draggingQueueIdRef.current = '';
                    setDropHint({ index: -1, position: 'before' });
                  }}
                  onPointerCancel={() => {
                    setDraggingQueueId(null);
                    draggingQueueIdRef.current = '';
                    setDropHint({ index: -1, position: 'before' });
                  }}
                >
                  ::
                </span>
                <span className="cp-queue-index">{index + 1}.</span>
                {showQueueTypeTags && (
                  <span className="cp-queue-type">{getQueueTypeLabel(item)}</span>
                )}
                {editingQueueId === item.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={editingQueueTitle}
                    onChange={(e) => setEditingQueueTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRenameSelectedQueueItem();
                      if (e.key === 'Escape') cancelRenameSelectedQueueItem();
                    }}
                    onBlur={commitRenameSelectedQueueItem}
                    className="cp-queue-input"
                  />
                ) : (
                  <span
                    onClick={() => playQueueItem(index)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startRenameSelectedQueueItem(item);
                    }}
                    className="cp-queue-title"
                    title={t('sidebar.queueClickRenameHint', 'Click to project; double-click to rename')}
                  >
                    {getDisplayTitle(item.title)}
                  </span>
                )}
                {editingQueueId !== item.id && (
                  <button
                    className="btn btn--ghost cp-queue-edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      startRenameSelectedQueueItem(item);
                    }}
                    title={t('sidebar.renameCard', 'Rename card')}
                  >
                    {useChineseMenu ? t('sidebar.edit', 'Edit') : 'Edit'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="cp-queue-actions">
          <button
            className="btn btn--ghost cp-queue-btn-full cp-queue-btn-danger"
            onClick={removeSelectedQueueItem}
            disabled={activeQueueIndex < 0 || activeQueueIndex >= projectorQueue.length}
            title={
              useChineseMenu
                ? t('sidebar.deleteSelectedQueueCard', 'Delete selected queue card')
                : 'Delete selected queue card'
            }
          >
            {useChineseMenu ? t('sidebar.delSelected', 'Del Selected') : 'Del Selected'}
          </button>
          <button
            className="btn btn--ghost cp-queue-btn-full"
            onClick={clearAllQueueItems}
            disabled={projectorQueue.length === 0}
          >
            {useChineseMenu ? t('sidebar.clearQueue', 'Clear Queue') : 'Clear Queue'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SidebarQueue;
