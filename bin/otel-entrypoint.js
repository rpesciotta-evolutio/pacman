const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
const {
  logConfig,
  populateEnv,
} = require('../lib//utils.js');

console.log('Enabling tracing via OpenTelemetry');

logConfig();
populateEnv();

// If OTEL_LOG_LEVEL env var is set, configure logger
if (process.env.OTEL_LOG_LEVEL) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel[process.env.OTEL_LOG_LEVEL]);
}

require('@splunk/otel').start({
  metrics: { runtimeMetricsEnabled: true},
  serviceName: 'pacman'
});
