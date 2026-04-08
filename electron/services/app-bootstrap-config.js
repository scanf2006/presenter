function configureAppBootstrap({ app, protocol }) {
  // Allow autoplay with audio in Electron windows.
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

  // Register custom protocol privileges before app ready.
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'local-media',
      privileges: {
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        bypassCSP: true,
      },
    },
  ]);
}

module.exports = {
  configureAppBootstrap,
};
