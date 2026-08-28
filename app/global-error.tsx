"use client";

/**
 * Fallback paling akhir — dipakai kalau root layout sendiri gagal render.
 * WAJIB definisikan <html>/<body> sendiri dan TIDAK bisa pakai
 * globals.css/Tailwind (dokumen ini menggantikan root layout sepenuhnya,
 * bukan dirender di dalamnya) — jadi styling inline, sengaja minimalis.
 */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <p style={{ fontSize: "14px", fontWeight: 600, margin: 0 }}>
          SIRVIU mengalami kesalahan.
        </p>
        <p style={{ fontSize: "14px", color: "#475569", margin: 0 }}>
          Silakan muat ulang halaman.
        </p>
        <button
          onClick={() => retry()}
          style={{
            marginTop: "8px",
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            background: "#1e40af",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Coba Lagi
        </button>
      </body>
    </html>
  );
}
