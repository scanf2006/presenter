// Compares two display lists from the OS so a periodic refresh only replaces
// state when the topology really changed. Comparing serialized JSON would also
// report a change when the backend merely emits the same fields in a different
// order, which would re-render every consumer of `displays` every few seconds.

const SAME_BOX = (left, right) =>
  Number(left?.x) === Number(right?.x) &&
  Number(left?.y) === Number(right?.y) &&
  Number(left?.width) === Number(right?.width) &&
  Number(left?.height) === Number(right?.height);

const sameDisplay = (left, right) =>
  String(left?.id) === String(right?.id) &&
  String(left?.label ?? '') === String(right?.label ?? '') &&
  Boolean(left?.isPrimary) === Boolean(right?.isPrimary) &&
  SAME_BOX(left?.bounds, right?.bounds) &&
  SAME_BOX({ ...left?.size, x: 0, y: 0 }, { ...right?.size, x: 0, y: 0 });

export function sameDisplays(left, right) {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((display, index) => sameDisplay(display, right[index]));
}

export default sameDisplays;
