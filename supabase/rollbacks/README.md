# Rollbacks

Scripts di folder ini **TIDAK di-auto-apply** oleh Supabase CLI (folder di
luar `supabase/migrations/`). Jalankan manual dari Supabase Dashboard SQL
Editor atau `psql` bila memang perlu rollback.

Setiap file diberi nama `YYYY-MM-DD-<deskripsi>.sql` mengikuti migration
forward-nya. Baca komentar di paling atas file untuk konteks lengkap.

## Panduan umum sebelum rollback

1. **Konfirmasi lagi dengan tim** — rollback destructive (mengembalikan data
   ke snapshot berarti membuang perubahan setelah snapshot).
2. **Backup manual dulu** kalau ada perubahan setelah migration yang mau
   dipertahankan — bisa dari Supabase Dashboard → Database → Backups.
3. **Deploy code lama** ke Vercel dulu (revert commit + `vercel --prod`)
   supaya UI tidak "berbicara" ke schema baru yang barusan di-rollback.
4. Baru jalankan rollback SQL di sini.
