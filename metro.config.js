const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const config = getSentryExpoConfig(__dirname);
// SDK 57's development env module also imports .env files in the browser.
// Isolate the disposable UI server from saved backend settings during recipe tests.
if (process.env.FOOTNATION_UI_FIXTURES === "1") {
  const existing = config.resolver.blockList || [];
  config.resolver.blockList = [
    ...(Array.isArray(existing) ? existing : [existing]),
    /[/\\]\.env(?:\.[^/\\]*)?$/,
  ];
}
module.exports = config;
