# SIRVIU — Progress Snapshot

Last updated: 2026-09-09, dari rekap close-out setelah PR #14–#21 (seminggu
terakhir). Untuk histori keputusan & alasan di balik tiap perubahan, baca
`AGENTS.md` — file ini cuma snapshot status saat ini, bukan log.

## Status: deployed, live, dipakai user asli (sudah didemokan)

- **Live:** [sirviu.vercel.app](https://sirviu.vercel.app) (Vercel,
  git-integrated — push ke `main` auto-deploy).
- **Repo:** `mpratama17/sirviu`, **public** di GitHub (dibuka public
  2026-09-08, sudah dicek bersih dari secret/`.env` sebelumnya). `main`
  protected — wajib lewat PR + status check "Typecheck, lint, build",
  push langsung ke `main` ditolak GitHub.
- **DB:** 20 migrations diterapkan ke Supabase remote (tidak ada local
  Supabase sandbox — proyek ini sengaja tidak pakai `supabase start`).
- **Demo ke calon user**: sudah jalan (Jumat, 2026-09-05), feedback masuk
  → jadi permintaan fitur lampiran scan (lihat di bawah).

### Dikerjakan minggu ini (PR #14–#21, semua merged)

- **#17 — 2 bug audit-trail/notifikasi**, ditemukan dari testing manual
  prod: `revise_and_forward` mencatat lompatan stage sebagai self-loop
  (jejak audit "bolong"); notifikasi "perlu tindakan" tidak pernah
  otomatis clear walau aksinya sudah dieksekusi (cuma bisa lewat klik
  manual di lonceng). Keduanya diverifikasi live sebelum & sesudah fix.
- **#18/#19/#20 — 5 to-do UX** dari sesi testing manual sebelum demo:
  Nama Laporan bisa diklik, toast berwarna sesuai jenis pesan (aktifkan
  `richColors` sonner yang sudah ada tapi belum di-set), loading
  indicator di toggle/pagination/sort, sticky section-progress nav di
  form upload (pengganti breadcrumbs — breadcrumb literal tidak cocok
  buat halaman single-page multi-section), typography pass (samakan
  ukuran judul card), dan highlight dokumen belum dibuka/perlu tindakan
  di dashboard (reuse tabel `notifications` yang sudah ada, tanpa RPC
  baru).
- **#21 — Lampiran scan PDF koreksi manual** di aksi "Kembalikan untuk
  Revisi" — permintaan user pasca-demo. Didiskusikan dulu (lampiran
  pelengkap bukan versi dokumen resmi, opsional, berlaku di semua titik
  reject) sebelum implementasi. Signature `reject_review` berubah +4
  parameter opsional — pakai pola drop-then-create (bukan cuma
  create-or-replace) supaya tidak jadi overload ambiguous, pelajaran
  yang sama dari `assign_team_member`.
- **#14/#15/#16** (sebelum sesi ini): admin bisa mengosongkan role user;
  screenshot README & panduan pengguna di-refresh + perbaikan kebocoran
  PII di salah satu gambar lama.

- **Fitur inti (dari sebelumnya, masih berlaku)**: state machine 5-stage,
  admin override + hard-delete + metadata edit, multi-team workspace
  isolation (RLS + RPC) dengan audit trail (`team_membership_log`), audit
  trail dokumen append-only, email/password + Google OAuth.
- **CI:** GitHub Actions (typecheck, lint, build) aktif sejak commit `#1`.

## Diketahui belum diverifikasi / pending

- **Data lama**: beberapa dokumen yang dibuat SEBELUM migration
  `20260903000002` (auto-clear notifikasi) masih punya notifikasi unread
  duplikat dari sebelum fix — fix itu cuma berlaku ke transisi baru,
  tidak retroaktif. Tidak berdampak fungsional, cuma kosmetik kalau ada
  yang cek data lama.
- **Roster tim demo bergeser**: akun dalnis.demo/dalmut.demo/
  operator.demo saat ini tercatat di tim milik akun asli
  (`parulianmanulang31@gmail.com`), bukan di tim `kt.demo` — kemungkinan
  sisa testing manual sebelumnya. Belum dirapikan, user sudah diberitahu.
- Keputusan tracking `AGENTS.md`/`CLAUDE_CODE_BRIEF.md`/`DESIGN_BRIEF.md`/
  `.claude/` ke git masih pending — sengaja tetap gitignored sampai ada
  keputusan final. **Jangan dieksekusi sendiri.**
- `team_membership_log` baru dicatat, belum ada UI yang menampilkannya
  (sama seperti `document_edit_log` awalnya) — surfacing ke `/admin/audit`
  menyusul kalau dibutuhkan, bukan blocker.

## Diskip (dipertimbangkan, sengaja tidak dikerjakan)

- **Duplikasi helper `initials()`** — sekarang di 7 file. Konsolidasi
  butuh menyentuh banyak file di luar scope tiap fitur yang lewat —
  bukan lupa, revisit kalau mulai terasa sakit.
- **`team-manager.tsx`/`admin-teams-panel.tsx` near-duplicate** dan
  **`lib/actions/team.ts` dua cabang mirip di `addTeamMember`** — DRY
  murni, tidak ada bug/regresi di baliknya. Solo project kecil, belum
  worth abstraksi baru (YAGNI).

## Referensi

- Arsitektur & decision log: `AGENTS.md`
- Spec awal: `CLAUDE_CODE_BRIEF.md` (implementasi, termasuk to-do UX §10),
  `DESIGN_BRIEF.md` (visual/UX)
- Convention lintas-proyek: `../CLAUDE.md`
