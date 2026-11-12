import { getSession } from "@/lib/auth";
import {
  ResourceAccessError,
  ResourceValidationError,
  ResourcesDataError,
  resolveResourceAccess,
} from "@/lib/resources";

const HEADERS = { "Cache-Control": "private, no-store" };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: HEADERS });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await ctx.params;
  try {
    const source = await resolveResourceAccess(id, session !== null, "download");
    if (source.type !== "direct") return json({ error: "嵌入式视频不支持直接下载" }, 400);
    return new Response(null, {
      status: 302,
      headers: {
        ...HEADERS,
        "Referrer-Policy": "no-referrer",
        Location: source.url,
      },
    });
  } catch (error) {
    if (error instanceof ResourceAccessError) return json({ error: error.message }, error.status);
    if (error instanceof ResourceValidationError) return json({ error: error.message }, 400);
    if (error instanceof ResourcesDataError) return json({ error: "资源数据无法读取" }, 500);
    console.error("resource download failed", error);
    return json({ error: "资源下载失败" }, 500);
  }
}
