export function getSelectableThumbCardStyle(isSelected) {
  return {
    cursor: 'pointer',
    border: isSelected ? '3px solid #ff4d4f' : '2px solid transparent',
    borderRadius: '6px',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
    boxShadow: isSelected
      ? '0 0 0 2px rgba(255,77,79,0.28), 0 4px 16px rgba(255,77,79,0.35)'
      : '0 2px 8px rgba(0,0,0,0.2)',
    transform: isSelected ? 'scale(1.01)' : 'scale(1)',
    transition: 'all 0.16s ease',
  };
}

export function getSelectableThumbSelectedTagStyle() {
  return {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 2,
    background: 'rgba(255,77,79,0.92)',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.4px',
    padding: '2px 7px',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.75)',
  };
}

export function getSelectableThumbIndexStyle(isSelected) {
  return {
    position: 'absolute',
    bottom: 0,
    right: 0,
    background: isSelected ? 'var(--color-primary)' : 'rgba(0,0,0,0.7)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 'bold',
    padding: '2px 8px',
    borderTopLeftRadius: '6px',
  };
}
