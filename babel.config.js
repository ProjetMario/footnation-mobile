module.exports = function (api) {
  const web = api.caller((caller) => caller?.platform === "web");
  return {
    presets: ["babel-preset-expo"],
    plugins: web ? ["./scripts/babel-web-icons.cjs"] : [],
  };
};
