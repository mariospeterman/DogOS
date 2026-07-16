# Distribution, Growth, and Commerce

- Status: web-first distribution approved; native stores and commerce providers pending
- Last reviewed: 2026-07-16

## Product loop

DogOS is not a chat link that disappears after onboarding. WhatsApp is the
conversation surface; DogOS is the durable account, plan, session, progress,
calendar, entitlement, referral, and consent system.

```text
search, share, trainer, event, or store
  -> canonical DogOS HTTPS link
  -> one-tap WhatsApp start
  -> signed account-link confirmation
  -> dog profile and measurable goal
  -> first useful training block
  -> install DogOS
  -> session and progress loop
  -> milestone share or professional/partner referral
  -> canonical DogOS HTTPS link
```

The first meaningful result must precede subscription pressure, notification
permission, contact access, precise location, or community prompts.

## Distribution sequence

### 1. Installable web app

Ship the responsive PWA first on one stable HTTPS domain. The same canonical URL
works in search, WhatsApp, QR codes, trainer handouts, events, email, and ads.
The PWA owns Today, Plan, Session, Progress, Calendar, Account, entitlements, and
consent. WhatsApp owns conversational onboarding, coaching, and reminders.

Do not cache authenticated training or API responses in the service worker.
Install and notification prompts follow a useful action rather than appearing on
first paint.

### 2. Android

After the public domain and PWA are production-stable, package it as a Trusted
Web Activity using Bubblewrap. Publish `/.well-known/assetlinks.json`, configure
verified App Links, and test installed and browser fallbacks. Android 15 Dynamic
App Links can later route campaign and feature paths without a binary release.

### 3. iOS

Do not submit a basic web wrapper. Apple Guideline 4.2 requires utility beyond a
repackaged website. Build the iOS shell when it can provide native camera/video
capture, LiveKit coaching, background-safe timers, notifications, widgets or App
Shortcuts, and Universal Links. Host the AASA file on the canonical domain and
validate every deep-link parameter; links never directly execute sensitive
actions.

An App Clip is not the first choice because the WhatsApp start already provides
a lower-friction cross-platform acquisition path. Reconsider it only for
physical trainer locations or events where NFC/QR invocation creates a distinct
instant experience.

## Acquisition and attribution

- Public invite codes identify a campaign or inviter but never authorize access.
- Store only code hashes server-side; use bounded expiry and redemption counts.
- Capture channel, campaign, landing path, and an anonymous visitor hash.
- Attach attribution to a user only after authentication and explicit account
  creation.
- Never place dog, household, phone, email, or health/behavior facts in URLs.
- Use one canonical redirect service for campaign and partner links, with an
  allowlisted HTTPS destination and revocation.

The initial share action is intentionally generic until the signed invite API is
implemented. Client-generated referral identifiers would be trivial to forge.

## Retention and responsible virality

Primary retention comes from utility:

1. A short daily training block and completion record.
2. Visible evidence toward the owner's measurable goal.
3. Explainable progression and plan updates.
4. Calendar reminders and WhatsApp return links.
5. Private milestones that an owner chooses to share.
6. Trainer review, live sessions, and events when they add value.

Avoid global dog scores, public performance leaderboards, manufactured streak
anxiety, and rewards for excessive repetitions. Suitable community mechanics are
opt-in team challenges based on consistency or participation, trainer-led events,
and private household milestones.

Nearby-handler discovery is deferred. It requires coarse-location defaults,
mutual opt-in, blocking/reporting, age controls, content moderation, event-host
verification, and no exposure of home or routine locations. City-level trainer
and event discovery should ship first.

## Native partner recommendations

Partner products appear only in context, for example an approved long line for a
specific recall step. Each recommendation shows:

- why it fits the current protocol and dog context;
- evidence or professional-review status;
- price and availability when verified;
- a clear `Affiliate-Link` or equivalent disclosure near the action;
- a non-affiliate alternative where practical.

Commission is absent from trainer and product ranking. Suitability uses protocol
fit, dog-context fit, evidence quality, and availability. The model receives a
reviewed offer identifier, not a raw affiliate URL. The server resolves an
allowlisted, revocable redirect and records click/conversion events idempotently.

Food, supplements, insurance, and medical-adjacent products require separate
claim, suitability, regulatory, and professional review. Do not infer nutritional
or medical needs from chat and then monetize that inference.

## Payments

- DogOS Plus/Pro/Ultra are digital subscriptions. Store-distributed builds use
  Apple In-App Purchase or Google Play Billing unless an applicable regional
  program is deliberately adopted and implemented.
- Physical equipment and food use external commerce, with affiliate disclosure.
- Real-time one-to-one trainer sessions may use external payment under current
  Apple rules; one-to-many digital classes need separate store-policy review.
- Web billing and store billing project into the same canonical entitlement
  service. Provider receipts never become authorization by themselves.

## Metrics

Measure activation by useful outcomes, not button clicks alone:

- start link to first inbound WhatsApp message;
- first message to linked authenticated account;
- linked account to completed dog profile and measurable goal;
- time to first plan and first completed session;
- week-one useful-session retention;
- install after first value;
- milestone shares that create activated users;
- referral click to completed external service or purchase;
- refund, reversal, complaint, hide-recommendation, and unsubscribe rates.

## Sources

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple Universal Links](https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content)
- [Apple Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- [Android Trusted Web Activities](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities)
- [Android App Links](https://developer.android.com/training/app-links/about)
- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)
- [European Commission affiliate disclosure guidance](https://commission.europa.eu/topics/consumers/consumer-rights-and-complaints/influencer-legal-hub_en)
- [EDPB deceptive design guidelines](https://www.edpb.europa.eu/documents/guideline/guidelines-032022-on-deceptive-design-patterns-in-social-media-platform_en)
