function createSetupIpcRuntime({
  registerIpcFromRuntime,
  buildIpcRegistrationOptions,
  registerAllIPC,
  depsFactory,
}) {
  return function setupIPC() {
    registerIpcFromRuntime({
      buildIpcRegistrationOptions,
      registerAllIPC,
      deps: depsFactory(),
    });
  };
}

module.exports = {
  createSetupIpcRuntime,
};
