import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Workspace } from "./contracts";

const dbUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL;
let sqlClient: ReturnType<typeof postgres> | undefined;
let ready: Promise<void> | undefined;
let localQueue: Promise<unknown> = Promise.resolve();
const localFile = () =>
  path.join(process.cwd(), ".agentpass-private", "local-state.json");

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function databaseKind(): "postgres" | "local" {
  return dbUrl() ? "postgres" : "local";
}
function client() {
  if (!sqlClient)
    sqlClient = postgres(dbUrl()!, {
      max: 3,
      prepare: false,
      idle_timeout: 10,
      connect_timeout: 10,
      ssl: dbUrl()!.includes("localhost") ? false : "require",
    });
  return sqlClient;
}
async function initialize() {
  if (!dbUrl()) {
    if (process.env.VERCEL)
      throw new AppError(503, "Connect a Postgres database to finish setup.");
    return;
  }
  if (!ready)
    ready = (async () => {
      const sql = client();
      await sql`CREATE TABLE IF NOT EXISTS agentpass_workspaces (id text PRIMARY KEY, state jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
      await sql`CREATE TABLE IF NOT EXISTS agentpass_login_attempts (id text PRIMARY KEY, attempts integer NOT NULL, window_start timestamptz NOT NULL DEFAULT now())`;
    })().catch((e) => {
      ready = undefined;
      throw e;
    });
  await ready;
}
export function initialWorkspace(id: string, demo = false): Workspace {
  const now = new Date().toISOString();
  return {
    id,
    demo,
    createdAt: now,
    agent: {
      id: "ap_" + randomUUID().slice(0, 8),
      name: "Atlas",
      description: "Your research agent, with permission to spend.",
      runtime: "Hermes",
      owner: "BuildX Labs",
      status: "active",
      budget: 200000,
      perTransaction: 50000,
      spent: 0,
      reserved: 0,
      policyVersion: 1,
      bindingVersion: 1,
      fundingLabel: "Company account · A",
      allowedServices: ["research", "market", "premium"],
      createdAt: now,
      lastSeen: null,
    },
    payments: [],
    receipts: [],
    events: [
      {
        id: randomUUID(),
        time: now,
        type: "identity",
        title: "AgentPass issued",
        detail:
          "Atlas is ready. Set a budget, connect Hermes, and authorize a purchase.",
        source: "AgentPass",
      },
    ],
  };
}
export function event(
  w: Workspace,
  type: string,
  title: string,
  detail: string,
  source = "AgentPass",
  paymentId?: string,
) {
  w.events.unshift({
    id: randomUUID(),
    time: new Date().toISOString(),
    type,
    title,
    detail,
    source,
    paymentId,
  });
  w.events = w.events.slice(0, 250);
}
export async function mutate<T>(
  id: string,
  fn: (w: Workspace) => T,
  createDemo = false,
): Promise<T> {
  await initialize();
  if (dbUrl()) {
    const sql = client();
    return (await sql.begin(async (tx) => {
      if (id === "owner" || createDemo) {
        if (createDemo) {
          // Bound anonymous rehearsal storage independently of payment funds.
          await tx`SELECT pg_advisory_xact_lock(874201)`;
          const [count] =
            await tx`SELECT count(*)::int AS n FROM agentpass_workspaces`;
          if (count.n >= 1000)
            throw new AppError(
              429,
              "Demo capacity reached. Please use the public showcase.",
            );
        }
        await tx`INSERT INTO agentpass_workspaces (id, state) VALUES (${id}, ${tx.json(initialWorkspace(id, createDemo) as never)}) ON CONFLICT (id) DO NOTHING`;
      }
      const rows =
        await tx`SELECT state FROM agentpass_workspaces WHERE id = ${id} FOR UPDATE`;
      if (!rows.length)
        throw new AppError(404, "Session expired. Start a new demo.");
      const w = rows[0].state as Workspace;
      const result = fn(w);
      await tx`UPDATE agentpass_workspaces SET state = ${tx.json(w as never)} WHERE id = ${id}`;
      return result;
    })) as T;
  }
  const operation = localQueue.then(async () => {
    let all: Record<string, Workspace> = {};
    try {
      all = JSON.parse(await readFile(localFile(), "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    if (!all[id] && (id === "owner" || createDemo))
      all[id] = initialWorkspace(id, createDemo);
    if (!all[id]) throw new AppError(404, "Session expired. Start a new demo.");
    const result = fn(all[id]);
    await mkdir(path.dirname(localFile()), { recursive: true, mode: 0o700 });
    const temp = localFile() + ".tmp";
    await writeFile(temp, JSON.stringify(all), { mode: 0o600 });
    await rename(temp, localFile());
    return result;
  });
  localQueue = operation.catch(() => {});
  return operation;
}
export async function readWorkspace(id: string): Promise<Workspace> {
  await initialize();
  if (!dbUrl()) return mutate(id, (w) => structuredClone(w));
  const rows =
    await client()`SELECT state FROM agentpass_workspaces WHERE id = ${id}`;
  if (rows.length) return rows[0].state as Workspace;
  if (id === "owner") return mutate(id, (w) => structuredClone(w));
  throw new AppError(404, "Session expired. Start a new demo.");
}
const localAttempts = new Map<string, { n: number; start: number }>();
export async function loginAllowed(id: string) {
  await initialize();
  if (dbUrl()) {
    const rows =
      await client()`INSERT INTO agentpass_login_attempts (id, attempts) VALUES (${id}, 1) ON CONFLICT (id) DO UPDATE SET attempts = CASE WHEN agentpass_login_attempts.window_start < now() - interval '15 minutes' THEN 1 ELSE agentpass_login_attempts.attempts + 1 END, window_start = CASE WHEN agentpass_login_attempts.window_start < now() - interval '15 minutes' THEN now() ELSE agentpass_login_attempts.window_start END RETURNING attempts`;
    return rows[0].attempts <= 8;
  }
  const old = localAttempts.get(id),
    current =
      !old || Date.now() - old.start > 900000
        ? { n: 0, start: Date.now() }
        : old;
  current.n++;
  localAttempts.set(id, current);
  return current.n <= 8;
}
