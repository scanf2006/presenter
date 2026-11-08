import React from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { SHORTCUT_GROUPS } from '../../constants/shortcuts';

/**
 * Lists the keyboard shortcuts. They all worked before this existed, but
 * nothing told the operator about them, so in practice only whoever wrote them
 * knew they were there.
 */
function ShortcutHelpModal({ open, onClose }) {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <div className="cp-modal-overlay" onClick={onClose}>
      <div
        className="cp-modal-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('shortcuts.title', 'Keyboard Shortcuts')}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 600 }}>
            {t('shortcuts.title', 'Keyboard Shortcuts')}
          </div>
          <button
            className="btn btn--ghost"
            onClick={onClose}
            style={{ padding: '4px 10px' }}
            autoFocus
          >
            {t('shortcuts.close', 'Close')}
          </button>
        </div>

        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.id} style={{ marginBottom: '16px' }}>
            <div
              style={{
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--color-text-secondary)',
                marginBottom: '8px',
              }}
            >
              {t(group.titleKey, group.titleFallback)}
            </div>
            {group.items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '12px',
                  padding: '5px 0',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', gap: '6px', flex: '0 0 170px', flexWrap: 'wrap' }}>
                  {item.display.map((key) => (
                    <kbd
                      key={key}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.18)',
                        borderRadius: '5px',
                        padding: '2px 7px',
                        fontFamily: 'inherit',
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {key}
                    </kbd>
                  ))}
                </div>
                <div style={{ color: 'var(--color-text-secondary)' }}>
                  {t(item.labelKey, item.labelFallback)}
                </div>
              </div>
            ))}
          </div>
        ))}

        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {t('shortcuts.typingNote', 'Shortcuts are ignored while you are typing in a field.')}
        </div>
      </div>
    </div>
  );
}

export default ShortcutHelpModal;
