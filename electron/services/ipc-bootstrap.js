function registerIpcFromRuntime({
  buildIpcRegistrationOptions,
  registerAllIPC,
  deps,
}) {
  const ipcOptions = buildIpcRegistrationOptions(deps);
  registerAllIPC(ipcOptions);
}

module.exports = {
  registerIpcFromRuntime,
};
