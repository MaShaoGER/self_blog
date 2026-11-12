import { getSession } from "@/lib/auth";
import { ResourceValidationError, ResourcesDataError, listResourceChildren } from "@/lib/resources";

const HEADERS = { "Cache-Control": "private, no-store" };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: HEADERS });
}

export async function GET(req: Request) {
  const session = await getSession();
  const url = new URL(req.url);
  const rawParent = url.searchParams.get("parentId");
  const parentId = rawParent === null || rawParent === "" ? null : rawParent;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  try {
    const listing = await listResourceChildren(parentId, session !== null, cursor || undefined);
    return json(listing);
  } catch (error) {
    if (error instanceof ResourceValidationError) {
      return json({ error: error.message, field: error.field }, error.field === "parentId" ? 404 : 400);
    }
    if (error instanceof ResourcesDataError) return json({ error: "资源数据无法读取" }, 500);
    console.error("resource listing failed", error);
    return json({ error: "资源列表读取失败" }, 500);
  }
}
