const response = await fetch("http://localhost:3000/creator-onboarding", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    onboardingId: "e7d68f1d-40ed-48cc-8871-c259ee04098b",
    email: "chenhua@changba.com",
    displayName: "Maya Makes",
    inviteCode: process.env.DEMO_INVITE_CODE ?? "",
    captcha: {
      widget_record_id: process.env.DEMO_WIDGET_RECORD_ID ?? "",
      token: process.env.DEMO_CAPTCHA_TOKEN ?? "",
      action: "creator_signup"
    }
  })
});

const body: unknown = await response.json();
if (!response.ok) {
  throw new Error(`Creator onboarding failed (${response.status}): ${JSON.stringify(body)}`);
}
console.log(JSON.stringify(body, null, 2));
