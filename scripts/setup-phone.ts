import { appendFileSync, chmodSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import webpush from "web-push";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const present = !!process.env.PHONE_VAPID_PUBLIC_KEY;
if (present !== !!process.env.PHONE_VAPID_PRIVATE_KEY) throw new Error("Incomplete VAPID key pair. Restore the matching keys before continuing.");
if (!present) {
  const keys = webpush.generateVAPIDKeys();
  appendFileSync(".env.local", "\nPHONE_VAPID_PUBLIC_KEY=" + keys.publicKey + "\nPHONE_VAPID_PRIVATE_KEY=" + keys.privateKey + "\n", { mode: 0o600 });
  chmodSync(".env.local", 0o600);
  process.env.PHONE_VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.PHONE_VAPID_PRIVATE_KEY = keys.privateKey;
  console.log("Generated phone notification keys in ignored .env.local. Values hidden.");
}
if (process.argv.includes("--publish")) {
  for (const name of ["PHONE_VAPID_PUBLIC_KEY", "PHONE_VAPID_PRIVATE_KEY"]) {
    const r = spawnSync("vercel", ["env", "add", name, "production", "--force"], { input: process.env[name], encoding: "utf8" });
    if (r.status !== 0) throw new Error("Could not configure " + name + " in Vercel. Check project access.");
    console.log("Configured " + name + " in Production (value hidden).");
  }
}
console.log("Keep the same key pair across deployments to preserve phone subscriptions.");
