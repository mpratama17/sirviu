import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Download versi dokumen. Default versi terbaru, atau `?v=<version_number>`
 * untuk versi spesifik (dipakai version-selector di detail page nanti).
 * Redirect ke signed URL (bucket private, brief §4.5) — pakai session
 * client user, bukan admin, supaya storage RLS (assigned/admin/finalized)
 * tetap berlaku. Query yang tidak match (dokumen tidak ada / tidak berhak)
 * otomatis kosong lewat RLS, dilaporkan sebagai 404 generik (tidak bocorkan
 * mana dari dua alasan itu yang sebenarnya terjadi).
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/documents/[id]/download">,
) {
  const { id } = await ctx.params;
  const versionParam = new URL(request.url).searchParams.get("v");

  const supabase = await createClient();

  let query = supabase
    .from("document_versions")
    .select("file_path, file_name")
    .eq("document_id", id)
    .order("version_number", { ascending: false })
    .limit(1);

  if (versionParam) {
    const versionNumber = Number(versionParam);
    if (!Number.isInteger(versionNumber)) {
      return NextResponse.json({ error: "Versi tidak valid." }, { status: 400 });
    }
    query = supabase
      .from("document_versions")
      .select("file_path, file_name")
      .eq("document_id", id)
      .eq("version_number", versionNumber)
      .limit(1);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: "Dokumen tidak ditemukan atau Anda tidak berhak mengakses." },
      { status: 404 },
    );
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("documents")
    .createSignedUrl(data.file_path, 60, { download: data.file_name });

  if (signError || !signed) {
    return NextResponse.json(
      { error: "Gagal membuat link download." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(signed.signedUrl);
}
