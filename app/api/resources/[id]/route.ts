import { getSession } from "@/lib/auth";
import { ResourcesDataError, getResource } from "@/lib/resources";
import type { ResourceSummary } from "@/shared/resource-types";

const HEADERS = { "Cache-Control": "private, no-store" };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: HEADERS });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await ctx.params;
  try {
    const record = await getResource(id, session !== null);
    if (!record) return json({ error: "资源不存在" }, 404);
    const { source: _source, ...summary } = record;
    return json(summary as ResourceSummary);
  } catch (error) {
    if (error instanceof ResourcesDataError) return json({ error: "资源数据无法读取" }, 500);
    console.error("resource read failed", error);
    return json({ error: "资源读取失败" }, 500);
  }
}
