import type { BlogPost } from '@/lib/blog';
import { post as autoDmInstagramComment } from './auto-dm-instagram-comment';
import { post as manychatAlternativesHebrew } from './manychat-alternatives-hebrew';
import { post as manychat2026Pricing } from './manychat-2026-pricing-active-contacts';
import { post as commentLinkAndIllSendIt } from './comment-link-and-ill-send-it';
import { post as instagramBotLegal } from './instagram-bot-legal';
import { post as instagramBotPriceIsrael } from './instagram-bot-price-israel';
import { post as instagramLeadsGuide } from './instagram-leads-guide';
import { post as facebookCommentAutomation } from './facebook-comment-automation';

/** Every published article. Add the import here and the post goes live. */
export const POSTS: BlogPost[] = [
  autoDmInstagramComment,
  manychatAlternativesHebrew,
  manychat2026Pricing,
  commentLinkAndIllSendIt,
  instagramBotLegal,
  instagramBotPriceIsrael,
  instagramLeadsGuide,
  facebookCommentAutomation,
];
