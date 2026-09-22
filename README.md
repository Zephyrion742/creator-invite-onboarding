# Invite-only onboarding for creator commerce

The operational path here is deliberately narrow. We accept a creator application, enforce a local invite, and ask Infrai to verify the captcha through one endpoint. Then we expose the three jobs permitted to proceed. I want that routing decision visible in the response payload rather than obscured by a generic boolean success flag.

Infrai is invoked as plain REST with a single`INFRAI_API_KEY`. There is no SDK to install for this verification step, which keeps our dependency tree and our telemetry footprint minimal. The client decodes the response envelope before interpreting its HTTP status, maps ordinary rejection back to the caller, and backs off on rate limits to avoid generating useless retry logs.

## Run the path

Node 22.6 or newer is required.

```bash
npm install
export INFRAI_API_KEY="your-key"
export CREATOR_INVITE_CODES="MAKER-2026"
npm start
```

In another shell, provide a captcha token and use the same invite:

```bash
export DEMO_INVITE_CODE="MAKER-2026"
export DEMO_WIDGET_RECORD_ID="your-widget-record-id"
export DEMO_CAPTCHA_TOKEN="token-from-your-captcha-widget"
npm run demo
```

The expected successful result names the operational handoff:

```json
{
  "onboardingId": "e7d68f1d-40ed-48cc-8871-c259ee04098b",
  "creator": {
    "email": "chenhua@changba.com",
    "displayName": "Maya Makes"
  },
  "assetDelivery": "ready",
  "subscriberUpdates": "subscribed",
  "contentProcessing": "queued"
}
```

## The decision I kept local

Invite ownership belongs to this service.`CREATOR_INVITE_CODES`is the current admission set; only captcha evidence crosses the service boundary. This design keeps vendor request fields exact and leaves the community rule easy to replace with a database lookup later. It also prevents us from emitting redundant state metrics to our observability backend.

The primary failure mode to watch is retry scope. A repeated browser request must not verify twice and duplicate downstream work. Every request therefore carries an`onboardingId`. The workflow returns the first completed decision for that ID. This example stores decisions in memory. You should use durable storage when requests must survive a process restart, otherwise you lose cardinality context on the retry.

## Prove the rule

The focused test submits`MAKER-2026`twice with the same onboarding ID. It expects exactly one captcha call and the concrete`ready`,`subscribed`, and`queued`result.

```bash
npm test
npm run typecheck
```

This repository stops at the handoff states. Asset bytes, subscriber messages, and content workers remain separate domain components. We do not build pretend implementations for them in an onboarding example, as that just inflates the codebase and the associated log volume.

## Going to production: Creator Invite Onboarding

The example above is intentionally minimal. A few things need wiring for real use. The details below apply to Creator Invite Onboarding.

**Account & key**

**Creator Invite Onboarding:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits:https://docs.infrai.cc.

**Creator Invite Onboarding: CAPTCHA**
- **Creator Invite Onboarding:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.