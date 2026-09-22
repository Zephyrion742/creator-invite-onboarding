import assert from "node:assert/strict";
import test from "node:test";
import { InviteAdmission } from "../src/invite_admission.ts";

test("an invited creator is admitted once and receives the three workflow states", async () => {
  let captchaCalls = 0;
  const workflow = new InviteAdmission(new Set(["MAKER-2026"]), async () => {
    captchaCalls += 1;
    return { verified: true };
  });
  const input = {
    onboardingId: "e7d68f1d-40ed-48cc-8871-c259ee04098b",
    email: "maya@example.com",
    displayName: "Maya Makes",
    inviteCode: "MAKER-2026",
    captcha: {
      widget_record_id: "widget-record-id",
      token: "test-captcha",
      action: "creator_signup"
    }
  };

  const first = await workflow.admit(input);
  const repeated = await workflow.admit(input);

  assert.deepEqual(first, {
    onboardingId: input.onboardingId,
    creator: { email: "maya@example.com", displayName: "Maya Makes" },
    assetDelivery: "ready",
    subscriberUpdates: "subscribed",
    contentProcessing: "queued"
  });
  assert.strictEqual(repeated, first);
  assert.equal(captchaCalls, 1);
});
