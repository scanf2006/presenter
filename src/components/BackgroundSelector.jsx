import React, { useEffect, useState } from 'react';

export default function BackgroundSelector({ value, onChange, allowVideo = true }) {
  const [mediaList, setMediaList] = useState([]);
  const isElectron = typeof window.churchDisplay !== 'undefined';

  useEffect(() => {
    if (!isElectron) return;

    window.churchDisplay
      .getMediaList('all')
      .then((files) => {
        const filtered = files.filter((f) => {
          if (f.type === 'image') return true;
          if (allowVideo && f.type === 'video') return true;
          return false;
        });
        setMediaList(filtered.reverse());
      })
      .catch((err) => {
        console.error('[BG_DEBUG] BackgroundSelector getMediaList failed:', err);
      });
  }, [isElectron, allowVideo]);

  return (
    <div
      style={{
        marginBottom: '16px',
        border: '1px solid var(--glass-border)',
        borderRadius: '6px',
        padding: '12px',
        background: 'var(--color-bg-card)',
      }}
    >
      <div
        style={{
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          marginBottom: '8px',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>Select Background {allowVideo ? '(Image/Video)' : '(Image only)'}</span>
        {value && <span style={{ color: 'var(--color-primary)' }}>Selected: {value.name}</span>}
      </div>

      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        <div
          onClick={() => onChange(null)}
          style={{
            flexShrink: 0,
            width: '80px',
            height: '50px',
            background: 'var(--color-bg-secondary)',
            border: !value ? '2px solid var(--color-primary)' : '1px solid var(--glass-border)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '11px',
            color: 'var(--color-text-muted)',
            transition: 'all 0.2s',
            boxShadow: !value ? '0 0 8px rgba(99,102,241,0.3)' : 'none',
          }}
        >
          No Background
        </div>

        {mediaList.map((file) => {
          const isSelected = value && value.path === file.path;
          return (
            <div
              key={file.id}
              onClick={() => onChange({ type: file.type, path: file.path, name: file.name })}
              style={{
                flexShrink: 0,
                width: '80px',
                height: '50px',
                position: 'relative',
                background: '#0a0a0a',
                border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--glass-border)',
                borderRadius: '4px',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: isSelected ? '0 0 8px rgba(99,102,241,0.3)' : 'none',
              }}
              title={file.name}
            >
              {file.type === 'image' ? (
                <img
                  src={`local-media://${encodeURIComponent(file.path)}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  alt={file.name}
                />
              ) : (
                <video
                  src={`local-media://${encodeURIComponent(file.path)}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
              {file.type === 'video' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: 2,
                    fontSize: '10px',
                    background: 'rgba(0,0,0,0.5)',
                    borderRadius: '2px',
                    padding: '1px 3px',
                  }}
                >
                  Video
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
