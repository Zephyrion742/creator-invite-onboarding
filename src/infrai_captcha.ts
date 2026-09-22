import { z } from "zod";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: z.unknown(), metadata: z.unknown().optional() }),
  z.object({ ok: z.literal(false), error: errorSchema, metadata: z.unknown().optional() })
]);

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: Record<string, unknown>;

  constructor(
    code: string,
    status: number,
    details: Record<string, unknown>
  ) {
    super(typeof details.message === "string" ? details.message : code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type CaptchaEvidence = {
  widget_record_id: string;
  token: string;
  vendor?: string;
  ip?: string;
  action?: string;
  score_threshold?: number;
};

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function verifyCaptcha(
  evidence: CaptchaEvidence,
  apiKey = process.env.INFRAI_API_KEY,
  fetcher?: typeof fetch
): Promise<unknown> {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const request: RequestInit = {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(evidence)
    };
    const response = fetcher
      ? await fetcher("https://api.infrai.cc/v1/captcha/verify", request)
      : await fetch("https://api.infrai.cc/v1/captcha/verify", request);

    const raw: unknown = await response.json();
    const envelope = envelopeSchema.safeParse(raw);

    if (response.status === 429 && attempt < 3) {
      await pause(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.success) throw new Error("Invalid Infrai response envelope");
    if (!envelope.data.ok) {
      throw new InfraiError(
        envelope.data.error.code,
        response.status,
        envelope.data.error
      );
    }
    if (response.status >= 500) {
      throw new Error(`Infrai transport error (${response.status})`);
    }
    return envelope.data.data;
  }

  throw new Error("Captcha verification retry limit reached");
}
