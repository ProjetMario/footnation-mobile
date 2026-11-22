# Shared SEO modules for native builds

The canonical modules live in the parent repository at `scripts/seo/` and are used by the web renderer. Expo imports these checked-in copies directly, including their TypeScript declarations. Local development, isolated typechecking and store builds therefore use the same files without depending on a parent checkout.

Before an EAS build, refresh both files from the parent and verify that their contents match:

```sh
cp ../scripts/seo/community-copy.mjs ../scripts/seo/community-copy.d.mts ../scripts/seo/club-route-index.mjs ../scripts/seo/club-route-index.d.mts shared/seo/
cmp ../scripts/seo/community-copy.mjs shared/seo/community-copy.mjs
cmp ../scripts/seo/club-route-index.mjs shared/seo/club-route-index.mjs
```

Keep all four files synchronized with the parent sources when their contract changes. The remote iOS workflow runs TypeScript in the isolated source snapshot before compiling.
