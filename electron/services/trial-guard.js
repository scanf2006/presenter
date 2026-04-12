const DEFAULT_TRIAL_DURATION_MS = 60 * 60 * 1000;

function formatDurationMs(ms) {
  const safeMs = Math.max(0, Number(ms) || 0);
  const totalSec = Math.ceil(safeMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function createTrialGuard({
  getLicenseStatus,
  durationMs = DEFAULT_TRIAL_DURATION_MS,
  readTrialState = null,
  writeTrialState = null,
}) {
  let cachedState = {
    trialConsumedMs: 0,
    trialClockTampered: false,
  };
  let hasLoadedState = false;
  let sessionBaseConsumedMs = 0;
  let sessionStartHrNs = process.hrtime.bigint();
  let lastPersistedConsumedMs = 0;

  function isLicensedNow() {
    const status = typeof getLicenseStatus === 'function' ? getLicenseStatus() : null;
    return !!status?.isLicensed;
  }

  function loadStateOnce() {
    if (hasLoadedState) return cachedState;
    hasLoadedState = true;

    if (typeof readTrialState !== 'function') {
      sessionBaseConsumedMs = cachedState.trialConsumedMs;
      lastPersistedConsumedMs = cachedState.trialConsumedMs;
      return cachedState;
    }

    try {
      const persisted = readTrialState() || {};
      const persistedConsumedMs =
        Number.isFinite(persisted.trialConsumedMs) && persisted.trialConsumedMs >= 0
          ? Number(persisted.trialConsumedMs)
          : 0;

      cachedState = {
        trialConsumedMs: Math.max(0, persistedConsumedMs),
        // Keep this field for response shape compatibility with existing UI.
        trialClockTampered: false,
      };
    } catch (_err) {
      // ignore read failures and keep in-memory fallback
    }

    sessionBaseConsumedMs = cachedState.trialConsumedMs;
    lastPersistedConsumedMs = cachedState.trialConsumedMs;
    sessionStartHrNs = process.hrtime.bigint();
    return cachedState;
  }

  function getSessionRuntimeMs() {
    const diffNs = process.hrtime.bigint() - sessionStartHrNs;
    if (diffNs <= 0n) return 0;
    return Number(diffNs / 1000000n);
  }

  function getLiveConsumedMs() {
    const runtimeMs = getSessionRuntimeMs();
    return Math.max(0, sessionBaseConsumedMs + runtimeMs);
  }

  function persistConsumedIfNeeded(nextConsumedMs, force = false) {
    cachedState = {
      ...cachedState,
      trialConsumedMs: Math.max(0, Number(nextConsumedMs) || 0),
    };
    if (typeof writeTrialState !== 'function') return;

    const shouldPersist = force || cachedState.trialConsumedMs - lastPersistedConsumedMs >= 1000;
    if (!shouldPersist) return;

    try {
      writeTrialState({
        trialConsumedMs: cachedState.trialConsumedMs,
        trialClockTampered: false,
      });
      lastPersistedConsumedMs = cachedState.trialConsumedMs;
      sessionBaseConsumedMs = cachedState.trialConsumedMs;
      sessionStartHrNs = process.hrtime.bigint();
    } catch (_err) {
      // ignore write failures and keep runtime behavior stable
    }
  }

  function getTrialStatus() {
    if (isLicensedNow()) {
      return {
        enabled: false,
        active: false,
        expired: false,
        durationMs,
        startedAtMs: null,
        elapsedMs: 0,
        remainingMs: null,
        remainingLabel: null,
        clockTampered: false,
        message: 'Licensed',
      };
    }

    loadStateOnce();
    const elapsedMs = getLiveConsumedMs();
    persistConsumedIfNeeded(elapsedMs);

    const remainingMs = Math.max(0, durationMs - elapsedMs);
    const expired = remainingMs <= 0;
    const startedAtMs = Date.now() - elapsedMs;

    return {
      enabled: true,
      active: !expired,
      expired,
      durationMs,
      startedAtMs,
      elapsedMs,
      remainingMs,
      clockTampered: false,
      remainingLabel: formatDurationMs(remainingMs),
      message: expired
        ? 'Trial expired. Please activate license to continue projection.'
        : `Trial remaining: ${formatDurationMs(remainingMs)}`,
    };
  }

  function ensureProjectionAccess() {
    if (isLicensedNow()) {
      return { allowed: true, reason: 'licensed', trial: getTrialStatus() };
    }

    const trial = getTrialStatus();
    if (trial.expired) {
      // Force one last flush when the trial crosses the boundary.
      persistConsumedIfNeeded(durationMs, true);
      return {
        allowed: false,
        reason: 'trial_expired',
        message: 'Trial expired. Please activate license to continue projection.',
        trial,
      };
    }
    return {
      allowed: true,
      reason: 'trial_active',
      message: `Trial remaining: ${trial.remainingLabel}`,
      trial,
    };
  }

  return {
    getTrialStatus,
    ensureProjectionAccess,
  };
}

module.exports = {
  createTrialGuard,
  DEFAULT_TRIAL_DURATION_MS,
};
