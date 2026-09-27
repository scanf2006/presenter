export function projectionPlacement(displays, selected) {
  const display = displays.find((item) => item.id === selected && !item.isPrimary);
  return display ? JSON.stringify([display.id, display.bounds]) : null;
}
