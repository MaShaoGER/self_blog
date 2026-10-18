import type { Metadata } from "next";
import { listUploads } from "@/lib/uploads";
import { AdminPage, PageHeader } from "@/components/admin/page-header";
import { MediaLibrary } from "@/components/admin/media-library";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "图库" };

export default async function MediaPage() {
  const items = await listUploads();
  return (
    <AdminPage className="max-w-[72rem]">
      <PageHeader
        title="图库"
        description="上传的图片会自动转成 WebP、去掉位置信息，长边不超过 2400 像素。"
      />
      <MediaLibrary initial={items} />
    </AdminPage>
  );
}
