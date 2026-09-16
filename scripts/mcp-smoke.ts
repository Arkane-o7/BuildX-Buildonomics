import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";
process.loadEnvFile(".env.local");
const client = new Client({ name: "agentpass-smoke", version: "1.0.0" });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [
      resolve("node_modules/tsx/dist/cli.mjs"),
      resolve("integrations/hermes/server.ts"),
    ],
    env: {
      ...(Object.fromEntries(
        Object.entries(process.env).filter(
          ([k, v]) => v && ["PATH", "HOME", "TMPDIR"].includes(k),
        ),
      ) as Record<string, string>),
      AGENTPASS_URL: process.env.APP_URL!,
      AGENTPASS_AGENT_TOKEN: process.env.AGENTPASS_AGENT_TOKEN!,
    },
  }),
);
const list = await client.listTools();
console.log("MCP tools:", list.tools.map((t) => t.name).join(", "));
const result = await client.callTool({ name: "passport", arguments: {} });
if (result.isError) throw new Error("Passport tool failed");
console.log("Authenticated passport lookup passed.");
await client.close();
