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

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "请求内容无法解析" }, 400);
  }
  const purpose = typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>).purpose
    : undefined;
  if (purpose !== "preview" && purpose !== "download") {
    return json({ error: "purpose 必须为 preview 或 download" }, 400);
  }

  try {
    const source = await resolveResourceAccess(id, session !== null, purpose);
    return json(source);
  } catch (error) {
    if (error instanceof ResourceAccessError) return json({ error: error.message }, error.status);
    if (error instanceof ResourceValidationError) return json({ error: error.message }, 400);
    if (error instanceof ResourcesDataError) return json({ error: "资源数据无法读取" }, 500);
    console.error("resource access failed", error);
    return json({ error: "资源访问失败" }, 500);
  }
}
