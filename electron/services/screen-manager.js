class ScreenManager {
  constructor(screen) {
    this.screen = screen;
  }

  sanitizeDisplayLabel(rawLabel, index) {
    const fallback = `Display ${index + 1}`;
    if (typeof rawLabel !== 'string') return fallback;
    const label = rawLabel.trim();
    if (!label) return fallback;
    const isAscii = /^[\x20-\x7E]+$/.test(label);
    if (!isAscii || label.includes('?') || label.includes('\uFFFD')) return fallback;
    return label;
  }

  getAllDisplays() {
    return this.screen.getAllDisplays();
  }

  getPrimaryDisplay() {
    return this.screen.getPrimaryDisplay();
  }

  getExternalDisplays() {
    const primary = this.screen.getPrimaryDisplay();
    return this.screen.getAllDisplays().filter((d) => d.id !== primary.id);
  }

  getProjectorDisplay() {
    const externals = this.getExternalDisplays();
    if (externals.length > 0) return externals[0];
    return null;
  }

  getDisplaysInfo() {
    const primary = this.screen.getPrimaryDisplay();
    return this.screen.getAllDisplays().map((d, index) => ({
      id: d.id,
      label: this.sanitizeDisplayLabel(d.label, index),
      bounds: d.bounds,
      workArea: d.workArea,
      scaleFactor: d.scaleFactor,
      isPrimary: d.id === primary.id,
      size: d.size,
    }));
  }
}

module.exports = {
  ScreenManager,
};
