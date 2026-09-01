# SIRVIU — Progress Snapshot

Last updated: 2026-09-01, dari close-out review setelah PR #7 (README +
screenshot). Untuk histori keputusan & alasan di balik tiap perubahan, baca
`AGENTS.md` — file ini cuma snapshot status saat ini, bukan log.

## Status: deployed, live, dipakai user asli

- **Live:** [sirviu.vercel.app](https://sirviu.vercel.app) (Vercel,
  git-integrated — push ke `main` auto-deploy).
- **Repo:** `mpratama17/sirviu`, **private** di GitHub (dikonfirmasi lewat
  `gh repo view` — README menyebut "public-for-portfolio intent" tapi
  visibility aktualnya masih private; belum ada keputusan final soal ini).
  `main` protected — wajib lewat PR + status check "Typecheck, lint,
  build", push langsung ke `main` ditolak GitHub.
- **DB:** 16 migrations diterapkan ke Supabase remote (tidak ada local
  Supabase sandbox — proyek ini sengaja tidak pakai `supabase start`).
- **Fitur inti selesai:** state machine 5-stage (redesign dari 7-stage
  awal, per feedback pilot user), admin override + hard-delete + metadata
  edit, multi-team workspace isolation (RLS + RPC, bukan cuma filter UI)
  dengan audit trail (`team_membership_log`), audit trail dokumen
  append-only, email/password + Google OAuth.
- **CI:** GitHub Actions (typecheck, lint, build) aktif sejak commit `#1`.
- **Close-out review selesai** untuk fitur multi-team isolation + admin
  team panel (`/code-review` + `/security-review` manual atas diff
  ter-scope, lihat detail di bawah) — 6 temuan nyata diperbaiki + 1 tabel
  audit trail baru dibangun, 2 duplication findings kecil sengaja
  diskip (lihat "Diskip" di bawah).

## Diketahui belum diverifikasi / pending

- `sirviu-scaffold-tmp/` di root Porto (di luar repo ini) — leftover
  node_modules dari percobaan scaffold awal (28 Agu), tidak dipakai lagi,
  kandidat dihapus. **Belum dieksekusi — tunggu keputusan user.**
- Keputusan tracking `AGENTS.md`/`CLAUDE_CODE_BRIEF.md`/`DESIGN_BRIEF.md`/
  `.claude/` ke git masih pending — sengaja tetap gitignored sampai ada
  keputusan final. **Jangan dieksekusi sendiri.**
- `team_membership_log` baru dicatat, belum ada UI yang menampilkannya
  (sama seperti `document_edit_log` awalnya) — surfacing ke `/admin/audit`
  menyusul kalau dibutuhkan, bukan blocker.

## Diskip (dipertimbangkan, sengaja tidak dikerjakan)

- **Duplikasi helper `initials()`** — sekarang di 7 file (5 pre-existing +
  2 dari fitur tim). Konsolidasi butuh menyentuh 5 file di luar scope
  fitur tim, jadi di luar scope close-out ini — bukan lupa.
- **`team-manager.tsx`/`admin-teams-panel.tsx` near-duplicate** dan
  **`lib/actions/team.ts` dua cabang mirip di `addTeamMember`** — DRY
  murni, tidak ada bug/regresi di baliknya. Solo project kecil, belum
  worth abstraksi baru (YAGNI) — revisit kalau ada perubahan ketiga yang
  harus diterapkan dua kali dan mulai terasa sakit.

## Referensi

- Arsitektur & decision log: `AGENTS.md`
- Spec awal: `CLAUDE_CODE_BRIEF.md` (implementasi), `DESIGN_BRIEF.md` (visual/UX)
- Convention lintas-proyek: `../CLAUDE.md`
