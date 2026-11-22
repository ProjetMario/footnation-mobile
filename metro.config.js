const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const config = getSentryExpoConfig(__dirname);
// Shared editorial modules and their TypeScript declarations live inside this
// project, so local development and isolated store builds resolve identical files.
if (!config.resolver.sourceExts.includes("mjs")) config.resolver.sourceExts.push("mjs");
// Compressed browser fonts; native builds keep the existing TTF assets.
if (!config.resolver.assetExts.includes("woff2")) {
  config.resolver.assetExts.push("woff2");
}
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
