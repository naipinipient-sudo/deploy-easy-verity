export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          citations: Json
          created_at: string
          id: string
          model: string | null
          prompt: string
          response: string | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          citations?: Json
          created_at?: string
          id?: string
          model?: string | null
          prompt: string
          response?: string | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          citations?: Json
          created_at?: string
          id?: string
          model?: string | null
          prompt?: string
          response?: string | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          object_id: string | null
          object_type: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          object_id?: string | null
          object_type?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          object_id?: string | null
          object_type?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      compare_runs: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          keys: Json
          left_version_id: string
          results: Json
          right_version_id: string
          summary: Json
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          keys?: Json
          left_version_id: string
          results?: Json
          right_version_id: string
          summary?: Json
          workspace_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          keys?: Json
          left_version_id?: string
          results?: Json
          right_version_id?: string
          summary?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compare_runs_left_version_id_fkey"
            columns: ["left_version_id"]
            isOneToOne: false
            referencedRelation: "dataset_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compare_runs_right_version_id_fkey"
            columns: ["right_version_id"]
            isOneToOne: false
            referencedRelation: "dataset_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compare_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dataset_rows: {
        Row: {
          id: number
          normalized: Json
          raw: Json
          row_index: number
          version_id: string
          workspace_id: string
        }
        Insert: {
          id?: number
          normalized?: Json
          raw: Json
          row_index: number
          version_id: string
          workspace_id: string
        }
        Update: {
          id?: number
          normalized?: Json
          raw?: Json
          row_index?: number
          version_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dataset_rows_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "dataset_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dataset_rows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dataset_versions: {
        Row: {
          checksum: string | null
          columns: Json
          created_at: string
          dataset_id: string
          file_name: string
          id: string
          mapping: Json
          mapping_confirmed: boolean
          parse_warnings: Json
          row_count: number
          schema_profile: Json
          sheet_name: string | null
          uploaded_by: string | null
          version_no: number
          workspace_id: string
        }
        Insert: {
          checksum?: string | null
          columns?: Json
          created_at?: string
          dataset_id: string
          file_name: string
          id?: string
          mapping?: Json
          mapping_confirmed?: boolean
          parse_warnings?: Json
          row_count?: number
          schema_profile?: Json
          sheet_name?: string | null
          uploaded_by?: string | null
          version_no?: number
          workspace_id: string
        }
        Update: {
          checksum?: string | null
          columns?: Json
          created_at?: string
          dataset_id?: string
          file_name?: string
          id?: string
          mapping?: Json
          mapping_confirmed?: boolean
          parse_warnings?: Json
          row_count?: number
          schema_profile?: Json
          sheet_name?: string | null
          uploaded_by?: string | null
          version_no?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dataset_versions_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dataset_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          source_type: string
          status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          source_type?: string
          status?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          source_type?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "datasets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      master_datasets: {
        Row: {
          created_at: string
          created_by: string | null
          definition: Json
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_datasets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      master_rows: {
        Row: {
          data: Json
          id: number
          lineage: Json
          master_version_id: string
          row_index: number
          workspace_id: string
        }
        Insert: {
          data: Json
          id?: number
          lineage?: Json
          master_version_id: string
          row_index: number
          workspace_id: string
        }
        Update: {
          data?: Json
          id?: number
          lineage?: Json
          master_version_id?: string
          row_index?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_rows_master_version_id_fkey"
            columns: ["master_version_id"]
            isOneToOne: false
            referencedRelation: "master_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_rows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      master_versions: {
        Row: {
          build_rules: Json
          created_at: string
          id: string
          inputs: Json
          master_id: string
          published: boolean
          published_at: string | null
          published_by: string | null
          row_count: number
          version_no: number
          workspace_id: string
        }
        Insert: {
          build_rules?: Json
          created_at?: string
          id?: string
          inputs?: Json
          master_id: string
          published?: boolean
          published_at?: string | null
          published_by?: string | null
          row_count?: number
          version_no?: number
          workspace_id: string
        }
        Update: {
          build_rules?: Json
          created_at?: string
          id?: string
          inputs?: Json
          master_id?: string
          published?: boolean
          published_at?: string | null
          published_by?: string | null
          row_count?: number
          version_no?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_versions_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "master_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      quality_findings: {
        Row: {
          created_at: string
          evidence: Json
          field: string | null
          id: string
          impacted_rows: number
          message: string
          resolution_note: string | null
          rule: string
          severity: string
          status: string
          version_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          evidence?: Json
          field?: string | null
          id?: string
          impacted_rows?: number
          message: string
          resolution_note?: string | null
          rule: string
          severity?: string
          status?: string
          version_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          evidence?: Json
          field?: string | null
          id?: string
          impacted_rows?: number
          message?: string
          resolution_note?: string | null
          rule?: string
          severity?: string
          status?: string
          version_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_findings_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "dataset_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_findings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_items: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          explanation: Json
          id: string
          left_row: Json | null
          note: string | null
          right_row: Json | null
          run_id: string
          score: number
          state: string
          workspace_id: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          explanation?: Json
          id?: string
          left_row?: Json | null
          note?: string | null
          right_row?: Json | null
          run_id: string
          score?: number
          state?: string
          workspace_id: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          explanation?: Json
          id?: string
          left_row?: Json | null
          note?: string | null
          right_row?: Json | null
          run_id?: string
          score?: number
          state?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_runs: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          left_version_id: string
          right_version_id: string
          status: string
          summary: Json
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          left_version_id: string
          right_version_id: string
          status?: string
          summary?: Json
          workspace_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          left_version_id?: string
          right_version_id?: string
          status?: string
          summary?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_runs_left_version_id_fkey"
            columns: ["left_version_id"]
            isOneToOne: false
            referencedRelation: "dataset_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_runs_right_version_id_fkey"
            columns: ["right_version_id"]
            isOneToOne: false
            referencedRelation: "dataset_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          currency: string
          id: string
          name: string
          owner_id: string
          timezone: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          name: string
          owner_id: string
          timezone?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          name?: string
          owner_id?: string
          timezone?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write_workspace: { Args: { _workspace_id: string }; Returns: boolean }
      is_workspace_admin: { Args: { _workspace_id: string }; Returns: boolean }
      is_workspace_member: { Args: { _workspace_id: string }; Returns: boolean }
    }
    Enums: {
      workspace_role: "owner" | "admin" | "editor" | "analyst" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      workspace_role: ["owner", "admin", "editor", "analyst", "viewer"],
    },
  },
} as const
