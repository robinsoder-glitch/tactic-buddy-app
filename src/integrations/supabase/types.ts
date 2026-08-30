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
          notes: string | null
          session_date: string | null
          status: string
          template_id: string | null
          theme: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          age_group?: string | null
          created_at?: string
          game_format?: string | null
          goal?: string | null
          id?: string
          notes?: string | null
          session_date?: string | null
          status?: string
          template_id?: string | null
          theme?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          age_group?: string | null
          created_at?: string
          game_format?: string | null
          goal?: string | null
          id?: string
          notes?: string | null
          session_date?: string | null
          status?: string
          template_id?: string | null
          theme?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          created_at: string
          created_by: string
          event_id: string
          id: string
          note: string | null
          player_id: string
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          note?: string | null
          player_id: string
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          note?: string | null
          player_id?: string
          status?: string
          team_id?: string
          updated_at?: string
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
      event_resources: {
        Row: {
          created_at: string
          created_by: string
          event_id: string
          id: string
          kind: string
          resource_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          kind?: string
          resource_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          kind?: string
          resource_id?: string
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
      events: {
        Row: {
          away_team: string | null
          created_at: string
          created_by: string
          ends_at: string | null
          home_team: string | null
          id: string
          kit: string | null
          location: string | null
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
          created_at?: string
          created_by: string
          ends_at?: string | null
          home_team?: string | null
          id?: string
          kit?: string | null
          location?: string | null
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
          created_at?: string
          created_by?: string
          ends_at?: string | null
          home_team?: string | null
          id?: string
          kit?: string | null
          location?: string | null
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
          birth_date: string | null
          created_at: string
          gender: string | null
          id: string
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
          birth_date?: string | null
          created_at?: string
          gender?: string | null
          id?: string
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
          birth_date?: string | null
          created_at?: string
          gender?: string | null
          id?: string
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
          id: string
          is_adult_confirmed: boolean
        }
        Insert: {
          avatar_path?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_adult_confirmed?: boolean
        }
        Update: {
          avatar_path?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_adult_confirmed?: boolean
        }
        Relationships: []
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
      team_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          revoked_at: string | null
          role: string
          team_id: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          email: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          role?: string
          team_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          role?: string
          team_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
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
          created_at: string
          id: string
          role: string
          status: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          status?: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
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
          created_at: string
          created_by: string
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
          created_at?: string
          created_by: string
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
          created_at?: string
          created_by?: string
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
      find_team_by_code: {
        Args: { _code: string }
        Returns: {
          age_group: string
          club_name: string
          id: string
          name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_coach: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      redeem_team_invite: { Args: { _team_id: string }; Returns: string }
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
      app_role: ["admin", "coach", "player"],
    },
  },
} as const
