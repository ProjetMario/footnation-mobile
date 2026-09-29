module.exports = ({ config }) => {
  const enabled = process.env.EXPO_PUBLIC_ERROR_REPORTING_ENABLED === "true";
  return {
    ...config,
    ios: { ...config.ios, usesAppleSignIn: true },
    plugins: [
      ...(config.plugins || []),
      "expo-apple-authentication",
      ...(enabled
        ? [
            [
              "@sentry/react-native/expo",
              {
                organization: process.env.SENTRY_ORG,
                project: process.env.SENTRY_PROJECT,
                url: "https://sentry.io/",
              },
            ],
          ]
        : []),
    ],
  };
};
