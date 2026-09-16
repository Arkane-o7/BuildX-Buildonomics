import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import { parseEnv } from "node:util";
const imported = parseEnv(readFileSync(".env.vercel", "utf8"));
const value = imported.DATABASE_URL || imported.POSTGRES_URL;
if (!value)
  throw new Error(
    "No Postgres URL in .env.vercel. Connect Neon for Development and pull again.",
  );
let contents = readFileSync(".env.local", "utf8")
  .replace(/^DATABASE_URL=.*\n?/gm, "")
  .replace(/^POSTGRES_URL=.*\n?/gm, "");
contents += "\nDATABASE_URL=" + JSON.stringify(value) + "\n";
writeFileSync(".env.local", contents, { mode: 0o600 });
chmodSync(".env.local", 0o600);
console.log("Database connection merged; other event secrets preserved.");
