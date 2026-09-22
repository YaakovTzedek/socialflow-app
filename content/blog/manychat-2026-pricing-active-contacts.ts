import type { BlogPost } from '@/lib/blog';

export const post: BlogPost = {
  slug: 'manychat-2026-pricing-active-contacts',
  locale: 'en',
  title: 'Manychat\'s 2026 Pricing Change: What "Active Contacts" Actually Costs You',
  description:
    'Manychat restructured pricing on 2 March 2026. Here is how active contacts are counted, what a viral reel can cost in overage, who should stay, and what to check in a replacement.',
  tldr: [
    'Manychat moved to five tiers on 2 March 2026, and independent write-ups report the free plan dropped from 1,000 active contacts to 25.',
    'You are billed on contacts your automations touched this month, not on contacts you have stored, so one viral reel can move you two tiers in a week.',
    'Overage is reported at roughly $0.10 down to $0.004 per contact depending on tier, which is cheap at volume and expensive at the bottom.',
    'For steady, predictable volume Manychat is still a reasonable buy. The question is whether your cost should scale with people or with messages.',
  ],
  published: '2026-09-22',
  readingMinutes: 8,
  keywords: [
    'manychat pricing 2026',
    'manychat active contacts',
    'manychat alternative',
    'instagram dm automation pricing',
    'manychat overage',
    'comment to dm automation',
  ],
  faq: [
    {
      q: 'What is an active contact in Manychat?',
      a: 'A contact your automation interacted with during the billing period. Storing someone costs nothing. Sending or receiving a message with them in that month is what makes them billable, so the same person can be billable in March and free in April.',
    },
    {
      q: 'Did the Manychat free plan really drop to 25 contacts?',
      a: 'Independent write-ups of the 2 March 2026 change report a drop from 1,000 active contacts to 25 on the free plan. Manychat has not published a comparison table of old versus new, so check the live pricing page before you decide.',
    },
    {
      q: 'How much does one viral reel cost?',
      a: 'It depends on how far past your tier allowance it pushes you. At the reported overage rates, 3,000 unbudgeted contacts costs about $300 at $0.10 each and about $12 at $0.004 each. The rate falls sharply as the tier rises.',
    },
    {
      q: 'Should I leave Manychat?',
      a: 'Not automatically. If your monthly active contacts are stable and sit comfortably inside a tier, the per contact model is predictable and the product is mature. Spiky volume is what makes per contact billing uncomfortable.',
    },
    {
      q: 'What should a replacement have?',
      a: 'It should run on Meta\'s official APIs with your own permissions, hold Meta partner or approved app status, and bill in a unit you can forecast. Anything that asks for your Instagram password is a compliance and account risk, not a cheaper option.',
    },
    {
      q: 'Will I lose my automations if I migrate?',
      a: 'Flows do not transfer between platforms. You rebuild them, which is usually a few hours for a keyword to DM setup. Your contact list and any tags you care about should be exported before you cancel, because access ends with the subscription.',
    },
    {
      q: 'Can I run both tools during a migration?',
      a: 'Yes, but not on the same post. Two tools watching one post can both reply and both DM, which looks broken to the commenter. Split by post or by account while you test, then cut over.',
    },
  ],
  body: `
<h2>What changed on 2 March 2026</h2>
<p>Manychat restructured its plans into five tiers on 2 March 2026 and tightened the free plan sharply. The pricing logic did not change: you still pay by active contacts. The thresholds and the entry point did.</p>
<p>The number most people noticed is the free plan. Independent write-ups of the change, including <a href="https://www.replyrush.com/post/manychat-price-increase-2026">ReplyRush's breakdown of the 2026 increase</a>, report that the free tier went from 1,000 active contacts to 25. Manychat's own <a href="https://help.manychat.com/hc/en-us/articles/25800197498652-Free-plan">free plan help article</a> is the primary place to confirm the current figure.</p>
<p>Two things are worth saying plainly. First, these tier and overage numbers come from third party write ups rather than from a published Manychat comparison table, so treat them as reported rather than confirmed. Second, a price increase is not a scandal. Manychat carries Meta partner status, real support and a decade of edge cases handled. What changed is not whether the tool is good, it is who the pricing now suits.</p>

<h2>Active contacts are not the contacts you have</h2>
<p>An active contact is someone your automation exchanged a message with during the billing period. Stored contacts are free. Touched contacts are billable. That single distinction is why the bill moves even when your audience does not.</p>
<p>Take an account with 8,000 people in its Manychat audience, collected over two years. In a quiet month it runs one automation on one post, which triggers 900 conversations. It is billed on 900, not 8,000. The other 7,100 sit there costing nothing.</p>
<p>Now the same account posts a reel that does unusually well and 4,300 people comment the keyword. Every one of them gets a reply and a DM, so every one of them is active. The bill is now built on 5,200 active contacts in a month where the business did not change and revenue did not necessarily follow.</p>
<p>Run it forward one more month. The reel cools off, 600 people engage, and the account is billed on 600. The model punishes variance, not size. If your volume is flat, per contact billing is easy to forecast. If your volume is spiky, you are buying a tier for your best week and paying for it all month.</p>

<h2>What one viral reel actually costs</h2>
<p>Take the overage rate, multiply by the contacts past your allowance, and that is the bill. At the reported rates, 3,000 unbudgeted contacts costs roughly $300 at $0.10 each, $150 at $0.05, $75 at $0.025 and $12 at $0.004.</p>
<p>The reported overage rates run at roughly $0.10, $0.05, $0.025 and $0.004 per contact as you move up the tiers. That spread is the whole story. The same 3,000 person spike is a rounding error near the top and a real invoice near the bottom, which is the opposite of what a small account needs.</p>
<table>
<thead><tr><th>Contacts past allowance</th><th>At $0.10</th><th>At $0.05</th><th>At $0.025</th><th>At $0.004</th></tr></thead>
<tbody>
<tr><td>500</td><td>$50</td><td>$25</td><td>$12.50</td><td>$2</td></tr>
<tr><td>1,000</td><td>$100</td><td>$50</td><td>$25</td><td>$4</td></tr>
<tr><td>3,000</td><td>$300</td><td>$150</td><td>$75</td><td>$12</td></tr>
<tr><td>10,000</td><td>$1,000</td><td>$500</td><td>$250</td><td>$40</td></tr>
</tbody>
</table>
<p>That is arithmetic on reported rates, not a quote. Manychat also expects most accounts to upgrade rather than sit in overage, and an upgrade is usually cheaper than a large overrun.</p>
<p>Before you panic about spikes, check whether you actually get them. <a href="https://www.socialinsider.io/social-media-benchmarks/instagram">Socialinsider's Instagram benchmark study</a>, covering 35 million posts across 447,613 active pages from January to December 2025, puts the median at 3 comments per reel for accounts with 1,000 to 5,000 followers, 12 comments at 10,000 to 50,000, and 60 comments at 100,000 to 1 million. Median posts do not create overage. Outliers do, and a keyword funnel is specifically designed to manufacture outliers.</p>

<h2>Overage pricing and when it bites</h2>
<p>Overage bites in exactly one situation: a small account on a low tier that runs a campaign which works. That is the uncomfortable part, because the campaign working is the goal.</p>
<p>Three patterns push accounts over. A reel that outperforms by an order of magnitude. A giveaway, where the keyword is the entry mechanic and the volume is the entire point. And a paid campaign pointed at a post with an automation on it, where your ad spend and your contact count rise together.</p>
<p>The giveaway case deserves a warning independent of pricing. Giveaway entrants are the least qualified contacts you will ever collect, and under per contact billing you pay the same for them as for a buyer. Cheap to collect, expensive to hold, unlikely to convert.</p>
<p>If you stay on a per contact model, set a spend alert and decide in advance what you do when a post takes off: pause the automation, or accept the bill. Deciding in the middle of a spike is how people end up with an invoice they did not plan.</p>

<h2>Who should stay on Manychat</h2>
<p>Stay if your monthly active contacts are stable, you sit comfortably inside a tier, and you use more of the product than keyword to DM. The 2026 pricing is predictable for predictable usage.</p>
<p>Three profiles genuinely should not move. Accounts running multi step conversational flows with conditions, delays and branching, where Manychat's flow builder is the product you are paying for. Agencies with client sub accounts and internal process built around the platform. And anyone whose volume is flat month to month, because the failure mode of per contact billing is variance, and they do not have variance.</p>
<p>Switching costs are real. You rebuild flows, retest every trigger, re-verify Meta permissions, and spend a week finding the small behaviours you had tuned. If the current bill is fine, that week has no return.</p>

<h2>What to look for in a replacement</h2>
<p>Three checks, in order: does it run on Meta's official APIs with your own permissions, does it hold Meta partner or approved app status, and does it bill in a unit you can forecast.</p>
<p>The API question is not a technical preference, it is account risk. A tool that logs into Instagram with your password, or that scrapes comments from the web interface, is operating against Meta's terms and your account is the thing at risk, not the vendor's. Official API access means the platform acts as you, with permissions you granted and can revoke, and nothing happens that Meta has not sanctioned.</p>
<p>Meta partner or approved app status matters because it survives platform changes. Instagram's messaging permissions get reviewed and tightened. Tools inside the review process adapt. Tools outside it break, quietly, usually on the day you needed them.</p>
<p>Then the billing unit. Per contact means your cost scales with how many people engaged. Per message, or per automation run, means it scales with how much work the tool did. Those diverge hard in exactly the scenario a keyword funnel creates: a lot of people, two messages each, one short burst. <a href="https://isocialflow.com">SocialFlow</a> is built on Meta's official API with the account owner's permissions, which is the baseline we would tell anyone to insist on regardless of which tool they pick.</p>
<p>One more thing to check that rarely appears on a pricing page: can you see which automations, which posts and which trigger words actually produced leads? Most tools report messages sent. Fewer report what the messages were worth. SocialFlow's Brain screen exists for that question, and if your chosen tool does not answer it, you will be optimising a funnel you cannot see.</p>

<h2>A migration checklist</h2>
<p>Export first, rebuild second, cut over third. The order matters because access to your data ends when the subscription does, and a half migrated account can double message people.</p>
<ol>
<li>Export your contacts, tags and any custom fields while your plan is still active. Do this before you touch anything else.</li>
<li>List your live automations, with the post, the trigger word, the public reply text and the DM text for each. Most accounts find they have fewer working automations than they thought.</li>
<li>Note which posts are still driving traffic. Old posts with evergreen reach are worth migrating. The rest are not.</li>
<li>Connect the new tool with Meta permissions on a business or creator account linked to a Facebook page. That link is an API requirement, not a vendor preference.</li>
<li>Rebuild one automation, on one low traffic post, and test it with your own account and a second account that has never messaged you.</li>
<li>Check the public reply appears, the DM arrives, and the person is saved as a contact. All three, not just the DM.</li>
<li>Move the rest post by post. Never leave two tools watching the same post: both will reply and both will DM.</li>
<li>Run a week in parallel on separate posts, compare what each tool captured, then cancel.</li>
</ol>
<p>Budget an afternoon for a simple setup and two days if you have branching flows. Rebuilding a keyword to DM automation is genuinely quick. Rebuilding a twelve step conversational flow is not.</p>

<h2>Does the free tier still work for a first automation?</h2>
<p>For a genuine first test, yes. For anything real, no. At 25 active contacts you can confirm the mechanic works on one post and nothing more.</p>
<p>That is not nothing. Before you pay anyone, you want to know that your audience will actually type a keyword, that your DM copy gets clicked, and that the offer is worth sending. Twenty five people is enough to learn all three, and if fewer than 25 people respond to your first attempt, the problem is the offer, not the tooling.</p>
<p>Where it stops working is the moment a post performs. Using the Socialinsider medians again, a 10,000 to 50,000 follower account sees around 12 comments on a median reel, so a modest post fits inside 25 and a good one does not. You will hit the ceiling during your first successful campaign, which is the worst possible timing.</p>
<p>So use the free tier as a proof of concept with a deadline, not as a plan. Learn whether the mechanic works for your audience, then choose a paid tool on billing model rather than on which free tier was most generous. If you are still deciding whether to run this play at all, start with <a href="/blog/comment-link-and-ill-send-it">how the comment to DM funnel actually works</a> and what realistic response numbers look like.</p>

<h2>The honest summary</h2>
<p>Manychat got more expensive at the bottom and stayed sensible at the top. If your volume is flat, stay. If your volume spikes when your content works, per contact billing is a bad fit for you now.</p>
<p>The deeper issue is not price, it is what you are being charged for. Per contact pricing charges you for reach you did not control. Per message pricing charges you for work the tool did. Neither is dishonest. One of them just matches how comment automation behaves in practice.</p>
<p>Whatever you choose, verify the current numbers on Manychat's live pricing page before you decide. Prices in an article age. The pricing page does not.</p>
`,
};
