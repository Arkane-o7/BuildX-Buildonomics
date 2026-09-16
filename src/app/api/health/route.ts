export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(
    {
      status: process.env.EVENT_DISABLED === "true" ? "disabled" : "ok",
      app: "AgentPass",
      paymentMode: process.env.PAYMENT_MODE || "rehearsal",
      databaseConfigured: Boolean(
        process.env.DATABASE_URL || process.env.POSTGRES_URL,
      ),
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
