export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      areas: {
        Row: {
          archived_at: string | null;
          color: string;
          created_at: string;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "areas_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      focus_sessions: {
        Row: {
          created_at: string;
          duration_seconds: number;
          ended_at: string;
          id: string;
          session_type: Database["public"]["Enums"]["focus_session_type"];
          started_at: string;
          task_id: string | null;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          duration_seconds: number;
          ended_at: string;
          id?: string;
          session_type?: Database["public"]["Enums"]["focus_session_type"];
          started_at: string;
          task_id?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          duration_seconds?: number;
          ended_at?: string;
          id?: string;
          session_type?: Database["public"]["Enums"]["focus_session_type"];
          started_at?: string;
          task_id?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "focus_sessions_task_id_workspace_id_fkey";
            columns: ["task_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "focus_sessions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      goals: {
        Row: {
          area_id: string | null;
          created_at: string;
          current_value: number | null;
          description: string | null;
          id: string;
          sort_order: number;
          start_date: string | null;
          status: Database["public"]["Enums"]["goal_status"];
          target_date: string | null;
          target_value: number | null;
          title: string;
          unit: string | null;
          updated_at: string;
          why: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          area_id?: string | null;
          created_at?: string;
          current_value?: number | null;
          description?: string | null;
          id?: string;
          sort_order?: number;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["goal_status"];
          target_date?: string | null;
          target_value?: number | null;
          title: string;
          unit?: string | null;
          updated_at?: string;
          why?: string | null;
          workspace_id: string;
        };
        Update: {
          area_id?: string | null;
          created_at?: string;
          current_value?: number | null;
          description?: string | null;
          id?: string;
          sort_order?: number;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["goal_status"];
          target_date?: string | null;
          target_value?: number | null;
          title?: string;
          unit?: string | null;
          updated_at?: string;
          why?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goals_area_id_workspace_id_fkey";
            columns: ["area_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "goals_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      google_calendar_connections: {
        Row: {
          access_token_ciphertext: string | null;
          access_token_expires_at: string | null;
          created_at: string;
          google_account_email: string | null;
          id: string;
          last_error: string | null;
          last_synced_at: string | null;
          read_calendar_ids: string[];
          refresh_token_ciphertext: string;
          retry_after: string | null;
          scopes: string[];
          status: Database["public"]["Enums"]["google_connection_status"];
          target_calendar_id: string | null;
          target_calendar_name: string | null;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          access_token_ciphertext?: string | null;
          access_token_expires_at?: string | null;
          created_at?: string;
          google_account_email?: string | null;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          read_calendar_ids?: string[];
          refresh_token_ciphertext: string;
          retry_after?: string | null;
          scopes?: string[];
          status?: Database["public"]["Enums"]["google_connection_status"];
          target_calendar_id?: string | null;
          target_calendar_name?: string | null;
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          access_token_ciphertext?: string | null;
          access_token_expires_at?: string | null;
          created_at?: string;
          google_account_email?: string | null;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          read_calendar_ids?: string[];
          refresh_token_ciphertext?: string;
          retry_after?: string | null;
          scopes?: string[];
          status?: Database["public"]["Enums"]["google_connection_status"];
          target_calendar_id?: string | null;
          target_calendar_name?: string | null;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_workspace_id_user_id_fkey";
            columns: ["workspace_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "workspace_members";
            referencedColumns: ["workspace_id", "user_id"];
          },
        ];
      };
      habit_logs: {
        Row: {
          created_at: string;
          habit_id: string;
          id: string;
          log_date: string;
          rest: boolean;
          updated_at: string;
          value: number | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          habit_id: string;
          id?: string;
          log_date: string;
          rest?: boolean;
          updated_at?: string;
          value?: number | null;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          habit_id?: string;
          id?: string;
          log_date?: string;
          rest?: boolean;
          updated_at?: string;
          value?: number | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_workspace_id_fkey";
            columns: ["habit_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "habits";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "habit_logs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      habits: {
        Row: {
          archived_at: string | null;
          area_id: string | null;
          created_at: string;
          description: string | null;
          ends_on: string | null;
          frequency: Database["public"]["Enums"]["habit_frequency"];
          id: string;
          kind: Database["public"]["Enums"]["habit_kind"];
          sort_order: number;
          starts_on: string;
          target_value: number | null;
          times_per_week: number | null;
          title: string;
          unit: string | null;
          updated_at: string;
          weekdays: number[];
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          area_id?: string | null;
          created_at?: string;
          description?: string | null;
          ends_on?: string | null;
          frequency?: Database["public"]["Enums"]["habit_frequency"];
          id?: string;
          kind?: Database["public"]["Enums"]["habit_kind"];
          sort_order?: number;
          starts_on: string;
          target_value?: number | null;
          times_per_week?: number | null;
          title: string;
          unit?: string | null;
          updated_at?: string;
          weekdays?: number[];
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          area_id?: string | null;
          created_at?: string;
          description?: string | null;
          ends_on?: string | null;
          frequency?: Database["public"]["Enums"]["habit_frequency"];
          id?: string;
          kind?: Database["public"]["Enums"]["habit_kind"];
          sort_order?: number;
          starts_on?: string;
          target_value?: number | null;
          times_per_week?: number | null;
          title?: string;
          unit?: string | null;
          updated_at?: string;
          weekdays?: number[];
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "habits_area_id_workspace_id_fkey";
            columns: ["area_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "habits_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      idea_tags: {
        Row: {
          created_at: string;
          idea_id: string;
          tag_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          idea_id: string;
          tag_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          idea_id?: string;
          tag_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "idea_tags_idea_id_workspace_id_fkey";
            columns: ["idea_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "ideas";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "idea_tags_tag_id_workspace_id_fkey";
            columns: ["tag_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "idea_tags_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ideas: {
        Row: {
          body: string | null;
          converted_goal_id: string | null;
          converted_project_id: string | null;
          converted_task_id: string | null;
          created_at: string;
          id: string;
          status: Database["public"]["Enums"]["idea_status"];
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          converted_goal_id?: string | null;
          converted_project_id?: string | null;
          converted_task_id?: string | null;
          created_at?: string;
          id?: string;
          status?: Database["public"]["Enums"]["idea_status"];
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          body?: string | null;
          converted_goal_id?: string | null;
          converted_project_id?: string | null;
          converted_task_id?: string | null;
          created_at?: string;
          id?: string;
          status?: Database["public"]["Enums"]["idea_status"];
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ideas_converted_goal_fkey";
            columns: ["converted_goal_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "ideas_converted_project_id_workspace_id_fkey";
            columns: ["converted_project_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "ideas_converted_task_id_workspace_id_fkey";
            columns: ["converted_task_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "ideas_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      journal_entries: {
        Row: {
          body: string | null;
          created_at: string;
          energy: number | null;
          entry_date: string;
          id: string;
          mood: number | null;
          prompt: string | null;
          title: string | null;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          created_at?: string;
          energy?: number | null;
          entry_date: string;
          id?: string;
          mood?: number | null;
          prompt?: string | null;
          title?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          energy?: number | null;
          entry_date?: string;
          id?: string;
          mood?: number | null;
          prompt?: string | null;
          title?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journal_entries_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      journal_entry_tags: {
        Row: {
          created_at: string;
          entry_id: string;
          tag_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          entry_id: string;
          tag_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          entry_id?: string;
          tag_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journal_entry_tags_entry_id_workspace_id_fkey";
            columns: ["entry_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "journal_entries";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "journal_entry_tags_tag_id_workspace_id_fkey";
            columns: ["tag_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "journal_entry_tags_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      milestones: {
        Row: {
          completed_at: string | null;
          created_at: string;
          due_date: string | null;
          goal_id: string;
          id: string;
          sort_order: number;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          due_date?: string | null;
          goal_id: string;
          id?: string;
          sort_order?: number;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          due_date?: string | null;
          goal_id?: string;
          id?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "milestones_goal_id_workspace_id_fkey";
            columns: ["goal_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "milestones_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      note_tags: {
        Row: {
          created_at: string;
          note_id: string;
          tag_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          note_id: string;
          tag_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          note_id?: string;
          tag_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "note_tags_note_id_workspace_id_fkey";
            columns: ["note_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "note_tags_tag_id_workspace_id_fkey";
            columns: ["tag_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "note_tags_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: {
          archived_at: string | null;
          body: string | null;
          created_at: string;
          goal_id: string | null;
          id: string;
          project_id: string | null;
          task_id: string | null;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          body?: string | null;
          created_at?: string;
          goal_id?: string | null;
          id?: string;
          project_id?: string | null;
          task_id?: string | null;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          body?: string | null;
          created_at?: string;
          goal_id?: string | null;
          id?: string;
          project_id?: string | null;
          task_id?: string | null;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_goal_id_workspace_id_fkey";
            columns: ["goal_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "notes_project_id_workspace_id_fkey";
            columns: ["project_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "notes_task_id_workspace_id_fkey";
            columns: ["task_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "notes_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_items: {
        Row: {
          created_at: string;
          goal_id: string | null;
          id: string;
          milestone_id: string | null;
          plan_id: string;
          project_id: string | null;
          sort_order: number;
          task_id: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          goal_id?: string | null;
          id?: string;
          milestone_id?: string | null;
          plan_id: string;
          project_id?: string | null;
          sort_order?: number;
          task_id?: string | null;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          goal_id?: string | null;
          id?: string;
          milestone_id?: string | null;
          plan_id?: string;
          project_id?: string | null;
          sort_order?: number;
          task_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_items_goal_fkey";
            columns: ["goal_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "plan_items_milestone_fkey";
            columns: ["milestone_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "milestones";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "plan_items_plan_id_workspace_id_fkey";
            columns: ["plan_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "plan_items_project_id_workspace_id_fkey";
            columns: ["project_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "plan_items_task_id_workspace_id_fkey";
            columns: ["task_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "plan_items_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          created_at: string;
          focus: string | null;
          id: string;
          parent_plan_id: string | null;
          period: Database["public"]["Enums"]["plan_period"];
          period_start: string;
          reflection: string | null;
          theme: string | null;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          focus?: string | null;
          id?: string;
          parent_plan_id?: string | null;
          period: Database["public"]["Enums"]["plan_period"];
          period_start: string;
          reflection?: string | null;
          theme?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          focus?: string | null;
          id?: string;
          parent_plan_id?: string | null;
          period?: Database["public"]["Enums"]["plan_period"];
          period_start?: string;
          reflection?: string | null;
          theme?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plans_parent_plan_id_workspace_id_fkey";
            columns: ["parent_plan_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "plans_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          timezone: string;
          updated_at: string;
          week_start: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          timezone?: string;
          updated_at?: string;
          week_start?: number;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          timezone?: string;
          updated_at?: string;
          week_start?: number;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          area_id: string | null;
          created_at: string;
          description: string | null;
          due_date: string | null;
          goal_id: string | null;
          id: string;
          name: string;
          notes: string | null;
          sort_order: number;
          start_date: string | null;
          status: Database["public"]["Enums"]["project_status"];
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          area_id?: string | null;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          goal_id?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          sort_order?: number;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          area_id?: string | null;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          goal_id?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          sort_order?: number;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_area_id_workspace_id_fkey";
            columns: ["area_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "projects_goal_fkey";
            columns: ["goal_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "projects_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      reminder_dismissals: {
        Row: {
          created_at: string;
          id: string;
          reminder_key: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          reminder_key: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          reminder_key?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_dismissals_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      reminder_preferences: {
        Row: {
          created_at: string;
          show_habits: boolean;
          show_tasks: boolean;
          show_time_blocks: boolean;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          show_habits?: boolean;
          show_tasks?: boolean;
          show_time_blocks?: boolean;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          show_habits?: boolean;
          show_tasks?: boolean;
          show_time_blocks?: boolean;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_preferences_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tags_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      task_dependencies: {
        Row: {
          created_at: string;
          depends_on_task_id: string;
          task_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          depends_on_task_id: string;
          task_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          depends_on_task_id?: string;
          task_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_workspace_id_fkey";
            columns: ["depends_on_task_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "task_dependencies_task_id_workspace_id_fkey";
            columns: ["task_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "task_dependencies_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      task_tags: {
        Row: {
          created_at: string;
          tag_id: string;
          task_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          tag_id: string;
          task_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          tag_id?: string;
          task_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_tags_tag_id_workspace_id_fkey";
            columns: ["tag_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "task_tags_task_id_workspace_id_fkey";
            columns: ["task_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "task_tags_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          area_id: string | null;
          completed_at: string | null;
          created_at: string;
          description: string | null;
          due_date: string | null;
          due_time: string | null;
          estimate_minutes: number | null;
          goal_id: string | null;
          id: string;
          parent_task_id: string | null;
          priority: Database["public"]["Enums"]["task_priority"];
          project_id: string | null;
          recurrence_anchor: string | null;
          recurrence_frequency: Database["public"]["Enums"]["recurrence_frequency"] | null;
          recurrence_interval: number;
          recurrence_until: string | null;
          recurrence_weekdays: number[] | null;
          recurs_from_task_id: string | null;
          sort_order: number;
          status: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          area_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          due_time?: string | null;
          estimate_minutes?: number | null;
          goal_id?: string | null;
          id?: string;
          parent_task_id?: string | null;
          priority?: Database["public"]["Enums"]["task_priority"];
          project_id?: string | null;
          recurrence_anchor?: string | null;
          recurrence_frequency?: Database["public"]["Enums"]["recurrence_frequency"] | null;
          recurrence_interval?: number;
          recurrence_until?: string | null;
          recurrence_weekdays?: number[] | null;
          recurs_from_task_id?: string | null;
          sort_order?: number;
          status?: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          area_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          due_time?: string | null;
          estimate_minutes?: number | null;
          goal_id?: string | null;
          id?: string;
          parent_task_id?: string | null;
          priority?: Database["public"]["Enums"]["task_priority"];
          project_id?: string | null;
          recurrence_anchor?: string | null;
          recurrence_frequency?: Database["public"]["Enums"]["recurrence_frequency"] | null;
          recurrence_interval?: number;
          recurrence_until?: string | null;
          recurrence_weekdays?: number[] | null;
          recurs_from_task_id?: string | null;
          sort_order?: number;
          status?: Database["public"]["Enums"]["task_status"];
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_area_id_workspace_id_fkey";
            columns: ["area_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "tasks_goal_fkey";
            columns: ["goal_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "tasks_parent_task_id_workspace_id_fkey";
            columns: ["parent_task_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "tasks_project_id_workspace_id_fkey";
            columns: ["project_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "tasks_recurs_from_task_id_fkey";
            columns: ["recurs_from_task_id"];
            isOneToOne: true;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      time_block_sync: {
        Row: {
          attempts: number;
          block_updated_at: string | null;
          calendar_id: string;
          connection_id: string;
          created_at: string;
          event_id: string;
          id: string;
          last_error: string | null;
          status: Database["public"]["Enums"]["calendar_sync_status"];
          synced_at: string | null;
          time_block_id: string | null;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          block_updated_at?: string | null;
          calendar_id: string;
          connection_id: string;
          created_at?: string;
          event_id: string;
          id?: string;
          last_error?: string | null;
          status?: Database["public"]["Enums"]["calendar_sync_status"];
          synced_at?: string | null;
          time_block_id?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          attempts?: number;
          block_updated_at?: string | null;
          calendar_id?: string;
          connection_id?: string;
          created_at?: string;
          event_id?: string;
          id?: string;
          last_error?: string | null;
          status?: Database["public"]["Enums"]["calendar_sync_status"];
          synced_at?: string | null;
          time_block_id?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "time_block_sync_connection_id_workspace_id_fkey";
            columns: ["connection_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "google_calendar_connections";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "time_block_sync_time_block_id_workspace_id_fkey";
            columns: ["time_block_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "time_blocks";
            referencedColumns: ["id", "workspace_id"];
          },
        ];
      };
      time_blocks: {
        Row: {
          created_at: string;
          ends_at: string;
          external_calendar_id: string | null;
          external_event_id: string | null;
          id: string;
          notes: string | null;
          origin: Database["public"]["Enums"]["time_block_origin"];
          project_id: string | null;
          starts_at: string;
          task_id: string | null;
          timezone: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ends_at: string;
          external_calendar_id?: string | null;
          external_event_id?: string | null;
          id?: string;
          notes?: string | null;
          origin?: Database["public"]["Enums"]["time_block_origin"];
          project_id?: string | null;
          starts_at: string;
          task_id?: string | null;
          timezone: string;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          external_calendar_id?: string | null;
          external_event_id?: string | null;
          id?: string;
          notes?: string | null;
          origin?: Database["public"]["Enums"]["time_block_origin"];
          project_id?: string | null;
          starts_at?: string;
          task_id?: string | null;
          timezone?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "time_blocks_project_id_workspace_id_fkey";
            columns: ["project_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "time_blocks_task_id_workspace_id_fkey";
            columns: ["task_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "time_blocks_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      vision_board_items: {
        Row: {
          archived_at: string | null;
          area_id: string | null;
          body: string | null;
          created_at: string;
          goal_id: string | null;
          id: string;
          image_alt: string | null;
          image_path: string | null;
          sort_order: number;
          title: string | null;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          area_id?: string | null;
          body?: string | null;
          created_at?: string;
          goal_id?: string | null;
          id?: string;
          image_alt?: string | null;
          image_path?: string | null;
          sort_order?: number;
          title?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          area_id?: string | null;
          body?: string | null;
          created_at?: string;
          goal_id?: string | null;
          id?: string;
          image_alt?: string | null;
          image_path?: string | null;
          sort_order?: number;
          title?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vision_board_items_area_id_workspace_id_fkey";
            columns: ["area_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "vision_board_items_goal_id_workspace_id_fkey";
            columns: ["goal_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "vision_board_items_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_members: {
        Row: {
          created_at: string;
          role: Database["public"]["Enums"]["workspace_role"];
          user_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          role?: Database["public"]["Enums"]["workspace_role"];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          role?: Database["public"]["Enums"]["workspace_role"];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          is_personal: boolean;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          is_personal?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          is_personal?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_goal_to_plan: { Args: { goal_title: string; target_plan_id: string }; Returns: string };
      add_project_to_plan: {
        Args: { project_name: string; target_plan_id: string };
        Returns: string;
      };
      add_task_to_plan: {
        Args: { target_plan_id: string; task_due_date?: string; task_title: string };
        Returns: string;
      };
      convert_idea_to_goal: { Args: { idea_id: string }; Returns: string };
      convert_idea_to_project: { Args: { idea_id: string }; Returns: string };
      convert_idea_to_task: { Args: { idea_id: string }; Returns: string };
      set_idea_tags: { Args: { tag_names: string[]; target_idea_id: string }; Returns: undefined };
      set_journal_tags: {
        Args: { tag_names: string[]; target_entry_id: string };
        Returns: undefined;
      };
      set_note_tags: { Args: { tag_names: string[]; target_note_id: string }; Returns: undefined };
      set_task_tags: { Args: { tag_names: string[]; target_task_id: string }; Returns: undefined };
    };
    Enums: {
      calendar_sync_status: "pending" | "synced" | "error";
      focus_session_type: "focus" | "short_break" | "long_break";
      goal_status: "active" | "paused" | "achieved" | "archived";
      google_connection_status: "active" | "reconnect_required" | "error";
      habit_frequency: "daily" | "weekly";
      habit_kind: "boolean" | "measurable";
      idea_status: "inbox" | "developing" | "someday" | "archived";
      plan_period: "year" | "month" | "week" | "day";
      project_status: "planned" | "active" | "on_hold" | "completed" | "archived";
      recurrence_frequency: "daily" | "weekly" | "monthly";
      task_priority: "low" | "medium" | "high" | "urgent";
      task_status: "todo" | "in_progress" | "done" | "cancelled";
      time_block_origin: "app" | "google";
      workspace_role: "owner" | "admin" | "member" | "viewer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      calendar_sync_status: ["pending", "synced", "error"],
      focus_session_type: ["focus", "short_break", "long_break"],
      goal_status: ["active", "paused", "achieved", "archived"],
      google_connection_status: ["active", "reconnect_required", "error"],
      habit_frequency: ["daily", "weekly"],
      habit_kind: ["boolean", "measurable"],
      idea_status: ["inbox", "developing", "someday", "archived"],
      plan_period: ["year", "month", "week", "day"],
      project_status: ["planned", "active", "on_hold", "completed", "archived"],
      recurrence_frequency: ["daily", "weekly", "monthly"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "done", "cancelled"],
      time_block_origin: ["app", "google"],
      workspace_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const;
