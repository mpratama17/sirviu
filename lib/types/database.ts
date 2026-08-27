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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
