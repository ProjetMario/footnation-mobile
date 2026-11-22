module.exports = ({ config }) => {
  const enabled = process.env.EXPO_PUBLIC_ERROR_REPORTING_ENABLED === "true";
  return {
    ...config,
    // Applied only by the web release command; native linking stays unchanged.
    experiments: {
      ...config.experiments,
      ...(process.env.EXPO_PUBLIC_WEB_BASE_PATH === "/app"
        ? { baseUrl: "/app" }
        : {}),
    },
    ios: { ...config.ios, usesAppleSignIn: true },
    android: {
      ...config.android,
      // Android selects individual photos and videos via the system picker.
      blockedPermissions: [
        ...new Set([
          ...(config.android?.blockedPermissions || []),
          "android.permission.READ_MEDIA_IMAGES",
          "android.permission.READ_MEDIA_VIDEO",
          "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
        ]),
      ],
    },
    plugins: [
      ...(config.plugins || []).map((plugin) => {
        const [name, options] = Array.isArray(plugin) ? plugin : [plugin, {}];
        // SDK 57 needs an explicit opt-in: load the visited web screen instead
        // of downloading every screen before the first video can start.
        return name === "expo-router"
          ? [name, { ...options, asyncRoutes: { web: true, default: false } }]
          : plugin;
      }),
      [
        "expo-media-library",
        {
          photosPermission:
            "FootNation affiche les photos et vidéos que vous autorisez pour préparer vos publications, stories et shorts.",
          savePhotosPermission:
            "FootNation enregistre vos créations dans votre galerie si vous le demandez.",
          granularPermissions: ["photo", "video"],
          isAccessMediaLocationEnabled: false,
        },
      ],
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
