import type { BlogPost } from '@/lib/blog';
import { post as autoDmInstagramComment } from './auto-dm-instagram-comment';
import { post as manychatAlternativesHebrew } from './manychat-alternatives-hebrew';
import { post as manychat2026Pricing } from './manychat-2026-pricing-active-contacts';
import { post as commentLinkAndIllSendIt } from './comment-link-and-ill-send-it';

/** Every published article. Add the import here and the post goes live. */
export const POSTS: BlogPost[] = [
  autoDmInstagramComment,
  manychatAlternativesHebrew,
  manychat2026Pricing,
  commentLinkAndIllSendIt,
];
