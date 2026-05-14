export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: 'super_admin' | 'admin' | 'teacher'
          full_name: string
          email: string
          phone: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: 'super_admin' | 'admin' | 'teacher'
          full_name: string
          email: string
          phone?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          role?: 'super_admin' | 'admin' | 'teacher'
          full_name?: string
          email?: string
          phone?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          status: 'trial' | 'active' | 'overdue' | 'blocked' | 'canceled'
          plan: string
          provider: 'manual' | 'stripe' | 'mercado_pago' | 'other'
          external_reference: string | null
          trial_expires_at: string | null
          current_period_end: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          status?: 'trial' | 'active' | 'overdue' | 'blocked' | 'canceled'
          plan?: string
          provider?: 'manual' | 'stripe' | 'mercado_pago' | 'other'
          external_reference?: string | null
          trial_expires_at?: string | null
          current_period_end?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'trial' | 'active' | 'overdue' | 'blocked' | 'canceled'
          plan?: string
          provider?: 'manual' | 'stripe' | 'mercado_pago' | 'other'
          external_reference?: string | null
          trial_expires_at?: string | null
          current_period_end?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      schools: {
        Row: {
          id: string
          owner_id: string
          name: string
          city: string | null
          state: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          city?: string | null
          state?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          city?: string | null
          state?: string | null
          updated_at?: string
        }
      }
      classes: {
        Row: {
          id: string
          owner_id: string
          school_id: string | null
          name: string
          shift: string | null
          age_group: string | null
          school_year: number
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          school_id?: string | null
          name: string
          shift?: string | null
          age_group?: string | null
          school_year?: number
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          school_id?: string | null
          name?: string
          shift?: string | null
          age_group?: string | null
          school_year?: number
          archived_at?: string | null
          updated_at?: string
        }
      }
      students: {
        Row: {
          id: string
          owner_id: string
          class_id: string
          full_name: string
          birth_date: string | null
          photo_path: string | null
          photo_position: string
          notes_private: string | null
          support_tags: string[]
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          class_id: string
          full_name: string
          birth_date?: string | null
          photo_path?: string | null
          photo_position?: string
          notes_private?: string | null
          support_tags?: string[]
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          full_name?: string
          birth_date?: string | null
          photo_path?: string | null
          photo_position?: string
          notes_private?: string | null
          support_tags?: string[]
          archived_at?: string | null
          updated_at?: string
        }
      }
      annotations: {
        Row: {
          id: string
          owner_id: string
          category: 'evolucao' | 'plano' | 'portfolio' | 'projeto' | 'formacao' | 'carta' | 'atipico'
          body: string
          tags: string[]
          persistence: Array<'relatorio-atual' | 'proximo-relatorio' | 'observacao-continua' | 'planejamento-futuro' | 'observacao-importante' | 'evolucao-positiva'>
          attachment_path: string | null
          occurred_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          category: 'evolucao' | 'plano' | 'portfolio' | 'projeto' | 'formacao' | 'carta' | 'atipico'
          body: string
          tags?: string[]
          persistence?: Array<'relatorio-atual' | 'proximo-relatorio' | 'observacao-continua' | 'planejamento-futuro' | 'observacao-importante' | 'evolucao-positiva'>
          attachment_path?: string | null
          occurred_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          category?: 'evolucao' | 'plano' | 'portfolio' | 'projeto' | 'formacao' | 'carta' | 'atipico'
          body?: string
          tags?: string[]
          persistence?: Array<'relatorio-atual' | 'proximo-relatorio' | 'observacao-continua' | 'planejamento-futuro' | 'observacao-importante' | 'evolucao-positiva'>
          attachment_path?: string | null
          occurred_at?: string
          updated_at?: string
        }
      }
      annotation_targets: {
        Row: {
          id: string
          annotation_id: string
          owner_id: string
          target_type: 'student' | 'class' | 'school' | 'teacher'
          target_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          annotation_id: string
          owner_id: string
          target_type: 'student' | 'class' | 'school' | 'teacher'
          target_id?: string | null
          created_at?: string
        }
        Update: {
          target_type?: 'student' | 'class' | 'school' | 'teacher'
          target_id?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
