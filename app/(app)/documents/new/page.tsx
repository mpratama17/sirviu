import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { DocumentForm } from "@/components/documents/document-form";
import type { SelectableUser } from "@/components/documents/user-combobox";

export default async function NewDocumentPage() {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("ketua_tim")) {
    redirect("/dashboard");
  }

  // Isolasi tim (masukan user setelah testing, lihat AGENTS.md) — Ketua Tim
  // cuma boleh assign dari anggota timnya sendiri, bukan siapa saja di org.
  // Ditegakkan lagi di RPC create_document, halaman ini cuma UI.
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, roles, is_active")
    .eq("team_ketua_tim_id", user.id)
    .order("name");

  const selectableUsers: SelectableUser[] = (users ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roles: u.roles,
    isActive: u.is_active,
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Upload Dokumen Baru
      </h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Isi nomor surat tugas seperti tertera di dokumen fisik.
      </p>
      <DocumentForm
        users={selectableUsers}
        currentUserId={user.id}
        currentUserName={user.name}
      />
    </div>
  );
}
