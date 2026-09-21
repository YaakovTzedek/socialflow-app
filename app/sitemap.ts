import type { MetadataRoute } from 'next';
import { LOCALES } from '@/lib/i18n';
import { PUBLIC_PATHS, alternatesFor, urlFor } from '@/lib/seo';

/** Every public page in every language, each entry carrying its hreflang set. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const out: MetadataRoute.Sitemap = [];
  for (const path of PUBLIC_PATHS) {
    const languages = alternatesFor(path);
    for (const locale of LOCALES) {
      out.push({
        url: urlFor(locale, path),
        lastModified: now,
        changeFrequency: path === '/' ? 'weekly' : 'monthly',
        priority: path === '/' ? 1 : 0.4,
        alternates: { languages },
      });
    }
  }
  return out;
}
