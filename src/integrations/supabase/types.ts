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
      mcphases_active_minutes: {
        Row: {
          created_at: string
          day_in_study: number
          id: string
          is_weekend: boolean | null
          lightly: number | null
          moderately: number | null
          participant_id: number
          raw: Json | null
          sedentary: number | null
          study_interval: number
          very: number | null
        }
        Insert: {
          created_at?: string
          day_in_study: number
          id?: string
          is_weekend?: boolean | null
          lightly?: number | null
          moderately?: number | null
          participant_id: number
          raw?: Json | null
          sedentary?: number | null
          study_interval: number
          very?: number | null
        }
        Update: {
          created_at?: string
          day_in_study?: number
          id?: string
          is_weekend?: boolean | null
          lightly?: number | null
          moderately?: number | null
          participant_id?: number
          raw?: Json | null
          sedentary?: number | null
          study_interval?: number
          very?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_active_minutes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_active_zone_minutes: {
        Row: {
          created_at: string
          day_in_study: number | null
          heart_zone_id: string | null
          id: string
          is_weekend: boolean | null
          participant_id: number
          raw: Json | null
          study_interval: number
          timestamp_local: string | null
          total_minutes: number | null
        }
        Insert: {
          created_at?: string
          day_in_study?: number | null
          heart_zone_id?: string | null
          id?: string
          is_weekend?: boolean | null
          participant_id: number
          raw?: Json | null
          study_interval: number
          timestamp_local?: string | null
          total_minutes?: number | null
        }
        Update: {
          created_at?: string
          day_in_study?: number | null
          heart_zone_id?: string | null
          id?: string
          is_weekend?: boolean | null
          participant_id?: number
          raw?: Json | null
          study_interval?: number
          timestamp_local?: string | null
          total_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_active_zone_minutes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_altitude: {
        Row: {
          altitude: number | null
          created_at: string
          day_in_study: number | null
          id: string
          is_weekend: boolean | null
          participant_id: number
          raw: Json | null
          study_interval: number
          timestamp_local: string
        }
        Insert: {
          altitude?: number | null
          created_at?: string
          day_in_study?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id: number
          raw?: Json | null
          study_interval: number
          timestamp_local: string
        }
        Update: {
          altitude?: number | null
          created_at?: string
          day_in_study?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id?: number
          raw?: Json | null
          study_interval?: number
          timestamp_local?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_altitude_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_calories: {
        Row: {
          calories: number | null
          created_at: string
          day_in_study: number | null
          id: string
          is_weekend: boolean | null
          participant_id: number
          raw: Json | null
          study_interval: number
          timestamp_local: string
        }
        Insert: {
          calories?: number | null
          created_at?: string
          day_in_study?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id: number
          raw?: Json | null
          study_interval: number
          timestamp_local: string
        }
        Update: {
          calories?: number | null
          created_at?: string
          day_in_study?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id?: number
          raw?: Json | null
          study_interval?: number
          timestamp_local?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_calories_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_computed_temperature: {
        Row: {
          baseline_relative_nightly_standard_deviation: number | null
          baseline_relative_sample_standard_deviation: number | null
          baseline_relative_sample_sum: number | null
          baseline_relative_sample_sum_of_squares: number | null
          created_at: string
          id: string
          is_weekend: boolean | null
          nightly_temperature: number | null
          participant_id: number
          raw: Json | null
          sleep_end_day_in_study: number | null
          sleep_end_timestamp: string | null
          sleep_start_day_in_study: number
          sleep_start_timestamp: string | null
          study_interval: number
          temperature_samples: number | null
          type: string | null
        }
        Insert: {
          baseline_relative_nightly_standard_deviation?: number | null
          baseline_relative_sample_standard_deviation?: number | null
          baseline_relative_sample_sum?: number | null
          baseline_relative_sample_sum_of_squares?: number | null
          created_at?: string
          id?: string
          is_weekend?: boolean | null
          nightly_temperature?: number | null
          participant_id: number
          raw?: Json | null
          sleep_end_day_in_study?: number | null
          sleep_end_timestamp?: string | null
          sleep_start_day_in_study: number
          sleep_start_timestamp?: string | null
          study_interval: number
          temperature_samples?: number | null
          type?: string | null
        }
        Update: {
          baseline_relative_nightly_standard_deviation?: number | null
          baseline_relative_sample_standard_deviation?: number | null
          baseline_relative_sample_sum?: number | null
          baseline_relative_sample_sum_of_squares?: number | null
          created_at?: string
          id?: string
          is_weekend?: boolean | null
          nightly_temperature?: number | null
          participant_id?: number
          raw?: Json | null
          sleep_end_day_in_study?: number | null
          sleep_end_timestamp?: string | null
          sleep_start_day_in_study?: number
          sleep_start_timestamp?: string | null
          study_interval?: number
          temperature_samples?: number | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_computed_temperature_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_demographic_vo2_max: {
        Row: {
          created_at: string
          day_in_study: number | null
          demographic_vo2_max: number | null
          demographic_vo2_max_error: number | null
          filtered_demographic_vo2_max: number | null
          filtered_demographic_vo2_max_error: number | null
          id: string
          is_weekend: boolean | null
          participant_id: number
          raw: Json | null
          study_interval: number
        }
        Insert: {
          created_at?: string
          day_in_study?: number | null
          demographic_vo2_max?: number | null
          demographic_vo2_max_error?: number | null
          filtered_demographic_vo2_max?: number | null
          filtered_demographic_vo2_max_error?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id: number
          raw?: Json | null
          study_interval: number
        }
        Update: {
          created_at?: string
          day_in_study?: number | null
          demographic_vo2_max?: number | null
          demographic_vo2_max_error?: number | null
          filtered_demographic_vo2_max?: number | null
          filtered_demographic_vo2_max_error?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id?: number
          raw?: Json | null
          study_interval?: number
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_demographic_vo2_max_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_distance: {
        Row: {
          created_at: string
          day_in_study: number | null
          distance: number | null
          id: string
          is_weekend: boolean | null
          participant_id: number
          raw: Json | null
          study_interval: number
          timestamp_local: string
        }
        Insert: {
          created_at?: string
          day_in_study?: number | null
          distance?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id: number
          raw?: Json | null
          study_interval: number
          timestamp_local: string
        }
        Update: {
          created_at?: string
          day_in_study?: number | null
          distance?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id?: number
          raw?: Json | null
          study_interval?: number
          timestamp_local?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_distance_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_estimated_oxygen_variation: {
        Row: {
          created_at: string
          day_in_study: number | null
          id: string
          infrared_to_red_signal_ratio: number | null
          is_weekend: boolean | null
          participant_id: number
          raw: Json | null
          study_interval: number
          timestamp_local: string
        }
        Insert: {
          created_at?: string
          day_in_study?: number | null
          id?: string
          infrared_to_red_signal_ratio?: number | null
          is_weekend?: boolean | null
          participant_id: number
          raw?: Json | null
          study_interval: number
          timestamp_local: string
        }
        Update: {
          created_at?: string
          day_in_study?: number | null
          id?: string
          infrared_to_red_signal_ratio?: number | null
          is_weekend?: boolean | null
          participant_id?: number
          raw?: Json | null
          study_interval?: number
          timestamp_local?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_estimated_oxygen_variation_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_exercise: {
        Row: {
          activeduration: number | null
          activityname: string | null
          activitytypeid: string | null
          averageheartrate: number | null
          calories: number | null
          created_at: string
          duration: number | null
          elevationgain: number | null
          hasgps: boolean | null
          id: string
          is_weekend: boolean | null
          participant_id: number
          raw: Json | null
          start_day_in_study: number
          start_timestamp: string | null
          steps: number | null
          study_interval: number
        }
        Insert: {
          activeduration?: number | null
          activityname?: string | null
          activitytypeid?: string | null
          averageheartrate?: number | null
          calories?: number | null
          created_at?: string
          duration?: number | null
          elevationgain?: number | null
          hasgps?: boolean | null
          id?: string
          is_weekend?: boolean | null
          participant_id: number
          raw?: Json | null
          start_day_in_study: number
          start_timestamp?: string | null
          steps?: number | null
          study_interval: number
        }
        Update: {
          activeduration?: number | null
          activityname?: string | null
          activitytypeid?: string | null
          averageheartrate?: number | null
          calories?: number | null
          created_at?: string
          duration?: number | null
          elevationgain?: number | null
          hasgps?: boolean | null
          id?: string
          is_weekend?: boolean | null
          participant_id?: number
          raw?: Json | null
          start_day_in_study?: number
          start_timestamp?: string | null
          steps?: number | null
          study_interval?: number
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_exercise_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_glucose: {
        Row: {
          created_at: string
          day_in_study: number | null
          glucose_value: number | null
          id: string
          is_weekend: boolean | null
          participant_id: number
          raw: Json | null
          study_interval: number
          timestamp_local: string
        }
        Insert: {
          created_at?: string
          day_in_study?: number | null
          glucose_value?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id: number
          raw?: Json | null
          study_interval: number
          timestamp_local: string
        }
        Update: {
          created_at?: string
          day_in_study?: number | null
          glucose_value?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id?: number
          raw?: Json | null
          study_interval?: number
          timestamp_local?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_glucose_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_heart_rate: {
        Row: {
          bpm: number | null
          confidence: number | null
          created_at: string
          day_in_study: number | null
          id: string
          is_weekend: boolean | null
          participant_id: number
          raw: Json | null
          study_interval: number
          timestamp_local: string
        }
        Insert: {
          bpm?: number | null
          confidence?: number | null
          created_at?: string
          day_in_study?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id: number
          raw?: Json | null
          study_interval: number
          timestamp_local: string
        }
        Update: {
          bpm?: number | null
          confidence?: number | null
          created_at?: string
          day_in_study?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id?: number
          raw?: Json | null
          study_interval?: number
          timestamp_local?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_heart_rate_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_height_weight: {
        Row: {
          created_at: string
          height_2022: number | null
          height_2024: number | null
          participant_id: number
          raw: Json | null
          weight_2022: number | null
          weight_2024: number | null
        }
        Insert: {
          created_at?: string
          height_2022?: number | null
          height_2024?: number | null
          participant_id: number
          raw?: Json | null
          weight_2022?: number | null
          weight_2024?: number | null
        }
        Update: {
          created_at?: string
          height_2022?: number | null
          height_2024?: number | null
          participant_id?: number
          raw?: Json | null
          weight_2022?: number | null
          weight_2024?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_height_weight_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_hormones_selfreport: {
        Row: {
          appetite: number | null
          bloating: number | null
          cramps: number | null
          created_at: string
          day_in_study: number
          estrogen: number | null
          exerciselevel: number | null
          fatigue: number | null
          flow_color: string | null
          flow_volume: number | null
          foodcravings: number | null
          headaches: number | null
          id: string
          indigestion: number | null
          is_weekend: boolean | null
          lh: number | null
          moodswing: number | null
          participant_id: number
          pdg: number | null
          phase: string | null
          raw: Json | null
          sleepissue: number | null
          sorebreasts: number | null
          stress: number | null
          study_interval: number
        }
        Insert: {
          appetite?: number | null
          bloating?: number | null
          cramps?: number | null
          created_at?: string
          day_in_study: number
          estrogen?: number | null
          exerciselevel?: number | null
          fatigue?: number | null
          flow_color?: string | null
          flow_volume?: number | null
          foodcravings?: number | null
          headaches?: number | null
          id?: string
          indigestion?: number | null
          is_weekend?: boolean | null
          lh?: number | null
          moodswing?: number | null
          participant_id: number
          pdg?: number | null
          phase?: string | null
          raw?: Json | null
          sleepissue?: number | null
          sorebreasts?: number | null
          stress?: number | null
          study_interval: number
        }
        Update: {
          appetite?: number | null
          bloating?: number | null
          cramps?: number | null
          created_at?: string
          day_in_study?: number
          estrogen?: number | null
          exerciselevel?: number | null
          fatigue?: number | null
          flow_color?: string | null
          flow_volume?: number | null
          foodcravings?: number | null
          headaches?: number | null
          id?: string
          indigestion?: number | null
          is_weekend?: boolean | null
          lh?: number | null
          moodswing?: number | null
          participant_id?: number
          pdg?: number | null
          phase?: string | null
          raw?: Json | null
          sleepissue?: number | null
          sorebreasts?: number | null
          stress?: number | null
          study_interval?: number
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_hormones_selfreport_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_hrv_details: {
        Row: {
          coverage: number | null
          created_at: string
          day_in_study: number | null
          high_frequency: number | null
          id: string
          is_weekend: boolean | null
          low_frequency: number | null
          participant_id: number
          raw: Json | null
          rmssd: number | null
          study_interval: number
          timestamp_local: string
        }
        Insert: {
          coverage?: number | null
          created_at?: string
          day_in_study?: number | null
          high_frequency?: number | null
          id?: string
          is_weekend?: boolean | null
          low_frequency?: number | null
          participant_id: number
          raw?: Json | null
          rmssd?: number | null
          study_interval: number
          timestamp_local: string
        }
        Update: {
          coverage?: number | null
          created_at?: string
          day_in_study?: number | null
          high_frequency?: number | null
          id?: string
          is_weekend?: boolean | null
          low_frequency?: number | null
          participant_id?: number
          raw?: Json | null
          rmssd?: number | null
          study_interval?: number
          timestamp_local?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_hrv_details_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_ingest_runs: {
        Row: {
          created_at: string
          errors: Json
          filename: string | null
          id: string
          participants: number
          rows_inserted: number
          rows_skipped: number
          rows_updated: number
          stats: Json
          table_name: string
        }
        Insert: {
          created_at?: string
          errors?: Json
          filename?: string | null
          id?: string
          participants?: number
          rows_inserted?: number
          rows_skipped?: number
          rows_updated?: number
          stats?: Json
          table_name: string
        }
        Update: {
          created_at?: string
          errors?: Json
          filename?: string | null
          id?: string
          participants?: number
          rows_inserted?: number
          rows_skipped?: number
          rows_updated?: number
          stats?: Json
          table_name?: string
        }
        Relationships: []
      }
      mcphases_participants: {
        Row: {
          first_seen_at: string
          notes: string | null
          participant_id: number
        }
        Insert: {
          first_seen_at?: string
          notes?: string | null
          participant_id: number
        }
        Update: {
          first_seen_at?: string
          notes?: string | null
          participant_id?: number
        }
        Relationships: []
      }
      mcphases_respiratory_rate_summary: {
        Row: {
          created_at: string
          day_in_study: number | null
          deep_sleep_breathing_rate: number | null
          deep_sleep_signal_to_noise: number | null
          deep_sleep_standard_deviation: number | null
          full_sleep_breathing_rate: number | null
          full_sleep_signal_to_noise: number | null
          full_sleep_standard_deviation: number | null
          id: string
          is_weekend: boolean | null
          light_sleep_breathing_rate: number | null
          light_sleep_signal_to_noise: number | null
          light_sleep_standard_deviation: number | null
          participant_id: number
          raw: Json | null
          rem_sleep_breathing_rate: number | null
          rem_sleep_signal_to_noise: number | null
          rem_sleep_standard_deviation: number | null
          study_interval: number
          timestamp_local: string | null
        }
        Insert: {
          created_at?: string
          day_in_study?: number | null
          deep_sleep_breathing_rate?: number | null
          deep_sleep_signal_to_noise?: number | null
          deep_sleep_standard_deviation?: number | null
          full_sleep_breathing_rate?: number | null
          full_sleep_signal_to_noise?: number | null
          full_sleep_standard_deviation?: number | null
          id?: string
          is_weekend?: boolean | null
          light_sleep_breathing_rate?: number | null
          light_sleep_signal_to_noise?: number | null
          light_sleep_standard_deviation?: number | null
          participant_id: number
          raw?: Json | null
          rem_sleep_breathing_rate?: number | null
          rem_sleep_signal_to_noise?: number | null
          rem_sleep_standard_deviation?: number | null
          study_interval: number
          timestamp_local?: string | null
        }
        Update: {
          created_at?: string
          day_in_study?: number | null
          deep_sleep_breathing_rate?: number | null
          deep_sleep_signal_to_noise?: number | null
          deep_sleep_standard_deviation?: number | null
          full_sleep_breathing_rate?: number | null
          full_sleep_signal_to_noise?: number | null
          full_sleep_standard_deviation?: number | null
          id?: string
          is_weekend?: boolean | null
          light_sleep_breathing_rate?: number | null
          light_sleep_signal_to_noise?: number | null
          light_sleep_standard_deviation?: number | null
          participant_id?: number
          raw?: Json | null
          rem_sleep_breathing_rate?: number | null
          rem_sleep_signal_to_noise?: number | null
          rem_sleep_standard_deviation?: number | null
          study_interval?: number
          timestamp_local?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_respiratory_rate_summary_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_resting_heart_rate: {
        Row: {
          created_at: string
          day_in_study: number
          error: number | null
          id: string
          is_weekend: boolean | null
          participant_id: number
          raw: Json | null
          study_interval: number
          value: number | null
        }
        Insert: {
          created_at?: string
          day_in_study: number
          error?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id: number
          raw?: Json | null
          study_interval: number
          value?: number | null
        }
        Update: {
          created_at?: string
          day_in_study?: number
          error?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id?: number
          raw?: Json | null
          study_interval?: number
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_resting_heart_rate_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_sleep: {
        Row: {
          created_at: string
          duration: number | null
          efficiency: number | null
          id: string
          info_code: string | null
          is_weekend: boolean | null
          levels: Json | null
          main_sleep: boolean | null
          minutes_after_wakeup: number | null
          minutes_asleep: number | null
          minutes_awake: number | null
          minutes_to_fall_asleep: number | null
          participant_id: number
          raw: Json | null
          sleep_end_day_in_study: number | null
          sleep_end_timestamp: string | null
          sleep_start_day_in_study: number
          sleep_start_timestamp: string | null
          study_interval: number
          time_in_bed: number | null
          type: string | null
        }
        Insert: {
          created_at?: string
          duration?: number | null
          efficiency?: number | null
          id?: string
          info_code?: string | null
          is_weekend?: boolean | null
          levels?: Json | null
          main_sleep?: boolean | null
          minutes_after_wakeup?: number | null
          minutes_asleep?: number | null
          minutes_awake?: number | null
          minutes_to_fall_asleep?: number | null
          participant_id: number
          raw?: Json | null
          sleep_end_day_in_study?: number | null
          sleep_end_timestamp?: string | null
          sleep_start_day_in_study: number
          sleep_start_timestamp?: string | null
          study_interval: number
          time_in_bed?: number | null
          type?: string | null
        }
        Update: {
          created_at?: string
          duration?: number | null
          efficiency?: number | null
          id?: string
          info_code?: string | null
          is_weekend?: boolean | null
          levels?: Json | null
          main_sleep?: boolean | null
          minutes_after_wakeup?: number | null
          minutes_asleep?: number | null
          minutes_awake?: number | null
          minutes_to_fall_asleep?: number | null
          participant_id?: number
          raw?: Json | null
          sleep_end_day_in_study?: number | null
          sleep_end_timestamp?: string | null
          sleep_start_day_in_study?: number
          sleep_start_timestamp?: string | null
          study_interval?: number
          time_in_bed?: number | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_sleep_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_sleep_score: {
        Row: {
          composition_score: number | null
          created_at: string
          day_in_study: number
          deep_sleep_in_minutes: number | null
          duration_score: number | null
          id: string
          is_weekend: boolean | null
          overall_score: number | null
          participant_id: number
          raw: Json | null
          resting_heart_rate: number | null
          restlessness: number | null
          revitalization_score: number | null
          study_interval: number
          timestamp_local: string | null
        }
        Insert: {
          composition_score?: number | null
          created_at?: string
          day_in_study: number
          deep_sleep_in_minutes?: number | null
          duration_score?: number | null
          id?: string
          is_weekend?: boolean | null
          overall_score?: number | null
          participant_id: number
          raw?: Json | null
          resting_heart_rate?: number | null
          restlessness?: number | null
          revitalization_score?: number | null
          study_interval: number
          timestamp_local?: string | null
        }
        Update: {
          composition_score?: number | null
          created_at?: string
          day_in_study?: number
          deep_sleep_in_minutes?: number | null
          duration_score?: number | null
          id?: string
          is_weekend?: boolean | null
          overall_score?: number | null
          participant_id?: number
          raw?: Json | null
          resting_heart_rate?: number | null
          restlessness?: number | null
          revitalization_score?: number | null
          study_interval?: number
          timestamp_local?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_sleep_score_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_steps: {
        Row: {
          created_at: string
          day_in_study: number | null
          id: string
          is_weekend: boolean | null
          participant_id: number
          raw: Json | null
          steps: number | null
          study_interval: number
          timestamp_local: string
        }
        Insert: {
          created_at?: string
          day_in_study?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id: number
          raw?: Json | null
          steps?: number | null
          study_interval: number
          timestamp_local: string
        }
        Update: {
          created_at?: string
          day_in_study?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id?: number
          raw?: Json | null
          steps?: number | null
          study_interval?: number
          timestamp_local?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_steps_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_stress_score: {
        Row: {
          calculation_failed: boolean | null
          created_at: string
          day_in_study: number
          exertion_points: number | null
          id: string
          is_weekend: boolean | null
          max_exertion_points: number | null
          max_responsiveness_points: number | null
          max_sleep_points: number | null
          participant_id: number
          raw: Json | null
          responsiveness_points: number | null
          sleep_points: number | null
          status: string | null
          stress_score: number | null
          study_interval: number
          timestamp_local: string | null
        }
        Insert: {
          calculation_failed?: boolean | null
          created_at?: string
          day_in_study: number
          exertion_points?: number | null
          id?: string
          is_weekend?: boolean | null
          max_exertion_points?: number | null
          max_responsiveness_points?: number | null
          max_sleep_points?: number | null
          participant_id: number
          raw?: Json | null
          responsiveness_points?: number | null
          sleep_points?: number | null
          status?: string | null
          stress_score?: number | null
          study_interval: number
          timestamp_local?: string | null
        }
        Update: {
          calculation_failed?: boolean | null
          created_at?: string
          day_in_study?: number
          exertion_points?: number | null
          id?: string
          is_weekend?: boolean | null
          max_exertion_points?: number | null
          max_responsiveness_points?: number | null
          max_sleep_points?: number | null
          participant_id?: number
          raw?: Json | null
          responsiveness_points?: number | null
          sleep_points?: number | null
          status?: string | null
          stress_score?: number | null
          study_interval?: number
          timestamp_local?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_stress_score_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_subject_info: {
        Row: {
          age_of_first_menarche: number | null
          birth_year: number | null
          created_at: string
          education: string | null
          employment: string | null
          ethnicity: string | null
          gender: string | null
          income: string | null
          participant_id: number
          raw: Json | null
          self_report_menstrual_health_literacy: string | null
          sexually_active: string | null
        }
        Insert: {
          age_of_first_menarche?: number | null
          birth_year?: number | null
          created_at?: string
          education?: string | null
          employment?: string | null
          ethnicity?: string | null
          gender?: string | null
          income?: string | null
          participant_id: number
          raw?: Json | null
          self_report_menstrual_health_literacy?: string | null
          sexually_active?: string | null
        }
        Update: {
          age_of_first_menarche?: number | null
          birth_year?: number | null
          created_at?: string
          education?: string | null
          employment?: string | null
          ethnicity?: string | null
          gender?: string | null
          income?: string | null
          participant_id?: number
          raw?: Json | null
          self_report_menstrual_health_literacy?: string | null
          sexually_active?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_subject_info_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_time_in_hr_zones: {
        Row: {
          below_default_zone_1: number | null
          created_at: string
          day_in_study: number
          id: string
          in_default_zone_1: number | null
          in_default_zone_2: number | null
          in_default_zone_3: number | null
          is_weekend: boolean | null
          participant_id: number
          raw: Json | null
          study_interval: number
        }
        Insert: {
          below_default_zone_1?: number | null
          created_at?: string
          day_in_study: number
          id?: string
          in_default_zone_1?: number | null
          in_default_zone_2?: number | null
          in_default_zone_3?: number | null
          is_weekend?: boolean | null
          participant_id: number
          raw?: Json | null
          study_interval: number
        }
        Update: {
          below_default_zone_1?: number | null
          created_at?: string
          day_in_study?: number
          id?: string
          in_default_zone_1?: number | null
          in_default_zone_2?: number | null
          in_default_zone_3?: number | null
          is_weekend?: boolean | null
          participant_id?: number
          raw?: Json | null
          study_interval?: number
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_time_in_hr_zones_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      mcphases_wrist_temperature: {
        Row: {
          created_at: string
          day_in_study: number | null
          id: string
          is_weekend: boolean | null
          participant_id: number
          raw: Json | null
          study_interval: number
          temperature_diff_from_baseline: number | null
          timestamp_local: string
        }
        Insert: {
          created_at?: string
          day_in_study?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id: number
          raw?: Json | null
          study_interval: number
          temperature_diff_from_baseline?: number | null
          timestamp_local: string
        }
        Update: {
          created_at?: string
          day_in_study?: number | null
          id?: string
          is_weekend?: boolean | null
          participant_id?: number
          raw?: Json | null
          study_interval?: number
          temperature_diff_from_baseline?: number | null
          timestamp_local?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcphases_wrist_temperature_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "mcphases_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
