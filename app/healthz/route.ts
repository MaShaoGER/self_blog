import { DATA_DIR } from "@/lib/env";
import { checkDataHealth } from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await checkDataHealth(DATA_DIR);
    return Response.json({ status: "healthy" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unhealthy" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
