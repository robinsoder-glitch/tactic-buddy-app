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
      admin_allowlist: {
        Row: {
          created_at: string
          email: string
          note: string | null
        }
        Insert: {
          created_at?: string
          email: string
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          note?: string | null
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      announcement_recipients: {
        Row: {
          announcement_id: string
          created_at: string
          id: string
          notification_created_at: string | null
          read_at: string | null
          user_id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          id?: string
          notification_created_at?: string | null
          read_at?: string | null
          user_id: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          id?: string
          notification_created_at?: string | null
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_recipients_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "team_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      app_notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          created_by: string | null
          dedupe_key: string | null
          delivered_at: string | null
          event_id: string | null
          expires_at: string | null
          failed_at: string | null
          id: string
          kind: string
          priority: string
          read_at: string | null
          team_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          delivered_at?: string | null
          event_id?: string | null
          expires_at?: string | null
          failed_at?: string | null
          id?: string
          kind?: string
          priority?: string
          read_at?: string | null
          team_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          delivered_at?: string | null
          event_id?: string | null
          expires_at?: string | null
          failed_at?: string | null
          id?: string
          kind?: string
          priority?: string
          read_at?: string | null
          team_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          city: string | null
          created_at: string
          created_by: string
          id: string
          logo_path: string | null
          name: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by: string
          id?: string
          logo_path?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string
          id?: string
          logo_path?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      coach_drills: {
        Row: {
          coach_focus: string | null
          created_at: string
          equipment: string | null
          id: string
          in_library: boolean
          instruction: string | null
          minutes: number
          purpose: string | null
          team_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coach_focus?: string | null
          created_at?: string
          equipment?: string | null
          id?: string
          in_library?: boolean
          instruction?: string | null
          minutes?: number
          purpose?: string | null
          team_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coach_focus?: string | null
          created_at?: string
          equipment?: string | null
          id?: string
          in_library?: boolean
          instruction?: string | null
          minutes?: number
          purpose?: string | null
          team_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_drills_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_session_items: {
        Row: {
          created_at: string
          id: string
          kind: string
          minutes: number
          note: string | null
          resource_id: string | null
          session_id: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          minutes?: number
          note?: string | null
          resource_id?: string | null
          session_id: string
          sort_order?: number
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          minutes?: number
          note?: string | null
          resource_id?: string | null
          session_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "coach_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_sessions: {
        Row: {
          age_group: string | null
          created_at: string
          game_format: string | null
          goal: string | null
          id: string
          is_template: boolean
          notes: string | null
          session_date: string | null
          source_session_id: string | null
          status: string
          team_id: string | null
          template_id: string | null
          theme: string | null
          title: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          age_group?: string | null
          created_at?: string
          game_format?: string | null
          goal?: string | null
          id?: string
          is_template?: boolean
          notes?: string | null
          session_date?: string | null
          source_session_id?: string | null
          status?: string
          team_id?: string | null
          template_id?: string | null
          theme?: string | null
          title: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Update: {
          age_group?: string | null
          created_at?: string
          game_format?: string | null
          goal?: string | null
          id?: string
          is_template?: boolean
          notes?: string | null
          session_date?: string | null
          source_session_id?: string | null
          status?: string
          team_id?: string | null
          template_id?: string | null
          theme?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_sessions_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "coach_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      content_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          sort_order: number
          source_id: string
          source_type: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          sort_order?: number
          source_id: string
          source_type: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          sort_order?: number
          source_id?: string
          source_type?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_attendance: {
        Row: {
          absence_reason: string | null
          created_at: string
          created_by: string
          event_id: string
          id: string
          minutes_played: number | null
          note: string | null
          player_id: string
          registered_at: string
          registered_by: string | null
          status: string
          team_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          absence_reason?: string | null
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          minutes_played?: number | null
          note?: string | null
          player_id: string
          registered_at?: string
          registered_by?: string | null
          status?: string
          team_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          absence_reason?: string | null
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          minutes_played?: number | null
          note?: string | null
          player_id?: string
          registered_at?: string
          registered_by?: string | null
          status?: string
          team_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_change_log: {
        Row: {
          changed_by: string | null
          changed_fields: Json
          created_at: string
          event_id: string
          id: string
          team_id: string
        }
        Insert: {
          changed_by?: string | null
          changed_fields?: Json
          created_at?: string
          event_id: string
          id?: string
          team_id: string
        }
        Update: {
          changed_by?: string | null
          changed_fields?: Json
          created_at?: string
          event_id?: string
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_change_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_change_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_coaches: {
        Row: {
          created_at: string
          created_by: string
          event_id: string
          id: string
          note: string | null
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          note?: string | null
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          note?: string | null
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_coaches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_coaches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invitation_log: {
        Row: {
          changed_by: string | null
          changed_role: string
          created_at: string
          from_status: string | null
          id: string
          invitation_id: string
          team_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          changed_role?: string
          created_at?: string
          from_status?: string | null
          id?: string
          invitation_id: string
          team_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          changed_role?: string
          created_at?: string
          from_status?: string | null
          id?: string
          invitation_id?: string
          team_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invitation_log_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "event_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitation_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invitations: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string
          event_id: string
          id: string
          last_reminder_at: string | null
          message: string | null
          player_id: string
          respond_by: string | null
          responded_at: string | null
          responded_by: string | null
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          last_reminder_at?: string | null
          message?: string | null
          player_id: string
          respond_by?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          last_reminder_at?: string | null
          message?: string | null
          player_id?: string
          respond_by?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_messages: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          event_id: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          event_id: string
          id?: string
          team_id: string
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          event_id?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_plans: {
        Row: {
          created_at: string
          created_by: string
          event_id: string
          notes: string | null
          planning_done: boolean
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id: string
          notes?: string | null
          planning_done?: boolean
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string
          notes?: string | null
          planning_done?: boolean
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_plans_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_plans_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_resources: {
        Row: {
          created_at: string
          created_by: string
          event_id: string
          id: string
          kind: string
          minutes: number | null
          note: string | null
          resource_id: string
          sort_order: number
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          kind?: string
          minutes?: number | null
          note?: string | null
          resource_id: string
          sort_order?: number
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          kind?: string
          minutes?: number | null
          note?: string | null
          resource_id?: string
          sort_order?: number
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_resources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_resources_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_squad: {
        Row: {
          created_at: string
          created_by: string
          event_id: string
          id: string
          player_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          player_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          player_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_squad_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_squad_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_squad_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          away_team: string | null
          cancelled_at: string | null
          created_at: string
          created_by: string
          ends_at: string | null
          home_team: string | null
          id: string
          kit: string | null
          location: string | null
          match_duration_minutes: number | null
          match_kind: string | null
          meet_at: string | null
          notes: string | null
          series_id: string | null
          starts_at: string
          team_id: string
          title: string | null
          type: string
          updated_at: string
        }
        Insert: {
          away_team?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by: string
          ends_at?: string | null
          home_team?: string | null
          id?: string
          kit?: string | null
          location?: string | null
          match_duration_minutes?: number | null
          match_kind?: string | null
          meet_at?: string | null
          notes?: string | null
          series_id?: string | null
          starts_at: string
          team_id: string
          title?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          away_team?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string
          ends_at?: string | null
          home_team?: string | null
          id?: string
          kit?: string | null
          location?: string | null
          match_duration_minutes?: number | null
          match_kind?: string | null
          meet_at?: string | null
          notes?: string | null
          series_id?: string | null
          starts_at?: string
          team_id?: string
          title?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          age_max: number | null
          age_min: number | null
          category: string
          coach_value: string | null
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          level: string
          published_at: string | null
          reviewed_at: string | null
          source_name: string | null
          source_url: string | null
          status: string
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          category: string
          coach_value?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          level?: string
          published_at?: string | null
          reviewed_at?: string | null
          source_name?: string | null
          source_url?: string | null
          status?: string
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          category?: string
          coach_value?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          level?: string
          published_at?: string | null
          reviewed_at?: string | null
          source_name?: string | null
          source_url?: string | null
          status?: string
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_articles: {
        Row: {
          age_10: boolean
          age_5_7: boolean
          age_8_9: boolean
          age_label: string | null
          category: string
          checked_date: string | null
          coach_value: string | null
          content_type: string | null
          copyright_note: string | null
          created_at: string
          evidence_level: string | null
          featured: boolean
          format_3v3: boolean
          format_5v5: boolean
          format_7v7: boolean
          game_format_label: string | null
          id: string
          is_published: boolean
          language: string | null
          learn_sv: string | null
          level: string | null
          original_url: string
          reading_minutes: number | null
          slug: string
          sort_order: number | null
          source_name: string | null
          source_type: string | null
          summary_sv: string
          title_original: string | null
          title_sv: string
          try_next_sv: string | null
          updated_at: string
        }
        Insert: {
          age_10?: boolean
          age_5_7?: boolean
          age_8_9?: boolean
          age_label?: string | null
          category: string
          checked_date?: string | null
          coach_value?: string | null
          content_type?: string | null
          copyright_note?: string | null
          created_at?: string
          evidence_level?: string | null
          featured?: boolean
          format_3v3?: boolean
          format_5v5?: boolean
          format_7v7?: boolean
          game_format_label?: string | null
          id: string
          is_published?: boolean
          language?: string | null
          learn_sv?: string | null
          level?: string | null
          original_url: string
          reading_minutes?: number | null
          slug: string
          sort_order?: number | null
          source_name?: string | null
          source_type?: string | null
          summary_sv: string
          title_original?: string | null
          title_sv: string
          try_next_sv?: string | null
          updated_at?: string
        }
        Update: {
          age_10?: boolean
          age_5_7?: boolean
          age_8_9?: boolean
          age_label?: string | null
          category?: string
          checked_date?: string | null
          coach_value?: string | null
          content_type?: string | null
          copyright_note?: string | null
          created_at?: string
          evidence_level?: string | null
          featured?: boolean
          format_3v3?: boolean
          format_5v5?: boolean
          format_7v7?: boolean
          game_format_label?: string | null
          id?: string
          is_published?: boolean
          language?: string | null
          learn_sv?: string | null
          level?: string | null
          original_url?: string
          reading_minutes?: number | null
          slug?: string
          sort_order?: number | null
          source_name?: string | null
          source_type?: string | null
          summary_sv?: string
          title_original?: string | null
          title_sv?: string
          try_next_sv?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      match_lineups: {
        Row: {
          bench: Json
          created_at: string
          created_by: string
          event_id: string
          formation: string
          slots: Json
          tactic_id: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          bench?: Json
          created_at?: string
          created_by: string
          event_id: string
          formation: string
          slots?: Json
          tactic_id?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          bench?: Json
          created_at?: string
          created_by?: string
          event_id?: string
          formation?: string
          slots?: Json
          tactic_id?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_tactic_id_fkey"
            columns: ["tactic_id"]
            isOneToOne: false
            referencedRelation: "tactics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_shares: {
        Row: {
          created_at: string
          created_by: string
          event_id: string
          expires_at: string | null
          id: string
          revoked_at: string | null
          team_id: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id: string
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          team_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          team_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_shares_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_shares_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          digest: string
          email: boolean
          id: string
          in_app: boolean
          kind: string
          push: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest?: string
          email?: boolean
          id?: string
          in_app?: boolean
          kind: string
          push?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest?: string
          email?: boolean
          id?: string
          in_app?: boolean
          kind?: string
          push?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          created_at: string
          important_bypass_quiet: boolean
          push_enabled: boolean
          quiet_enabled: boolean
          quiet_end: string
          quiet_start: string
          time_zone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          important_bypass_quiet?: boolean
          push_enabled?: boolean
          quiet_enabled?: boolean
          quiet_end?: string
          quiet_start?: string
          time_zone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          important_bypass_quiet?: boolean
          push_enabled?: boolean
          quiet_enabled?: boolean
          quiet_end?: string
          quiet_start?: string
          time_zone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      period_links: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          period_id: string
          resource_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          period_id: string
          resource_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          period_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_links_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "team_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      period_progression: {
        Row: {
          id: string
          notes: string | null
          period_id: string
          step: number
        }
        Insert: {
          id?: string
          notes?: string | null
          period_id: string
          step: number
        }
        Update: {
          id?: string
          notes?: string | null
          period_id?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "period_progression_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "team_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      player_focus_areas: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          period_id: string | null
          player_id: string
          status: string
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          period_id?: string | null
          player_id: string
          status?: string
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          period_id?: string | null
          player_id?: string
          status?: string
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_focus_areas_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "team_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_focus_areas_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_focus_areas_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_guardians: {
        Row: {
          created_at: string
          created_by: string
          guardian_user_id: string
          id: string
          is_active: boolean
          player_id: string
          relation: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          guardian_user_id: string
          id?: string
          is_active?: boolean
          player_id: string
          relation?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          guardian_user_id?: string
          id?: string
          is_active?: boolean
          player_id?: string
          relation?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_guardians_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_observations: {
        Row: {
          created_at: string
          created_by: string
          event_id: string | null
          focus_area_id: string | null
          id: string
          note: string
          player_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          event_id?: string | null
          focus_area_id?: string | null
          id?: string
          note: string
          player_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string | null
          focus_area_id?: string | null
          id?: string
          note?: string
          player_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_observations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_observations_focus_area_id_fkey"
            columns: ["focus_area_id"]
            isOneToOne: false
            referencedRelation: "player_focus_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_observations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_observations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_stats: {
        Row: {
          assists: number
          competition: string
          created_at: string
          created_by: string
          goals: number
          id: string
          matches: number
          player_id: string
          points: number
          red_cards: number
          team_id: string
          updated_at: string
          yellow_cards: number
        }
        Insert: {
          assists?: number
          competition?: string
          created_at?: string
          created_by: string
          goals?: number
          id?: string
          matches?: number
          player_id: string
          points?: number
          red_cards?: number
          team_id: string
          updated_at?: string
          yellow_cards?: number
        }
        Update: {
          assists?: number
          competition?: string
          created_at?: string
          created_by?: string
          goals?: number
          id?: string
          matches?: number
          player_id?: string
          points?: number
          red_cards?: number
          team_id?: string
          updated_at?: string
          yellow_cards?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          allergy_note: string | null
          birth_date: string | null
          created_at: string
          gender: string | null
          guardian1_email: string | null
          guardian1_name: string | null
          guardian1_phone: string | null
          guardian2_email: string | null
          guardian2_name: string | null
          guardian2_phone: string | null
          has_allergy: boolean
          id: string
          is_active: boolean
          is_goalkeeper: boolean
          member_user_id: string | null
          name: string
          number: number | null
          photo_path: string | null
          team: string
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allergy_note?: string | null
          birth_date?: string | null
          created_at?: string
          gender?: string | null
          guardian1_email?: string | null
          guardian1_name?: string | null
          guardian1_phone?: string | null
          guardian2_email?: string | null
          guardian2_name?: string | null
          guardian2_phone?: string | null
          has_allergy?: boolean
          id?: string
          is_active?: boolean
          is_goalkeeper?: boolean
          member_user_id?: string | null
          name: string
          number?: number | null
          photo_path?: string | null
          team?: string
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allergy_note?: string | null
          birth_date?: string | null
          created_at?: string
          gender?: string | null
          guardian1_email?: string | null
          guardian1_name?: string | null
          guardian1_phone?: string | null
          guardian2_email?: string | null
          guardian2_name?: string | null
          guardian2_phone?: string | null
          has_allergy?: boolean
          id?: string
          is_active?: boolean
          is_goalkeeper?: boolean
          member_user_id?: string | null
          name?: string
          number?: number | null
          photo_path?: string | null
          team?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          birth_date: string | null
          created_at: string
          display_name: string | null
          guardian_for_name: string | null
          id: string
          is_adult_confirmed: boolean
        }
        Insert: {
          avatar_path?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          guardian_for_name?: string | null
          id: string
          is_adult_confirmed?: boolean
        }
        Update: {
          avatar_path?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          guardian_for_name?: string | null
          id?: string
          is_adult_confirmed?: boolean
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string | null
          created_at: string
          device_label: string | null
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string | null
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          auth_key?: string | null
          created_at?: string
          device_label?: string | null
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh?: string | null
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string | null
          created_at?: string
          device_label?: string | null
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string | null
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      session_run_attendance: {
        Row: {
          id: string
          player_id: string
          run_id: string
          status: string
          updated_at: string
        }
        Insert: {
          id?: string
          player_id: string
          run_id: string
          status: string
          updated_at?: string
        }
        Update: {
          id?: string
          player_id?: string
          run_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_run_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_run_attendance_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "session_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      session_run_items: {
        Row: {
          actual_seconds: number
          id: string
          item_id: string | null
          kind: string
          note: string | null
          planned_minutes: number
          resource_id: string | null
          run_id: string
          sort_order: number
          status: string
          title: string
        }
        Insert: {
          actual_seconds?: number
          id?: string
          item_id?: string | null
          kind?: string
          note?: string | null
          planned_minutes?: number
          resource_id?: string | null
          run_id: string
          sort_order?: number
          status?: string
          title: string
        }
        Update: {
          actual_seconds?: number
          id?: string
          item_id?: string | null
          kind?: string
          note?: string | null
          planned_minutes?: number
          resource_id?: string | null
          run_id?: string
          sort_order?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_run_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "coach_session_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "session_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      session_run_player_notes: {
        Row: {
          id: string
          note: string
          player_id: string
          run_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          note?: string
          player_id: string
          run_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          note?: string
          player_id?: string
          run_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_run_player_notes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_run_player_notes_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "session_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      session_runs: {
        Row: {
          adjust_seconds: number
          coach_id: string
          created_at: string
          current_index: number
          ended_at: string | null
          event_id: string | null
          general_note: string | null
          id: string
          paused_at: string | null
          paused_seconds: number
          session_id: string
          started_at: string
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          adjust_seconds?: number
          coach_id?: string
          created_at?: string
          current_index?: number
          ended_at?: string | null
          event_id?: string | null
          general_note?: string | null
          id?: string
          paused_at?: string | null
          paused_seconds?: number
          session_id: string
          started_at?: string
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          adjust_seconds?: number
          coach_id?: string
          created_at?: string
          current_index?: number
          ended_at?: string | null
          event_id?: string | null
          general_note?: string | null
          id?: string
          paused_at?: string | null
          paused_seconds?: number
          session_id?: string
          started_at?: string
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_runs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_runs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "coach_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_runs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tactic_frames: {
        Row: {
          created_at: string
          drawings: Json
          id: string
          name: string | null
          note: string | null
          objects: Json
          position: number
          tactic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          drawings?: Json
          id?: string
          name?: string | null
          note?: string | null
          objects?: Json
          position?: number
          tactic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          drawings?: Json
          id?: string
          name?: string | null
          note?: string | null
          objects?: Json
          position?: number
          tactic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tactic_frames_tactic_id_fkey"
            columns: ["tactic_id"]
            isOneToOne: false
            referencedRelation: "tactics"
            referencedColumns: ["id"]
          },
        ]
      }
      tactics: {
        Row: {
          created_at: string
          id: string
          is_draft: boolean
          is_public: boolean
          name: string
          pitch_type: string
          share_id: string
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_draft?: boolean
          is_public?: boolean
          name?: string
          pitch_type?: string
          share_id?: string
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_draft?: boolean
          is_public?: boolean
          name?: string
          pitch_type?: string
          share_id?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tactics_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tb_district_profiles: {
        Row: {
          created_at: string
          data: Json
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tb_drills: {
        Row: {
          created_at: string
          data: Json
          default_minutes: number | null
          id: string
          purpose: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          default_minutes?: number | null
          id: string
          purpose?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          default_minutes?: number | null
          id?: string
          purpose?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tb_favorites: {
        Row: {
          created_at: string
          id: string
          kind: string
          resource_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          resource_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          resource_id?: string
          user_id?: string
        }
        Relationships: []
      }
      tb_formations: {
        Row: {
          created_at: string
          data: Json
          format: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          format: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          format?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tb_goalkeeper_cards: {
        Row: {
          created_at: string
          data: Json
          id: string
          purpose: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          id: string
          purpose?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          purpose?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tb_rulesets: {
        Row: {
          created_at: string
          data: Json
          format: string
          id: string
          season: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          format: string
          id: string
          season?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          format?: string
          id?: string
          season?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tb_tactics: {
        Row: {
          created_at: string
          data: Json
          difficulty: number
          format: string
          formation_ref: string | null
          game_moment: string | null
          id: string
          phase: string | null
          purpose: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          difficulty?: number
          format: string
          formation_ref?: string | null
          game_moment?: string | null
          id: string
          phase?: string | null
          purpose?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          difficulty?: number
          format?: string
          formation_ref?: string | null
          game_moment?: string | null
          id?: string
          phase?: string | null
          purpose?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tb_taxonomy: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tb_training_sessions: {
        Row: {
          created_at: string
          data: Json
          id: string
          theme: string | null
          title: string
          total_minutes: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          id: string
          theme?: string | null
          title: string
          total_minutes?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          theme?: string | null
          title?: string
          total_minutes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      team_announcements: {
        Row: {
          audience_type: string
          audience_user_ids: string[]
          body: string
          created_at: string
          created_by: string
          event_id: string | null
          id: string
          last_reminder_at: string | null
          priority: string
          publish_error: string | null
          published_at: string | null
          recipient_count: number
          requires_read_receipt: boolean
          scheduled_for: string | null
          status: string
          team_id: string
          title: string
          updated_at: string
          without_account_count: number
        }
        Insert: {
          audience_type?: string
          audience_user_ids?: string[]
          body: string
          created_at?: string
          created_by?: string
          event_id?: string | null
          id?: string
          last_reminder_at?: string | null
          priority?: string
          publish_error?: string | null
          published_at?: string | null
          recipient_count?: number
          requires_read_receipt?: boolean
          scheduled_for?: string | null
          status?: string
          team_id: string
          title: string
          updated_at?: string
          without_account_count?: number
        }
        Update: {
          audience_type?: string
          audience_user_ids?: string[]
          body?: string
          created_at?: string
          created_by?: string
          event_id?: string | null
          id?: string
          last_reminder_at?: string | null
          priority?: string
          publish_error?: string | null
          published_at?: string | null
          recipient_count?: number
          requires_read_receipt?: boolean
          scheduled_for?: string | null
          status?: string
          team_id?: string
          title?: string
          updated_at?: string
          without_account_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_announcements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_announcements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_chat_messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_chat_reads: {
        Row: {
          last_read_at: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          team_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          last_read_at?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_chat_reads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          email: string | null
          expires_at: string
          id: string
          invite_kind: string
          recipient_label: string | null
          revoked_at: string | null
          role: string
          target_player_id: string | null
          team_id: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          expires_at?: string
          id?: string
          invite_kind?: string
          recipient_label?: string | null
          revoked_at?: string | null
          role?: string
          target_player_id?: string | null
          team_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at?: string
          id?: string
          invite_kind?: string
          recipient_label?: string | null
          revoked_at?: string | null
          role?: string
          target_player_id?: string | null
          team_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_target_player_id_fkey"
            columns: ["target_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          can_manage_attendance: boolean
          created_at: string
          id: string
          joined_via: string | null
          role: string
          status: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_manage_attendance?: boolean
          created_at?: string
          id?: string
          joined_via?: string | null
          role?: string
          status?: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_manage_attendance?: boolean
          created_at?: string
          id?: string
          joined_via?: string | null
          role?: string
          status?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_periods: {
        Row: {
          created_at: string
          created_by: string
          end_date: string
          goal: string | null
          id: string
          main_theme: string
          name: string
          start_date: string
          sub_themes: string[]
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          end_date: string
          goal?: string | null
          id?: string
          main_theme: string
          name: string
          start_date: string
          sub_themes?: string[]
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_date?: string
          goal?: string | null
          id?: string
          main_theme?: string
          name?: string
          start_date?: string
          sub_themes?: string[]
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_periods_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_photos: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string
          id: string
          path: string
          team_id: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by: string
          id?: string
          path: string
          team_id: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string
          id?: string
          path?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_photos_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          about: string | null
          age_group: string | null
          archived_at: string | null
          club_id: string | null
          coach_join_code: string
          created_at: string
          created_by: string
          game_format: string | null
          gender: string
          home_ground: string | null
          id: string
          join_code: string
          name: string
          photo_path: string | null
          updated_at: string
        }
        Insert: {
          about?: string | null
          age_group?: string | null
          archived_at?: string | null
          club_id?: string | null
          coach_join_code?: string
          created_at?: string
          created_by: string
          game_format?: string | null
          gender?: string
          home_ground?: string | null
          id?: string
          join_code?: string
          name: string
          photo_path?: string | null
          updated_at?: string
        }
        Update: {
          about?: string | null
          age_group?: string | null
          archived_at?: string | null
          club_id?: string | null
          coach_join_code?: string
          created_at?: string
          created_by?: string
          game_format?: string | null
          gender?: string
          home_ground?: string | null
          id?: string
          join_code?: string
          name?: string
          photo_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_team_invite: {
        Args: { _account_kind?: string; _token: string }
        Returns: {
          already_member: boolean
          member_role: string
          member_status: string
          team_id: string
        }[]
      }
      announcement_audience: {
        Args: {
          _audience_type: string
          _event_id: string
          _manual: string[]
          _team_id: string
        }
        Returns: {
          user_id: string
        }[]
      }
      announcement_team: { Args: { _announcement_id: string }; Returns: string }
      approve_team_join_request: {
        Args: { _member_id: string }
        Returns: {
          linked_player_id: string
          member_role: string
        }[]
      }
      can_discuss_event: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_attendance: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      can_see_member_profile: {
        Args: { _profile_id: string }
        Returns: boolean
      }
      copy_coach_session: {
        Args: {
          _as_template?: boolean
          _source: string
          _team_id?: string
          _title?: string
        }
        Returns: string
      }
      find_team_by_code: {
        Args: { _code: string }
        Returns: {
          age_group: string
          club_name: string
          id: string
          join_role: string
          name: string
        }[]
      }
      gen_team_code: { Args: never; Returns: string }
      get_my_day_summary: { Args: never; Returns: Json }
      get_player_private: {
        Args: { _player_id: string }
        Returns: {
          allergy_note: string
          birth_date: string
          guardian1_email: string
          guardian1_name: string
          guardian1_phone: string
          guardian2_email: string
          guardian2_name: string
          guardian2_phone: string
          has_allergy: boolean
          player_id: string
        }[]
      }
      get_shared_match: { Args: { _token: string }; Returns: Json }
      get_team_players_private: {
        Args: { _team_id: string }
        Returns: {
          allergy_note: string
          birth_date: string
          guardian1_email: string
          guardian1_name: string
          guardian1_phone: string
          guardian2_email: string
          guardian2_name: string
          guardian2_phone: string
          has_allergy: boolean
          player_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_announcement_recipient: {
        Args: { _announcement_id: string; _user_id: string }
        Returns: boolean
      }
      is_guardian_of: { Args: { _player_id: string }; Returns: boolean }
      is_my_player: { Args: { _player_id: string }; Returns: boolean }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_team_coach: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      join_team_with_code: {
        Args: { _account_kind: string; _code: string }
        Returns: {
          member_role: string
          member_status: string
          team_id: string
          team_name: string
        }[]
      }
      log_event_change: {
        Args: { _changed_fields: Json; _event_id: string; _notice: string }
        Returns: string
      }
      mark_announcement_read: {
        Args: { _announcement_id: string }
        Returns: undefined
      }
      player_team: { Args: { _player_id: string }; Returns: string }
      preview_announcement_audience: {
        Args: {
          _audience_type: string
          _event_id: string
          _manual?: string[]
          _team_id: string
        }
        Returns: Json
      }
      preview_team_invite: {
        Args: { _token: string }
        Returns: {
          age_group: string
          club_name: string
          email_locked: boolean
          expires_at: string
          invite_role: string
          state: string
          team_name: string
        }[]
      }
      publish_scheduled_announcements: { Args: never; Returns: number }
      publish_team_announcement: {
        Args: { _announcement_id: string }
        Returns: Json
      }
      remind_unread_announcement: {
        Args: { _announcement_id: string }
        Returns: Json
      }
      rotate_team_code: {
        Args: { _kind: string; _team_id: string }
        Returns: string
      }
      save_event_attendance: {
        Args: { _event_id: string; _rows: Json; _team_id: string }
        Returns: number
      }
      save_match_plan: {
        Args: {
          _bench: string[]
          _coach_ids: string[]
          _event_id: string
          _formation: string
          _notes: string
          _player_ids: string[]
          _required: number
          _slots: Json
          _tactic_id: string
          _team_id: string
        }
        Returns: undefined
      }
      save_training_plan: {
        Args: {
          _event_id: string
          _items: Json
          _notes: string
          _team_id: string
        }
        Returns: undefined
      }
      send_invite_reminders: {
        Args: { _body: string; _event_id: string; _title: string }
        Returns: {
          missing_account: number
          sent: number
          skipped_recent: number
        }[]
      }
      team_role: {
        Args: { _team_id: string; _user_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "coach" | "player"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "coach", "player"],
    },
  },
} as const
