# 📋 App Review Submission Package — SocialFlow

App ID: **1258230962812630** · App URL: **https://socialflow-app-delta.vercel.app**

This is everything needed to submit SocialFlow for Meta App Review so real
comment webhooks are delivered in production (Live Mode).

---

## ✅ Prerequisites checklist

- [x] Privacy Policy URL — https://socialflow-app-delta.vercel.app/privacy
- [x] Terms of Service URL — https://socialflow-app-delta.vercel.app/terms
- [x] Data Deletion URL — https://socialflow-app-delta.vercel.app/data-deletion
- [x] App icon, name, category set
- [ ] **Business Verification** (YOU — needs business legal documents)
- [ ] **Screencast per permission** (record using the guide below)
- [ ] **Submit for review** (YOU — final click in dashboard)

> Update the Meta app's Privacy/Terms/Data-Deletion URLs to the Vercel ones above
> (Settings → Basic). They currently point to the old base44 domain.

---

## 🔑 Permissions to request (Advanced Access) + justification text

Paste each justification into the "Tell us how you'll use this permission" box.

### pages_show_list
> SocialFlow displays the list of Facebook Pages the user manages so they can
> select which Page to manage comments and automations for. The user picks a
> Page from this list as the first step in every workflow.

### pages_read_engagement
> We read the Page's published posts and their engagement so the user can browse
> their posts inside SocialFlow and choose a specific post to set up a comment
> automation or reply to.

### pages_read_user_content
> We read comments left by users on the Page's posts so the user can view and
> reply to them, and so keyword-based automations can detect matching comments
> and respond. This is core to the comment-management product.

### pages_manage_engagement
> We post public replies to comments on behalf of the Page — both manual replies
> the user writes in SocialFlow, and automated replies triggered by keyword rules
> the user configures.

### pages_manage_posts
> Used to create comments on the Page's posts as part of the user's reply and
> automation workflows.

### pages_manage_metadata
> Required to subscribe the Page to webhooks so SocialFlow receives real-time
> notifications when a new comment is posted, enabling automated responses.

### pages_messaging
> When a user comments on a Page post and matches an automation, SocialFlow sends
> them a private reply (DM) with the requested information/link — the standard
> comment-to-DM flow. Only sent in direct response to the user's own comment.

### business_management
> Some of the user's Pages are owned by a Business Portfolio. We use this to
> enumerate and access those Pages (via the business) so they appear in the
> user's Page list alongside directly-managed Pages.

### instagram_basic
> We read the user's connected Instagram Business account profile and media so
> they can browse Instagram posts and manage comments inside SocialFlow.

### instagram_manage_comments
> We read and reply to comments on the user's Instagram Business media — manual
> replies and keyword-triggered automated replies, mirroring the Facebook flow.

---

## 🎬 Screencast guide (record one short video showing the full flow)

Record a screen recording (Loom / QuickTime) showing, end to end:

1. Open https://socialflow-app-delta.vercel.app → click "Login with Facebook"
2. Complete Facebook login and grant the permissions
3. Show the Page list loading (demonstrates pages_show_list, business_management)
4. Click a Page → show its posts (pages_read_engagement)
5. Open a post → show its comments (pages_read_user_content)
6. Type and post a reply to a comment (pages_manage_engagement)
7. Go to Automations → create an automation with a keyword + reply + DM
   (pages_manage_metadata for subscription, pages_messaging for DM)
8. Show the linked Instagram account → browse media + reply (instagram_basic,
   instagram_manage_comments)
9. Show the "logout" / data deletion option

Narrate what each step does. Meta reviewers need to SEE each permission used.

> Tip: you can record this in Development Mode since you're an admin — the
> manual reply, page browsing, and automation creation all work live for you.

---

## 📝 App Review notes box (general description)

> SocialFlow is a comment-management and automation tool for Facebook Pages and
> Instagram Business accounts. Page owners connect their account, browse their
> posts, reply to comments manually, and set up keyword-based automations that
> post a public reply and send a private message when someone comments. All
> actions are performed only on Pages/accounts the authenticated user manages.

---

## After approval

Once approved and the app is switched to **Live Mode**, real comment webhooks
will be delivered and the automations fire automatically — **no code changes
needed**. Everything is already built and deployed.
