import React from 'react';

function SidebarQueue({
  activeSection,
  openDisplays,
  openText,
  openSongs,
  openBible,
  openMedia,
  projectorQueue,
  draggingQueueId,
  setDraggingQueueId,
  activeQueueIndex,
  handleMoveQueueItem,
  editingQueueId,
  editingQueueTitle,
  setEditingQueueTitle,
  handleCommitRenameQueueItem,
  handleCancelRenameQueueItem,
  handlePlayQueueItem,
  handleStartRenameQueueItem,
  handleRemoveActiveQueueItem,
  handleClearQueue,
  showQueueTypeTags,
  setShowQueueTypeTags,
}) {
  const getQueueTypeLabel = (item) => {
    const section = item?.section || '';
    const type = item?.type || item?.payload?.type || '';
    if (section === 'songs' || type === 'song' || type === 'lyrics') return 'SONG';
    if (section === 'bible' || type === 'bible') return 'BIBLE';
    if (section === 'text' || type === 'text') return 'TEXT';
    if (type === 'video') return 'VIDEO';
    if (type === 'image') return 'IMAGE';
    if (type === 'pdf') return 'PDF';
    if (type === 'ppt') return 'PPT';
    if (type === 'youtube') return 'YT';
    return 'MEDIA';
  };

  const getDisplayTitle = (rawTitle) => String(rawTitle || '')
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
                <span className={`sidebar__item-dot ${isActive ? 'sidebar__item-dot--active' : ''}`} />
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
        <div className="cp-queue-list">
          {projectorQueue.length === 0 && (
            <div className="cp-queue-empty">
              Add items from Media or Free Text.
            </div>
          )}
          {projectorQueue.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => setDraggingQueueId(item.id)}
              onDragEnd={() => setDraggingQueueId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (!draggingQueueId || draggingQueueId === item.id) return;
                const fromIndex = projectorQueue.findIndex((q) => q.id === draggingQueueId);
                handleMoveQueueItem(fromIndex, index);
                setDraggingQueueId(null);
              }}
              className={`cp-queue-card ${index === activeQueueIndex ? 'cp-queue-card--active' : ''}`}
            >
              <div className="cp-queue-row">
                <span title="Drag to reorder" className="cp-queue-drag">
                  ::
                </span>
                <span className="cp-queue-index">{index + 1}.</span>
                {showQueueTypeTags && <span className="cp-queue-type">{getQueueTypeLabel(item)}</span>}
                {editingQueueId === item.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={editingQueueTitle}
                    onChange={(e) => setEditingQueueTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCommitRenameQueueItem();
                      if (e.key === 'Escape') handleCancelRenameQueueItem();
                    }}
                    onBlur={handleCommitRenameQueueItem}
                    className="cp-queue-input"
                  />
                ) : (
                  <span
                    onClick={() => handlePlayQueueItem(index)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleStartRenameQueueItem(item);
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
                      handleStartRenameQueueItem(item);
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
          onClick={handleRemoveActiveQueueItem}
          disabled={activeQueueIndex < 0 || activeQueueIndex >= projectorQueue.length}
          title="Delete selected queue card"
        >
          Del Selected
        </button>
        <button className="btn btn--ghost cp-queue-btn-full" onClick={handleClearQueue} disabled={projectorQueue.length === 0}>
          Clear Queue
        </button>
      </div>
    </div>
  );
}

export default SidebarQueue;
