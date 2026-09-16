import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const base = process.env.AGENTPASS_URL?.replace(/\/$/, "");
const token = process.env.AGENTPASS_AGENT_TOKEN;
if (!base || !token)
  throw new Error(
    "AGENTPASS_URL and AGENTPASS_AGENT_TOKEN are required. Use the event launcher.",
  );
const parsed = new URL(base);
if (
  parsed.protocol !== "https:" &&
  !(
    parsed.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(parsed.hostname)
  )
)
  throw new Error("Use HTTPS except for local development.");
async function call(path: string, body?: unknown) {
  try {
    const r = await fetch(`${base}/api/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(28000),
    });
    const data = await r.json();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data) }],
      isError: !r.ok,
    };
  } catch {
    return {
      content: [
        {
          type: "text" as const,
          text: "AgentPass could not respond. Query the SAME request ID before retrying. Never create a replacement request ID for an uncertain purchase.",
        },
      ],
      isError: true,
    };
  }
}
const server = new McpServer({ name: "agentpass", version: "1.0.0" });
server.tool(
  "passport",
  "Get your stable AgentPass identity, current budget, authority and payment environment. Check before purchasing. All numeric amounts are integer PAISE (divide by 100 for rupees); use the formatted remaining field when reporting the budget.",
  {},
  () => call("passport"),
);
server.tool(
  "services",
  "List the integrated sample services and authoritative INR prices. These are event demonstration services, not arbitrary third-party vendors.",
  {},
  () => call("services"),
);
server.tool(
  "purchase",
  "Request a purchase subject to owner policy. Reuse requestId on retries. An approved request returns a checkout URL for the HUMAN payer; never claim it is paid until status is paid. Live mode moves real money only after payer confirmation.",
  {
    serviceId: z.enum(["research", "market", "premium", "unapproved"]),
    rail: z.enum(["upi", "card"]),
    requestId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,100}$/)
      .describe(
        "A unique stable ID for this intent. Reuse exactly on every retry.",
      ),
  },
  (input) => call("payments", input),
);
server.tool(
  "payment_status",
  "Get an existing purchase by its payment ID or original request ID. Return service result and receipt only after confirmed payment.",
  { requestId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/) },
  ({ requestId }) => call(`payments/${encodeURIComponent(requestId)}`),
);
await server.connect(new StdioServerTransport());
