"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markDocumentNotificationsRead } from "@/lib/actions/notifications";

/**
 * Dirender (tidak render apa pun secara visual) di halaman detail dokumen.
 * Sekali saat mount, mark semua notifikasi milik user untuk dokumen ini
 * jadi read + `router.refresh()` — sama persis pola di `notification-bell.tsx`.
 *
 * Kenapa bukan langsung ditulis di server component page-nya: write yang
 * terjadi di tengah render Server Component tidak memicu apa pun di
 * client — bel notifikasi (di layout, segment tetangga) tidak akan ikut
 * ter-refresh sampai ada navigasi client-side yang memicu refetch. Client
 * effect + `router.refresh()` adalah satu-satunya jalur yang benar-benar
 * menyegarkan bel & dashboard sesudahnya.
 *
 * Tidak ada guard anti double-fire (mis. React StrictMode): update-nya
 * `where read_at is null`, jadi panggilan kedua otomatis no-op.
 */
export function MarkReadOnView({ documentId }: { documentId: string }) {
  const router = useRouter();

  useEffect(() => {
    markDocumentNotificationsRead(documentId).then((result) => {
      if (result.success) router.refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sekali per mount, documentId tidak berubah tanpa remount (key beda per halaman)
  }, []);

  return null;
}
