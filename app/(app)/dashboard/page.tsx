import { FolderOpen } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/session";

/**
 * Placeholder Milestone 1 — deliverable-nya cuma "login berhasil, redirect
 * ke dashboard kosong". List dokumen sungguhan + filter + search dibangun
 * di Milestone 2 (brief §9).
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Dashboard
      </h1>
      <p className="text-sm text-muted-foreground">
        Selamat datang, {user?.name}.
      </p>

      <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-24 text-center">
        <FolderOpen className="size-10 text-text-muted" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Belum ada dokumen. Dokumen yang Anda submit atau di mana Anda
          ditunjuk sebagai reviewer akan muncul di sini.
        </p>
      </div>
    </div>
  );
}
