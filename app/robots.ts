import type { MetadataRoute } from 'next';
import { SEO_BASE } from '@/lib/seo';

/**
 * Everything public is crawlable; the signed-in app and the API are not.
 * The answer-engine crawlers are named explicitly because they are the ones
 * that decide whether SocialFlow can be quoted in an AI answer.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = ['/api/', '/dashboard', '/automations', '/logs', '/posts', '/billing', '/mcp', '/oauth', '/admin'];
  const allowAll = { allow: '/', disallow };
  return {
    rules: [
      { userAgent: '*', ...allowAll },
      { userAgent: 'GPTBot', ...allowAll },
      { userAgent: 'OAI-SearchBot', ...allowAll },
      { userAgent: 'ChatGPT-User', ...allowAll },
      { userAgent: 'ClaudeBot', ...allowAll },
      { userAgent: 'Claude-SearchBot', ...allowAll },
      { userAgent: 'PerplexityBot', ...allowAll },
      { userAgent: 'Google-Extended', ...allowAll },
      { userAgent: 'Applebot-Extended', ...allowAll },
    ],
    sitemap: `${SEO_BASE}/sitemap.xml`,
    host: SEO_BASE,
  };
}
