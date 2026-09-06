import { appendFileSync } from "node:fs";

export async function POST(request: Request) {
  const payload = await request.json();
  // #region agent log
  appendFileSync(
    "/opt/cursor/logs/debug.log",
    `${JSON.stringify({ ...payload, timestamp: Date.now() })}\n`
  );
  // #endregion
  return new Response(null, { status: 204 });
}
