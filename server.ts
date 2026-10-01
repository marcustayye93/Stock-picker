/**
 * Standalone server entry for Railway deployment.
 *
 * - Runs drizzle migrations against SQLite (path from SQLITE_PATH env)
 * - POST /api/actions  -> { action, args } dispatch into Actions handlers
 * - GET  /*           -> static files from ./dist (client build), SPA fallback
 */
import { Actions } from "./server/src/actions";
import { createCtx, runMigrations, getDb } from "./server/src/standalone";

const PORT = Number(process.env.PORT || 3000);
const DIST = "./dist";

runMigrations();
// Touch the DB so the file exists before serving
getDb();
console.log("SQLite ready");

type ActionDef = {
  request: { safeParse: (v: unknown) => { success: boolean; data?: any; error?: any } };
  response: { safeParse: (v: unknown) => { success: boolean; data?: any; error?: any } };
  handler: (ctx: any, args: any) => Promise<any>;
};

const actions = Actions as unknown as Record<string, ActionDef>;

async function handleAction(req: Request): Promise<Response> {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { action, args } = body ?? {};
  const def = typeof action === "string" ? actions[action] : undefined;
  if (!def) {
    return Response.json({ error: `Unknown action: ${action}` }, { status: 404 });
  }
  const parsedArgs = def.request.safeParse(args);
  if (!parsedArgs.success) {
    return Response.json(
      { error: "Invalid request", issues: parsedArgs.error?.issues ?? [] },
      { status: 400 },
    );
  }
  try {
    const result = await def.handler(createCtx(), parsedArgs.data);
    const parsedRes = def.response.safeParse(result);
    if (!parsedRes.success) {
      console.error(`Action ${action} returned invalid response`, parsedRes.error?.issues);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
    return Response.json(parsedRes.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed";
    console.error(`Action ${action} failed:`, message);
    return Response.json({ error: message }, { status: 500 });
  }
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/api/actions" && req.method === "POST") {
      return handleAction(req);
    }
    if (url.pathname === "/api/health") {
      return Response.json({ ok: true });
    }
    // Static files
    let path = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    // Basic path safety
    if (path.includes("..")) return new Response("Not found", { status: 404 });
    const file = Bun.file(DIST + path);
    if (await file.exists()) {
      return new Response(file);
    }
    // SPA fallback
    const index = Bun.file(DIST + "/index.html");
    if (await index.exists()) {
      return new Response(index);
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`Listening on :${PORT}`);
