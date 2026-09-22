import type { Locale } from './i18n';
import { POSTS } from '@/content/blog';

/**
 * Blog registry. Articles are typed modules rather than MDX: the build stays
 * dependency free, every post is checked by the compiler, and the FAQ block
 * feeds both the page and its FAQPage markup from one place.
 *
 * `translationOf` links a post to its sibling in another language. Posts only
 * declare hreflang alternates for translations that actually exist, never for
 * every locale, because pointing hreflang at a page that is not there is worse
 * than leaving it out.
 */
export interface BlogFaq { q: string; a: string }

export interface BlogPost {
  slug: string;
  locale: Locale;
  title: string;
  /** Meta description and the listing blurb. */
  description: string;
  /** The answer-first summary shown in a box at the top. */
  tldr: string[];
  published: string;
  updated?: string;
  readingMinutes: number;
  keywords: string[];
  /** Groups translations of the same article together. */
  translationOf?: string;
  faq: BlogFaq[];
  /** Body as HTML. Headings are h2/h3, so the page owns the h1. */
  body: string;
}

export function postsFor(locale: Locale): BlogPost[] {
  return POSTS.filter((p) => p.locale === locale).sort((a, b) => (a.published < b.published ? 1 : -1));
}

export function postBySlug(locale: Locale, slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.locale === locale && p.slug === slug);
}

/** Every locale that has a translation of this post, including its own. */
export function translationsOf(post: BlogPost): BlogPost[] {
  if (!post.translationOf) return [post];
  return POSTS.filter((p) => p.translationOf === post.translationOf);
}

export function allPosts(): BlogPost[] {
  return POSTS;
}
