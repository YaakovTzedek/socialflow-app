/** @type {import('next').NextConfig} */
const nextConfig = {
  // We render remote avatars/thumbnails with plain <img> tags, so the Next.js
  // Image Optimizer is intentionally not used (avoids its known DoS advisories).
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
