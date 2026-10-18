import { assertAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/request";
import { MAX_UPLOAD_BYTES, UploadError, saveUpload } from "@/lib/uploads";

export async function POST(req: Request) {
  try {
    await assertSameOrigin(req);
    await assertAdmin();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) {
    return Response.json({ error: "图片不能超过 15 MB" }, { status: 413 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return Response.json({ error: "上传内容无法解析" }, { status: 400 });
  }
  if (!(file instanceof File)) return Response.json({ error: "没有收到文件" }, { status: 400 });

  try {
    const item = await saveUpload(Buffer.from(await file.arrayBuffer()));
    return Response.json(item);
  } catch (err) {
    if (err instanceof UploadError) return Response.json({ error: err.message }, { status: 400 });
    console.error("upload failed", err);
    return Response.json({ error: "图片处理失败，请换一张试试" }, { status: 500 });
  }
}
