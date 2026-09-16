import postgres from "postgres";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OwnerAccount } from "./platform-types";
import { AppError } from "./store";

interface AccountRecord { state: OwnerAccount; passwordHash: string }
const db = () => process.env.DATABASE_URL || process.env.POSTGRES_URL;
let sql: ReturnType<typeof postgres> | undefined;
let ready: Promise<void> | undefined;
let queue: Promise<unknown> = Promise.resolve();
const file = () => path.join(process.cwd(), ".agentpass-private", "customer-accounts.json");
async function database() {
  if (!db()) {
    if (process.env.VERCEL) throw new AppError(503, "Account storage is not configured.");
    return null;
  }
  sql ??= postgres(db()!, { max: 3, prepare: false, idle_timeout: 10, connect_timeout: 10, ssl: db()!.includes("localhost") ? false : "require" });
  ready ??= sql`CREATE TABLE IF NOT EXISTS agentpass_accounts (id text PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL, state jsonb NOT NULL)`.then(() => {}).catch(e => { ready = undefined; throw e; });
  await ready;
  return sql;
}
async function local<T>(fn: (records: Record<string, AccountRecord>) => T): Promise<T> {
  const task = queue.then(async () => {
    let records: Record<string, AccountRecord> = {};
    try { records = JSON.parse(await readFile(file(), "utf8")); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    const result = fn(records);
    await mkdir(path.dirname(file()), { recursive: true, mode: 0o700 });
    await writeFile(file() + ".tmp", JSON.stringify(records), { mode: 0o600 });
    await rename(file() + ".tmp", file());
    return structuredClone(result);
  });
  queue = task.catch(() => {});
  return task;
}
export async function createAccount(state: OwnerAccount, passwordHash: string) {
  const client = await database();
  if (client) {
    const inserted = await client`INSERT INTO agentpass_accounts (id,email,password_hash,state) VALUES (${state.id},${state.email},${passwordHash},${client.json(state as never)}) ON CONFLICT (email) DO NOTHING RETURNING id`;
    if (!inserted.length) throw new AppError(409, "An account with that email already exists. Sign in instead.");
  } else await local(records => {
    if (Object.values(records).some(r => r.state.email === state.email)) throw new AppError(409, "An account with that email already exists.");
    records[state.id] = { state, passwordHash };
  });
}
export async function accountByEmail(email: string): Promise<AccountRecord | null> {
  const client = await database();
  if (!client) return local(records => Object.values(records).find(r => r.state.email === email) || null);
  const [row] = await client`SELECT state,password_hash FROM agentpass_accounts WHERE email=${email}`;
  return row ? { state: row.state as OwnerAccount, passwordHash: row.password_hash } : null;
}
export async function readAccount(id: string): Promise<OwnerAccount> {
  const client = await database();
  if (!client) return local(records => { if (!records[id]) throw new AppError(401, "Sign in to your account."); return records[id].state; });
  const [row] = await client`SELECT state FROM agentpass_accounts WHERE id=${id}`;
  if (!row) throw new AppError(401, "Sign in to your account.");
  return row.state as OwnerAccount;
}
export async function updateAccount<T>(id: string, fn: (account: OwnerAccount) => T): Promise<T> {
  const client = await database();
  if (!client) return local(records => { if (!records[id]) throw new AppError(401, "Account not found."); return fn(records[id].state); });
  return await client.begin(async tx => {
    const [row] = await tx`SELECT state FROM agentpass_accounts WHERE id=${id} FOR UPDATE`;
    if (!row) throw new AppError(401, "Account not found.");
    const state = row.state as OwnerAccount;
    const result = fn(state);
    await tx`UPDATE agentpass_accounts SET state=${tx.json(state as never)} WHERE id=${id}`;
    return result;
  }) as T;
}
