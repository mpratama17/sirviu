/**
 * PLACEHOLDER — tipe ini ditulis manual mengikuti
 * `supabase/migrations/001_initial_schema.sql` & `002_rls_policies.sql`.
 *
 * Ganti dengan hasil generate asli begitu project sudah di-link:
 *
 *   supabase login
 *   supabase link --project-ref <ref>
 *   supabase gen types typescript --linked > lib/types/database.ts
 *
 * Kolom bertipe `string` (bukan union) di sini sengaja meniru perilaku
 * generator asli — check constraint di Postgres (mis. `status in (...)`)
 * tidak menghasilkan union type, hanya `text`/`string`. Union yang lebih
 * ketat ada di `lib/types/domain.ts` — pakai itu di kode aplikasi, bukan
 * langsung tipe `Database`.
 *
 * `Relationships: []` di setiap tabel WAJIB ada meski kosong — itu bagian
 * dari `GenericTable` constraint di @supabase/postgrest-js. Tanpa itu,
 * seluruh inference `.from(...).select(...)` diam-diam collapse ke `never`
 * (pernah kejadian, lihat git blame / AGENTS.md).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          roles: string[];
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          roles?: string[];
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          roles?: string[];
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          nomor_surat_tugas: string;
          nama_laporan: string;
          submitter_id: string;
          ketua_tim_id: string;
          dalnis_id: string;
          dalmut_id: string;
          operator_id: string;
          current_stage: number;
          status: string;
          created_at: string;
          finalized_at: string | null;
          current_stage_started_at: string;
        };
        Insert: {
          id?: string;
          nomor_surat_tugas: string;
          nama_laporan: string;
          submitter_id: string;
          ketua_tim_id: string;
          dalnis_id: string;
          dalmut_id: string;
          operator_id: string;
          current_stage?: number;
          status?: string;
          created_at?: string;
          finalized_at?: string | null;
          current_stage_started_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [];
      };
      document_versions: {
        Row: {
          id: string;
          document_id: string;
          version_number: number;
          file_path: string;
          file_name: string;
          file_size: number;
          mime_type: string;
          uploaded_by: string;
          uploaded_at: string;
          upload_notes: string | null;
        };
        Insert: {
          id?: string;
          document_id: string;
          version_number: number;
          file_path: string;
          file_name: string;
          file_size: number;
          mime_type: string;
          uploaded_by: string;
          uploaded_at?: string;
          upload_notes?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["document_versions"]["Insert"]
        >;
        Relationships: [];
      };
      stage_transitions: {
        Row: {
          id: string;
          document_id: string;
          version_id: string | null;
          from_stage: number | null;
          to_stage: number;
          action: string;
          actor_id: string;
          comment: string | null;
          target_stage_on_reject: number | null;
          is_superseded: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          version_id?: string | null;
          from_stage?: number | null;
          to_stage: number;
          action: string;
          actor_id: string;
          comment?: string | null;
          target_stage_on_reject?: number | null;
          is_superseded?: boolean;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["stage_transitions"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      is_assigned_to_document: {
        Args: { p_user_id: string; p_document_id: string };
        Returns: boolean;
      };
      create_document: {
        Args: {
          p_document_id: string;
          p_nomor_surat_tugas: string;
          p_nama_laporan: string;
          p_ketua_tim_id: string;
          p_dalnis_id: string;
          p_dalmut_id: string;
          p_operator_id: string;
          p_file_path: string;
          p_file_name: string;
          p_file_size: number;
          p_mime_type: string;
          p_upload_notes?: string | null;
        };
        Returns: Database["public"]["Tables"]["documents"]["Row"];
      };
      submit_document: {
        Args: { p_document_id: string; p_comment?: string | null };
        Returns: Database["public"]["Tables"]["documents"]["Row"];
      };
      approve_review: {
        Args: { p_document_id: string; p_comment?: string | null };
        Returns: Database["public"]["Tables"]["documents"]["Row"];
      };
      reject_review: {
        Args: {
          p_document_id: string;
          p_target_stage: number;
          p_comment: string;
        };
        Returns: Database["public"]["Tables"]["documents"]["Row"];
      };
      finalize_document: {
        Args: { p_document_id: string; p_comment?: string | null };
        Returns: Database["public"]["Tables"]["documents"]["Row"];
      };
      format_fix_and_finalize: {
        Args: {
          p_document_id: string;
          p_file_path: string;
          p_file_name: string;
          p_file_size: number;
          p_mime_type: string;
          p_comment?: string | null;
        };
        Returns: Database["public"]["Tables"]["documents"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
