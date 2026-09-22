import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError, verifyCaptcha } from "./infrai_captcha.ts";
import {
  InviteAdmission,
  InviteRejected,
  onboardingBodySchema
} from "./invite_admission.ts";

const inviteCodes = new Set(
  (process.env.CREATOR_INVITE_CODES ?? "").split(",").map((code) => code.trim()).filter(Boolean)
);
const admission = new InviteAdmission(inviteCodes, verifyCaptcha);
const port = Number(process.env.PORT ?? 3000);

function send(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/creator-onboarding") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = onboardingBodySchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const ip = request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim()
      ?? request.socket.remoteAddress;
    send(response, 201, await admission.admit(input, ip));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Invalid request body" });
    } else if (error instanceof InviteRejected) {
      send(response, 403, { error: error.message });
    } else if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      send(response, error.status, { error: error.message, code: error.code });
    } else {
      console.error(error);
      send(response, 502, { error: "Verification service request failed" });
    }
  }
}).listen(port, () => console.log(`Creator onboarding listening on http://localhost:${port}`));
