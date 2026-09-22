import { z } from "zod";
import type { CaptchaEvidence } from "./infrai_captcha.ts";

export const onboardingBodySchema = z.object({
  onboardingId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().trim().min(2).max(60),
  inviteCode: z.string().trim().min(6).max(64),
  captcha: z.object({
    widget_record_id: z.string().min(1),
    token: z.string().min(1),
    vendor: z.string().optional(),
    action: z.string().optional()
  })
}).strict();

export type OnboardingBody = z.infer<typeof onboardingBodySchema>;

export type Admission = {
  onboardingId: string;
  creator: { email: string; displayName: string };
  assetDelivery: "ready";
  subscriberUpdates: "subscribed";
  contentProcessing: "queued";
};

export class InviteRejected extends Error {}

export class InviteAdmission {
  private readonly completed = new Map<string, Admission>();
  private readonly inviteCodes: ReadonlySet<string>;
  private readonly captchaVerifier: (evidence: CaptchaEvidence) => Promise<unknown>;

  constructor(
    inviteCodes: ReadonlySet<string>,
    captchaVerifier: (evidence: CaptchaEvidence) => Promise<unknown>
  ) {
    this.inviteCodes = inviteCodes;
    this.captchaVerifier = captchaVerifier;
  }

  async admit(input: OnboardingBody, ip?: string): Promise<Admission> {
    const prior = this.completed.get(input.onboardingId);
    if (prior) return prior;
    if (!this.inviteCodes.has(input.inviteCode)) {
      throw new InviteRejected("This invitation is not valid");
    }

    await this.captchaVerifier({ ...input.captcha, ip });

    const result: Admission = {
      onboardingId: input.onboardingId,
      creator: { email: input.email, displayName: input.displayName },
      assetDelivery: "ready",
      subscriberUpdates: "subscribed",
      contentProcessing: "queued"
    };
    this.completed.set(input.onboardingId, result);
    return result;
  }
}
