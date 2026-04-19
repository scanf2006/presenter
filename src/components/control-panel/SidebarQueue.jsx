import React, { useRef, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useQueueContext } from '../../contexts/QueueContext';
import { getQueueTypeLabel } from '../../utils/queueItemMeta';

function SidebarQueue({ openDisplays, openText, openSongs, openBible, openMedia }) {
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
    { key: 'displays', icon: 'D', label: 'Displays', hint: 'Screen output', onClick: openDisplays },
    { key: 'text', icon: 'T', label: 'Free Text', hint: 'Custom words', onClick: openText },
    { key: 'songs', icon: 'S', label: 'Songs', hint: 'Lyrics cards', onClick: openSongs },
    { key: 'bible', icon: 'B', label: 'Bible', hint: 'Verses and refs', onClick: openBible },
    { key: 'media', icon: 'M', label: 'Media', hint: 'Image/Video/PDF/PPT', onClick: openMedia },
  ];

  const resolveDropTargetIndex = (fromIndex, targetIndex, position) => {
    const insertionSlot = position === 'after' ? targetIndex + 1 : targetIndex;
    const adjusted = insertionSlot > fromIndex ? insertionSlot - 1 : insertionSlot;
    const maxIndex = Math.max(0, projectorQueue.length - 1);
    return Math.max(0, Math.min(maxIndex, adjusted));
  };

  const readDraggingId = (event) => {
    const transferId =
      event?.dataTransfer?.getData('application/x-cdp-queue-id') ||
      event?.dataTransfer?.getData('text/plain') ||
      '';
    return transferId || draggingQueueIdRef.current || draggingQueueId || '';
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
          <div className="sidebar__section-title">Main Menu</div>
          {navItems.map((item) => {
            const isActive = activeSection === item.key;
            return (
              <button
                key={item.key}
                className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
                onClick={item.onClick}
              >
                <span className="sidebar__item-icon">{item.icon}</span>
                <span className="sidebar__item-text">
                  <span className="sidebar__item-label">{item.label}</span>
                  <span className="sidebar__item-hint">{item.hint}</span>
                </span>
                <span
                  className={`sidebar__item-dot ${isActive ? 'sidebar__item-dot--active' : ''}`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="sidebar-playlist">
        <div className="cp-queue-head">
          <div className="sidebar__section-title" style={{ paddingTop: 0 }}>
            Queue
          </div>
          <button
            className="btn btn--ghost cp-queue-head-btn"
            onClick={() => setShowQueueTypeTags((v) => !v)}
            title={showQueueTypeTags ? 'Hide queue type tags' : 'Show queue type tags'}
          >
            {showQueueTypeTags ? 'Hide Tags' : 'Show Tags'}
          </button>
        </div>
        <div
          ref={queueListRef}
          className="cp-queue-list"
          onDragOver={(e) => {
            if (!draggingQueueId) return;
            e.preventDefault();
            autoScrollQueueList(e.clientY);
            if (e.target === e.currentTarget && projectorQueue.length > 0) {
              setDropHint({ index: projectorQueue.length - 1, position: 'after' });
            }
          }}
          onDrop={(e) => {
            const draggingId = readDraggingId(e);
            if (!draggingId) return;
            e.preventDefault();
            const fromIndex = projectorQueue.findIndex((q) => q.id === draggingId);
            if (fromIndex < 0) return;
            const hintIndex = dropHint.index >= 0 ? dropHint.index : projectorQueue.length - 1;
            const hintPos = dropHint.index >= 0 ? dropHint.position : 'after';
            const targetIndex = resolveDropTargetIndex(fromIndex, hintIndex, hintPos);
            moveQueueItemByIndex(fromIndex, targetIndex);
            setDraggingQueueId(null);
            draggingQueueIdRef.current = '';
            setDropHint({ index: -1, position: 'before' });
          }}
        >
          {projectorQueue.length === 0 && (
            <div className="cp-queue-empty">Add items from Media or Free Text.</div>
          )}
          {projectorQueue.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => {
                setDraggingQueueId(item.id);
                draggingQueueIdRef.current = item.id;
                if (e.dataTransfer) {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('application/x-cdp-queue-id', item.id);
                  e.dataTransfer.setData('text/plain', item.id);
                }
              }}
              onDragEnd={() => {
                setDraggingQueueId(null);
                draggingQueueIdRef.current = '';
                setDropHint({ index: -1, position: 'before' });
              }}
              onDragOver={(e) => {
                const draggingId = readDraggingId(e);
                if (!draggingId || draggingId === item.id) return;
                e.preventDefault();
                e.stopPropagation();
                autoScrollQueueList(e.clientY);
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const position = y > rect.height / 2 ? 'after' : 'before';
                setDropHint((prev) =>
                  prev.index === index && prev.position === position
                    ? prev
                    : { index, position }
                );
              }}
              onDrop={(e) => {
                const draggingId = readDraggingId(e);
                if (!draggingId || draggingId === item.id) return;
                e.preventDefault();
                e.stopPropagation();
                const fromIndex = projectorQueue.findIndex((q) => q.id === draggingId);
                if (fromIndex < 0) return;
                const targetIndex = resolveDropTargetIndex(fromIndex, index, dropHint.position);
                moveQueueItemByIndex(fromIndex, targetIndex);
                setDraggingQueueId(null);
                draggingQueueIdRef.current = '';
                setDropHint({ index: -1, position: 'before' });
              }}
              className={`cp-queue-card ${index === activeQueueIndex ? 'cp-queue-card--active' : ''} ${draggingQueueId === item.id ? 'cp-queue-card--dragging' : ''} ${dropHint.index === index && dropHint.position === 'before' ? 'cp-queue-card--drop-before' : ''} ${dropHint.index === index && dropHint.position === 'after' ? 'cp-queue-card--drop-after' : ''}`}
            >
              <div className="cp-queue-row">
                <span title="Drag to reorder" className="cp-queue-drag">
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
                    title="Click to project; double-click to rename"
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
                    title="Rename card"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          className="btn btn--ghost cp-queue-btn-full cp-queue-btn-danger"
          onClick={removeSelectedQueueItem}
          disabled={activeQueueIndex < 0 || activeQueueIndex >= projectorQueue.length}
          title="Delete selected queue card"
        >
          Del Selected
        </button>
        <button
          className="btn btn--ghost cp-queue-btn-full"
          onClick={clearAllQueueItems}
          disabled={projectorQueue.length === 0}
        >
          Clear Queue
        </button>
      </div>
    </div>
  );
}

export default SidebarQueue;
