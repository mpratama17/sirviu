import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Download lampiran scan koreksi manual dari SATU baris reject
 * (`?transition=<stage_transitions.id>`) — beda dari `/download` (versi
 * resmi dokumen di `document_versions`). Sama pola: session client user
 * (bukan admin) supaya `stage_transitions_select` RLS tetap berlaku,
 * redirect ke signed URL (bucket private). `.eq("document_id", id)` di
 * query adalah defense-in-depth (transition harus milik dokumen di URL
 * ini) — bukan trust boundary utamanya (itu tugas RLS).
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/documents/[id]/download-attachment">,
) {
  const { id } = await ctx.params;
  const transitionId = new URL(request.url).searchParams.get("transition");
  if (!transitionId) {
    return NextResponse.json({ error: "Parameter transition wajib diisi." }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("stage_transitions")
    .select("attachment_path, attachment_name")
    .eq("id", transitionId)
    .eq("document_id", id)
    .not("attachment_path", "is", null)
    .maybeSingle();

  if (error || !data || !data.attachment_path) {
    return NextResponse.json(
      { error: "Lampiran tidak ditemukan atau Anda tidak berhak mengakses." },
      { status: 404 },
    );
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("documents")
    .createSignedUrl(data.attachment_path, 60, {
      download: data.attachment_name ?? undefined,
    });

  if (signError || !signed) {
    return NextResponse.json(
      { error: "Gagal membuat link download." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(signed.signedUrl);
}
