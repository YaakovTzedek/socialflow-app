/**
 * Who owns SocialFlow (the SaaS owner, not a customer).
 *
 * Decided only on the server, from the Facebook user id held in the signed-in
 * session. OWNER_FB_IDS is a comma separated list of app-scoped Facebook user
 * ids; when it is not set, Yaakov's own id is the default so the owner tools
 * work on the first deploy. The id is the owner_id his account has in every
 * table (plan_overrides note "owner account (Yaakov)", and the owner of the
 * pages "יעקב צדק זאפרני", SocialFlow and Reelsi).
 *
 * Emails are not part of the check: the Facebook login asks for id and name
 * only, so the session never holds an email to compare against.
 */
const DEFAULT_OWNER_FB_IDS = ['122166073262726335'];

export function ownerIds(): string[] {
  const raw = (process.env.OWNER_FB_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return raw.length ? raw : DEFAULT_OWNER_FB_IDS;
}

export function isOwnerId(userId: string | null | undefined): boolean {
  return !!userId && ownerIds().includes(userId);
}
