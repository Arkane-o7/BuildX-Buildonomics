import { randomBytes, generateKeyPairSync } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  chmodSync,
} from "node:fs";
import { resolve } from "node:path";
const privateDir = resolve(".agentpass-private");
mkdirSync(privateDir, { recursive: true, mode: 0o700 });
const envPath = resolve(".env.local");
let contents = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const defaults: Record<string, string> = {
  APP_URL: "http://localhost:3000",
  SESSION_SECRET: randomBytes(32).toString("hex"),
  OWNER_ACCESS_CODE: randomBytes(12).toString("base64url"),
  AGENTPASS_AGENT_TOKEN: randomBytes(32).toString("base64url"),
  RECEIPT_PRIVATE_KEY: generateKeyPairSync("ed25519")
    .privateKey.export({ format: "pem", type: "pkcs8" })
    .toString()
    .replace(/\n/g, "\\n"),
  PAYMENT_MODE: "rehearsal",
  EVENT_DISABLED: "false",
};
for (const [key, value] of Object.entries(defaults)) {
  if (!new RegExp(`^${key}=.+`, "m").test(contents))
    contents += `\n${key}="${value}"\n`;
}
writeFileSync(envPath, contents, { mode: 0o600 });
chmodSync(envPath, 0o600);
process.loadEnvFile(envPath);
writeFileSync(
  resolve(privateDir, "OWNER-ACCESS.txt"),
  `AgentPass event owner access\n\nURL: ${process.env.APP_URL}\nAccess code: ${process.env.OWNER_ACCESS_CODE}\n\nOpen the dashboard and choose Owner access. Keep this file private.\n`,
  { mode: 0o600 },
);
console.log(
  "Private environment and owner access file ready. No credentials printed.",
);
if (process.argv.includes("--database")) {
  const { readWorkspace } = await import("../src/lib/store");
  const w = await readWorkspace("owner");
  console.log(`Workspace initialized: ${w.agent.id}`);
  process.exit(0);
}
