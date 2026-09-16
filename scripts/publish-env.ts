/** Upload event-owned settings without logging their values. Existing DB variables stay untouched. */
import { spawnSync } from "node:child_process";
process.loadEnvFile(".env.local");
const selected = [
  "APP_URL",
  "SESSION_SECRET",
  "OWNER_ACCESS_CODE",
  "AGENTPASS_AGENT_TOKEN",
  "RECEIPT_PRIVATE_KEY",
  "PAYMENT_MODE",
  "EVENT_DISABLED",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
];
for (const name of selected) {
  const value = process.env[name];
  if (!value || (name === "APP_URL" && !value.startsWith("https://"))) continue;
  const result = spawnSync(
    "vercel",
    ["env", "add", name, "production", "--force"],
    { input: value, encoding: "utf8" },
  );
  if (result.status !== 0) {
    console.error(
      `Could not upload ${name}. Check Vercel CLI authentication and project access.`,
    );
    process.exit(1);
  }
  console.log(`Configured ${name} (value hidden)`);
}
