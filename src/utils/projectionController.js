import { projectionPlacement } from './displayRecovery.js';

export function createProjectionController({ show, hide, onState }) {
  let selected = null;
  let placement;
  let revision = 0;
  let tail = Promise.resolve();
  function enqueue(id, nextPlacement, current) {
    const operation = tail.then(async () => {
      if (current !== revision) return;
      try {
        if (nextPlacement) await show(id);
        else await hide();
        if (current === revision) {
          placement = nextPlacement;
          onState({ selected, active: Boolean(nextPlacement) });
        }
      } catch (error) {
        if (current === revision) {
          placement = undefined;
          onState({ selected, active: false });
        }
        throw error;
      }
    });
    tail = operation.catch(() => {});
    return operation;
  }
  return {
    revision: () => revision,
    select(id, displays) {
      selected = id;
      onState({ selected, active: false });
      return enqueue(id, projectionPlacement(displays, id), ++revision);
    },
    refresh(displays, expectedRevision) {
      if (expectedRevision !== revision) return Promise.resolve();
      const next = projectionPlacement(displays, selected);
      if (next === placement) return Promise.resolve();
      return enqueue(selected, next, ++revision);
    },
  };
}
