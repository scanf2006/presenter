const DEFAULT_TRIAL_DURATION_MS = 60 * 60 * 1000;
const DEFAULT_CLOCK_SKEW_TOLERANCE_MS = 2 * 60 * 1000;

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
  clockSkewToleranceMs = DEFAULT_CLOCK_SKEW_TOLERANCE_MS,
  readTrialState = null,
  writeTrialState = null,
}) {
  let cachedState = {
    trialStartedAtMs: null,
    trialLastSeenAtMs: null,
    trialClockTampered: false,
  };

  function isLicensedNow() {
    const status = typeof getLicenseStatus === 'function' ? getLicenseStatus() : null;
    return !!status?.isLicensed;
  }

  function ensureTrialStarted() {
    if (cachedState.trialStartedAtMs === null) {
      cachedState.trialStartedAtMs = Date.now();
    }
    return cachedState.trialStartedAtMs;
  }

  function loadState() {
    if (typeof readTrialState !== 'function') return cachedState;
    try {
      const persisted = readTrialState() || {};
      const started =
        Number.isFinite(persisted.trialStartedAtMs) && persisted.trialStartedAtMs > 0
          ? Number(persisted.trialStartedAtMs)
          : null;
      const lastSeen =
        Number.isFinite(persisted.trialLastSeenAtMs) && persisted.trialLastSeenAtMs > 0
          ? Number(persisted.trialLastSeenAtMs)
          : null;
      cachedState = {
        trialStartedAtMs: started,
        trialLastSeenAtMs: lastSeen,
        trialClockTampered: persisted.trialClockTampered === true,
      };
    } catch (_err) {
      // ignore read failures and keep in-memory fallback
    }
    return cachedState;
  }

  function persistState(nextState) {
    cachedState = nextState;
    if (typeof writeTrialState !== 'function') return;
    try {
      writeTrialState({
        trialStartedAtMs: nextState.trialStartedAtMs,
        trialLastSeenAtMs: nextState.trialLastSeenAtMs,
        trialClockTampered: nextState.trialClockTampered === true,
      });
    } catch (_err) {
      // ignore write failures and keep runtime behavior stable
    }
  }

  function ensureState(nowMs) {
    const current = loadState();
    const next = { ...current };

    if (!Number.isFinite(next.trialStartedAtMs) || next.trialStartedAtMs <= 0) {
      next.trialStartedAtMs = nowMs;
    }

    if (!Number.isFinite(next.trialLastSeenAtMs) || next.trialLastSeenAtMs <= 0) {
      next.trialLastSeenAtMs = nowMs;
    }

    if (nowMs + clockSkewToleranceMs < next.trialLastSeenAtMs) {
      next.trialClockTampered = true;
    }

    if (nowMs > next.trialLastSeenAtMs) {
      next.trialLastSeenAtMs = nowMs;
    }

    const changed =
      next.trialStartedAtMs !== current.trialStartedAtMs ||
      next.trialLastSeenAtMs !== current.trialLastSeenAtMs ||
      next.trialClockTampered !== current.trialClockTampered;

    if (changed) persistState(next);
    else cachedState = next;

    return next;
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
        message: 'Licensed',
      };
    }

    const nowMs = Date.now();
    const state = ensureState(nowMs);
    const startedAtMs = state.trialStartedAtMs ?? ensureTrialStarted();

    const elapsedMs = Math.max(0, nowMs - startedAtMs);
    const remainingMs = Math.max(0, durationMs - elapsedMs);
    const expired = remainingMs <= 0 || state.trialClockTampered === true;

    return {
      enabled: true,
      active: !expired,
      expired,
      durationMs,
      startedAtMs,
      elapsedMs,
      remainingMs,
      clockTampered: state.trialClockTampered === true,
      remainingLabel: formatDurationMs(remainingMs),
      message: state.trialClockTampered
        ? 'System clock rollback detected. Please activate license to continue projection.'
        : expired
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
