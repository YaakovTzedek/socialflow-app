/**
 * Locales other than English and Hebrew. Kept in step with LOCALES in
 * lib/i18n/config.ts (this file is plain JS and cannot import it).
 */
const OTHER_LOCALES = 'ar|hu|de|fr|it|ja|es';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // We render remote avatars/thumbnails with plain <img> tags, so the Next.js
  // Image Optimizer is intentionally not used (avoids its known DoS advisories).
  images: {
    unoptimized: true,
  },

  /**
   * The ManyChat comparison moved: /vs/manychat is now /manychat-alternative,
   * and in Hebrew /he/manychat. One URL per language for the intent, so the
   * old and new pages never compete for the same query. Redirects run before
   * the locale middleware, so each old URL reaches its new home in one hop.
   */
  async redirects() {
    return [
      { source: '/vs/manychat', destination: '/manychat-alternative', permanent: true },
      { source: '/en/vs/manychat', destination: '/manychat-alternative', permanent: true },
      { source: '/he/vs/manychat', destination: '/he/manychat', permanent: true },
      { source: `/:locale(${OTHER_LOCALES})/vs/manychat`, destination: '/:locale/manychat-alternative', permanent: true },
      { source: '/he/manychat-alternative', destination: '/he/manychat', permanent: true },
      { source: '/manychat', destination: '/manychat-alternative', permanent: true },
      { source: '/en/manychat', destination: '/manychat-alternative', permanent: true },
      { source: `/:locale(${OTHER_LOCALES})/manychat`, destination: '/:locale/manychat-alternative', permanent: true },
    ];
  },
};

module.exports = nextConfig;
