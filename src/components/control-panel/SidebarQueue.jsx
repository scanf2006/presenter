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
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-nav">
        <div className="sidebar__section-title">Projection</div>
        <button className={`sidebar__item ${activeSection === 'displays' ? 'sidebar__item--active' : ''}`} onClick={openDisplays}>
          <span className="sidebar__item-icon">D</span>
          Displays
        </button>

        <div className="sidebar__section-title">Content</div>
        <button className={`sidebar__item ${activeSection === 'text' ? 'sidebar__item--active' : ''}`} onClick={openText}>
          <span className="sidebar__item-icon">T</span>
          Free Text
        </button>
        <button className={`sidebar__item ${activeSection === 'songs' ? 'sidebar__item--active' : ''}`} onClick={openSongs}>
          <span className="sidebar__item-icon">S</span>
          Songs
        </button>
        <button className={`sidebar__item ${activeSection === 'bible' ? 'sidebar__item--active' : ''}`} onClick={openBible}>
          <span className="sidebar__item-icon">B</span>
          Bible
        </button>
        <button className={`sidebar__item ${activeSection === 'media' ? 'sidebar__item--active' : ''}`} onClick={openMedia}>
          <span className="sidebar__item-icon">M</span>
          Media
        </button>
      </div>

      <div className="sidebar-playlist">
        <div className="sidebar__section-title" style={{ paddingTop: 0 }}>
          Queue
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
                    {item.title}
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
