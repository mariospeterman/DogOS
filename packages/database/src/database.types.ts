export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  api: {
    Tables: {
      anamneses: {
        Row: {
          completed_at: string | null;
          completeness: number | null;
          created_at: string;
          created_by: string;
          dog_id: string;
          id: string;
          quality_status: string | null;
          status: string;
          version: number;
        };
        Insert: {
          completed_at?: string | null;
          completeness?: number | null;
          created_at?: string;
          created_by: string;
          dog_id: string;
          id?: string;
          quality_status?: string | null;
          status?: string;
          version: number;
        };
        Update: {
          completed_at?: string | null;
          completeness?: number | null;
          created_at?: string;
          created_by?: string;
          dog_id?: string;
          id?: string;
          quality_status?: string | null;
          status?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "anamneses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anamneses_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
        ];
      };
      anamnesis_answers: {
        Row: {
          anamnesis_id: string;
          answer_state: string;
          answer_value: Json | null;
          canonical_answer_code: string | null;
          collected_channel: string;
          created_at: string;
          id: string;
          question_definition_id: string;
          raw_answer_locale: string | null;
          raw_answer_text: string | null;
          source: string;
        };
        Insert: {
          anamnesis_id: string;
          answer_state?: string;
          answer_value?: Json | null;
          canonical_answer_code?: string | null;
          collected_channel: string;
          created_at?: string;
          id?: string;
          question_definition_id: string;
          raw_answer_locale?: string | null;
          raw_answer_text?: string | null;
          source?: string;
        };
        Update: {
          anamnesis_id?: string;
          answer_state?: string;
          answer_value?: Json | null;
          canonical_answer_code?: string | null;
          collected_channel?: string;
          created_at?: string;
          id?: string;
          question_definition_id?: string;
          raw_answer_locale?: string | null;
          raw_answer_text?: string | null;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "anamnesis_answers_anamnesis_id_fkey";
            columns: ["anamnesis_id"];
            isOneToOne: false;
            referencedRelation: "anamneses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anamnesis_answers_question_definition_id_fkey";
            columns: ["question_definition_id"];
            isOneToOne: false;
            referencedRelation: "question_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
      behavior_concerns: {
        Row: {
          anamnesis_id: string | null;
          concern_code: string;
          context: Json;
          created_at: string;
          dog_id: string;
          frequency_code: string | null;
          id: string;
          intensity: number | null;
          source: string;
          trigger_codes: unknown[];
          updated_at: string;
        };
        Insert: {
          anamnesis_id?: string | null;
          concern_code: string;
          context?: Json;
          created_at?: string;
          dog_id: string;
          frequency_code?: string | null;
          id?: string;
          intensity?: number | null;
          source?: string;
          trigger_codes?: unknown[];
          updated_at?: string;
        };
        Update: {
          anamnesis_id?: string | null;
          concern_code?: string;
          context?: Json;
          created_at?: string;
          dog_id?: string;
          frequency_code?: string | null;
          id?: string;
          intensity?: number | null;
          source?: string;
          trigger_codes?: unknown[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "behavior_concerns_anamnesis_id_fkey";
            columns: ["anamnesis_id"];
            isOneToOne: false;
            referencedRelation: "anamneses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "behavior_concerns_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          canonical_status: string;
          created_at: string;
          id: string;
          professional_referral_id: string;
          provider: string;
          provider_booking_id: string | null;
          provider_event_version: string | null;
          scheduled_at: string | null;
          trainer_id: string;
          updated_at: string;
        };
        Insert: {
          canonical_status: string;
          created_at?: string;
          id?: string;
          professional_referral_id: string;
          provider: string;
          provider_booking_id?: string | null;
          provider_event_version?: string | null;
          scheduled_at?: string | null;
          trainer_id: string;
          updated_at?: string;
        };
        Update: {
          canonical_status?: string;
          created_at?: string;
          id?: string;
          professional_referral_id?: string;
          provider?: string;
          provider_booking_id?: string | null;
          provider_event_version?: string | null;
          scheduled_at?: string | null;
          trainer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_professional_referral_id_fkey";
            columns: ["professional_referral_id"];
            isOneToOne: false;
            referencedRelation: "professional_referrals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      breed_aliases: {
        Row: {
          alias: string;
          alias_type: string;
          breed_taxonomy_id: string;
          created_at: string;
          id: string;
          locale: string;
        };
        Insert: {
          alias: string;
          alias_type?: string;
          breed_taxonomy_id: string;
          created_at?: string;
          id?: string;
          locale: string;
        };
        Update: {
          alias?: string;
          alias_type?: string;
          breed_taxonomy_id?: string;
          created_at?: string;
          id?: string;
          locale?: string;
        };
        Relationships: [
          {
            foreignKeyName: "breed_aliases_breed_taxonomy_id_fkey";
            columns: ["breed_taxonomy_id"];
            isOneToOne: false;
            referencedRelation: "breed_taxonomy";
            referencedColumns: ["id"];
          },
        ];
      };
      breed_taxonomy: {
        Row: {
          canonical_breed_code: string;
          created_at: string;
          fci_reference: string | null;
          id: string;
          recognition_status: string;
          validity_state: Database["api"]["Enums"]["validity_state"];
          vbo_id: string | null;
          version: number;
        };
        Insert: {
          canonical_breed_code: string;
          created_at?: string;
          fci_reference?: string | null;
          id?: string;
          recognition_status: string;
          validity_state?: Database["api"]["Enums"]["validity_state"];
          vbo_id?: string | null;
          version: number;
        };
        Update: {
          canonical_breed_code?: string;
          created_at?: string;
          fci_reference?: string | null;
          id?: string;
          recognition_status?: string;
          validity_state?: Database["api"]["Enums"]["validity_state"];
          vbo_id?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      calendar_exports: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          plan_version_id: string;
          revoked_at: string | null;
          schedule_version: number;
          token_hash: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          plan_version_id: string;
          revoked_at?: string | null;
          schedule_version: number;
          token_hash: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          plan_version_id?: string;
          revoked_at?: string | null;
          schedule_version?: number;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_exports_plan_version_id_fkey";
            columns: ["plan_version_id"];
            isOneToOne: false;
            referencedRelation: "plan_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      consent_documents: {
        Row: {
          canonical_document_id: string;
          created_at: string;
          document_type: string;
          effective_from: string;
          effective_until: string | null;
          id: string;
          legal_jurisdiction: string;
          legal_text_hash: string;
          validity_state: Database["api"]["Enums"]["validity_state"];
          version: number;
        };
        Insert: {
          canonical_document_id: string;
          created_at?: string;
          document_type: string;
          effective_from: string;
          effective_until?: string | null;
          id?: string;
          legal_jurisdiction: string;
          legal_text_hash: string;
          validity_state?: Database["api"]["Enums"]["validity_state"];
          version: number;
        };
        Update: {
          canonical_document_id?: string;
          created_at?: string;
          document_type?: string;
          effective_from?: string;
          effective_until?: string | null;
          id?: string;
          legal_jurisdiction?: string;
          legal_text_hash?: string;
          validity_state?: Database["api"]["Enums"]["validity_state"];
          version?: number;
        };
        Relationships: [];
      };
      consents: {
        Row: {
          acquisition_channel: string;
          consent_document_id: string;
          created_at: string;
          evidence_reference: string | null;
          granted_at: string;
          household_id: string | null;
          id: string;
          presented_localized_content_id: string;
          scope: Json;
          user_id: string;
          withdrawn_at: string | null;
        };
        Insert: {
          acquisition_channel: string;
          consent_document_id: string;
          created_at?: string;
          evidence_reference?: string | null;
          granted_at: string;
          household_id?: string | null;
          id?: string;
          presented_localized_content_id: string;
          scope?: Json;
          user_id: string;
          withdrawn_at?: string | null;
        };
        Update: {
          acquisition_channel?: string;
          consent_document_id?: string;
          created_at?: string;
          evidence_reference?: string | null;
          granted_at?: string;
          household_id?: string | null;
          id?: string;
          presented_localized_content_id?: string;
          scope?: Json;
          user_id?: string;
          withdrawn_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "consents_consent_document_id_fkey";
            columns: ["consent_document_id"];
            isOneToOne: false;
            referencedRelation: "consent_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consents_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consents_presented_localized_content_id_fkey";
            columns: ["presented_localized_content_id"];
            isOneToOne: false;
            referencedRelation: "localized_content";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_sessions: {
        Row: {
          active_locale: string;
          channel: string;
          contact_id: string | null;
          created_at: string;
          detected_locale: string | null;
          detected_locale_confidence: number | null;
          ended_at: string | null;
          household_id: string | null;
          id: string;
          locale_source: string;
          started_at: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          active_locale?: string;
          channel?: string;
          contact_id?: string | null;
          created_at?: string;
          detected_locale?: string | null;
          detected_locale_confidence?: number | null;
          ended_at?: string | null;
          household_id?: string | null;
          id?: string;
          locale_source?: string;
          started_at?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          active_locale?: string;
          channel?: string;
          contact_id?: string | null;
          created_at?: string;
          detected_locale?: string | null;
          detected_locale_confidence?: number | null;
          ended_at?: string | null;
          household_id?: string | null;
          id?: string;
          locale_source?: string;
          started_at?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_sessions_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "user_contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_sessions_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      correlation_observations: {
        Row: {
          caveat_code: string;
          created_at: string;
          dog_id: string;
          effect_summary: Json | null;
          factor_code: string;
          id: string;
          minimum_sample_size: number;
          outcome_code: string;
          sample_size: number;
          status: string;
          window_definition: Json;
        };
        Insert: {
          caveat_code?: string;
          created_at?: string;
          dog_id: string;
          effect_summary?: Json | null;
          factor_code: string;
          id?: string;
          minimum_sample_size: number;
          outcome_code: string;
          sample_size: number;
          status: string;
          window_definition: Json;
        };
        Update: {
          caveat_code?: string;
          created_at?: string;
          dog_id?: string;
          effect_summary?: Json | null;
          factor_code?: string;
          id?: string;
          minimum_sample_size?: number;
          outcome_code?: string;
          sample_size?: number;
          status?: string;
          window_definition?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "correlation_observations_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
        ];
      };
      data_quality_assessments: {
        Row: {
          assessed_at: string;
          completeness: number | null;
          consistency: number | null;
          created_at: string;
          dog_id: string;
          id: string;
          reason_codes: unknown[];
          reliability: number | null;
          session_id: string | null;
        };
        Insert: {
          assessed_at?: string;
          completeness?: number | null;
          consistency?: number | null;
          created_at?: string;
          dog_id: string;
          id?: string;
          reason_codes?: unknown[];
          reliability?: number | null;
          session_id?: string | null;
        };
        Update: {
          assessed_at?: string;
          completeness?: number | null;
          consistency?: number | null;
          created_at?: string;
          dog_id?: string;
          id?: string;
          reason_codes?: unknown[];
          reliability?: number | null;
          session_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "data_quality_assessments_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "data_quality_assessments_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      dog_breed_links: {
        Row: {
          breed_taxonomy_id: string;
          created_at: string;
          dog_id: string;
          id: string;
          source: string;
          user_certainty: number | null;
        };
        Insert: {
          breed_taxonomy_id: string;
          created_at?: string;
          dog_id: string;
          id?: string;
          source: string;
          user_certainty?: number | null;
        };
        Update: {
          breed_taxonomy_id?: string;
          created_at?: string;
          dog_id?: string;
          id?: string;
          source?: string;
          user_certainty?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "dog_breed_links_breed_taxonomy_id_fkey";
            columns: ["breed_taxonomy_id"];
            isOneToOne: false;
            referencedRelation: "breed_taxonomy";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dog_breed_links_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
        ];
      };
      dog_health_context: {
        Row: {
          created_at: string;
          dog_id: string;
          id: string;
          medications: Json;
          mobility_constraints: unknown[];
          reported_at: string;
          reported_conditions: unknown[];
          source: string;
          sudden_behavior_change: boolean | null;
          suspected_pain: boolean | null;
        };
        Insert: {
          created_at?: string;
          dog_id: string;
          id?: string;
          medications?: Json;
          mobility_constraints?: unknown[];
          reported_at?: string;
          reported_conditions?: unknown[];
          source?: string;
          sudden_behavior_change?: boolean | null;
          suspected_pain?: boolean | null;
        };
        Update: {
          created_at?: string;
          dog_id?: string;
          id?: string;
          medications?: Json;
          mobility_constraints?: unknown[];
          reported_at?: string;
          reported_conditions?: unknown[];
          source?: string;
          sudden_behavior_change?: boolean | null;
          suspected_pain?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "dog_health_context_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
        ];
      };
      dog_history: {
        Row: {
          created_at: string;
          dog_id: string;
          household_since: string | null;
          id: string;
          life_events: Json;
          methods_and_aids: Json;
          origin_code: string | null;
          source: string;
          training_history: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          dog_id: string;
          household_since?: string | null;
          id?: string;
          life_events?: Json;
          methods_and_aids?: Json;
          origin_code?: string | null;
          source?: string;
          training_history?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          dog_id?: string;
          household_since?: string | null;
          id?: string;
          life_events?: Json;
          methods_and_aids?: Json;
          origin_code?: string | null;
          source?: string;
          training_history?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dog_history_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
        ];
      };
      dogs: {
        Row: {
          birth_date_estimate: string | null;
          breed_status: string;
          created_at: string;
          created_by: string;
          household_id: string;
          id: string;
          name: string;
          neuter_status: string | null;
          sex: string | null;
          size_category: string | null;
          status: string;
          updated_at: string;
          weight_kg: number | null;
        };
        Insert: {
          birth_date_estimate?: string | null;
          breed_status?: string;
          created_at?: string;
          created_by: string;
          household_id: string;
          id?: string;
          name: string;
          neuter_status?: string | null;
          sex?: string | null;
          size_category?: string | null;
          status?: string;
          updated_at?: string;
          weight_kg?: number | null;
        };
        Update: {
          birth_date_estimate?: string | null;
          breed_status?: string;
          created_at?: string;
          created_by?: string;
          household_id?: string;
          id?: string;
          name?: string;
          neuter_status?: string | null;
          sex?: string | null;
          size_category?: string | null;
          status?: string;
          updated_at?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "dogs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dogs_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      entitlements: {
        Row: {
          capability_code: string;
          created_at: string;
          effective_from: string;
          effective_until: string | null;
          household_id: string;
          id: string;
          limits: Json;
          source_code: string;
          status: string;
          subscription_id: string | null;
        };
        Insert: {
          capability_code: string;
          created_at?: string;
          effective_from: string;
          effective_until?: string | null;
          household_id: string;
          id?: string;
          limits?: Json;
          source_code: string;
          status: string;
          subscription_id?: string | null;
        };
        Update: {
          capability_code?: string;
          created_at?: string;
          effective_from?: string;
          effective_until?: string | null;
          household_id?: string;
          id?: string;
          limits?: Json;
          source_code?: string;
          status?: string;
          subscription_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "entitlements_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entitlements_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      goal_measurements: {
        Row: {
          created_at: string;
          environment_code: string | null;
          goal_version_id: string;
          id: string;
          is_unknown: boolean;
          measured_at: string;
          method_code: string | null;
          metric_code: string;
          quality: string;
          source: string;
          unit_code: string | null;
          unknown_reason: string | null;
          value_boolean: boolean | null;
          value_json: Json | null;
          value_numeric: number | null;
          value_text: string | null;
        };
        Insert: {
          created_at?: string;
          environment_code?: string | null;
          goal_version_id: string;
          id?: string;
          is_unknown?: boolean;
          measured_at: string;
          method_code?: string | null;
          metric_code: string;
          quality: string;
          source: string;
          unit_code?: string | null;
          unknown_reason?: string | null;
          value_boolean?: boolean | null;
          value_json?: Json | null;
          value_numeric?: number | null;
          value_text?: string | null;
        };
        Update: {
          created_at?: string;
          environment_code?: string | null;
          goal_version_id?: string;
          id?: string;
          is_unknown?: boolean;
          measured_at?: string;
          method_code?: string | null;
          metric_code?: string;
          quality?: string;
          source?: string;
          unit_code?: string | null;
          unknown_reason?: string | null;
          value_boolean?: boolean | null;
          value_json?: Json | null;
          value_numeric?: number | null;
          value_text?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "goal_measurements_goal_version_id_fkey";
            columns: ["goal_version_id"];
            isOneToOne: false;
            referencedRelation: "goal_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      goal_versions: {
        Row: {
          baseline_definition: Json;
          created_at: string;
          difficulty_definition: Json;
          environment_code: string | null;
          escalation_criteria: Json;
          goal_id: string;
          horizon_days: number | null;
          id: string;
          measurement_definitions: unknown[];
          stop_criteria: Json;
          success_criteria: Json;
          target_definition: Json;
          version: number;
        };
        Insert: {
          baseline_definition: Json;
          created_at?: string;
          difficulty_definition?: Json;
          environment_code?: string | null;
          escalation_criteria: Json;
          goal_id: string;
          horizon_days?: number | null;
          id?: string;
          measurement_definitions: unknown[];
          stop_criteria: Json;
          success_criteria: Json;
          target_definition: Json;
          version: number;
        };
        Update: {
          baseline_definition?: Json;
          created_at?: string;
          difficulty_definition?: Json;
          environment_code?: string | null;
          escalation_criteria?: Json;
          goal_id?: string;
          horizon_days?: number | null;
          id?: string;
          measurement_definitions?: unknown[];
          stop_criteria?: Json;
          success_criteria?: Json;
          target_definition?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "goal_versions_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
        ];
      };
      goals: {
        Row: {
          canonical_goal_type: string;
          created_at: string;
          dog_id: string;
          id: string;
          owner_goal_locale: string;
          owner_goal_text: string;
          owner_user_id: string;
          priority: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          canonical_goal_type: string;
          created_at?: string;
          dog_id: string;
          id?: string;
          owner_goal_locale: string;
          owner_goal_text: string;
          owner_user_id: string;
          priority?: number;
          status?: string;
          updated_at?: string;
        };
        Update: {
          canonical_goal_type?: string;
          created_at?: string;
          dog_id?: string;
          id?: string;
          owner_goal_locale?: string;
          owner_goal_text?: string;
          owner_user_id?: string;
          priority?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goals_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goals_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      household_context: {
        Row: {
          adults_count: number | null;
          child_age_bands: string[];
          children_present: boolean | null;
          created_at: string;
          household_id: string;
          id: string;
          management_constraints: unknown[];
          other_animals: Json;
          routines: Json;
          setting_code: string | null;
          updated_at: string;
        };
        Insert: {
          adults_count?: number | null;
          child_age_bands?: string[];
          children_present?: boolean | null;
          created_at?: string;
          household_id: string;
          id?: string;
          management_constraints?: unknown[];
          other_animals?: Json;
          routines?: Json;
          setting_code?: string | null;
          updated_at?: string;
        };
        Update: {
          adults_count?: number | null;
          child_age_bands?: string[];
          children_present?: boolean | null;
          created_at?: string;
          household_id?: string;
          id?: string;
          management_constraints?: unknown[];
          other_animals?: Json;
          routines?: Json;
          setting_code?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_context_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: true;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      household_members: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          invited_at: string | null;
          joined_at: string | null;
          revoked_at: string | null;
          role: Database["api"]["Enums"]["membership_role"];
          status: Database["api"]["Enums"]["membership_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          household_id: string;
          id?: string;
          invited_at?: string | null;
          joined_at?: string | null;
          revoked_at?: string | null;
          role: Database["api"]["Enums"]["membership_role"];
          status?: Database["api"]["Enums"]["membership_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          id?: string;
          invited_at?: string | null;
          joined_at?: string | null;
          revoked_at?: string | null;
          role?: Database["api"]["Enums"]["membership_role"];
          status?: Database["api"]["Enums"]["membership_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "household_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      households: {
        Row: {
          country: string;
          created_at: string;
          created_by: string;
          currency: string;
          default_locale: string;
          fallback_locale: string;
          id: string;
          legal_jurisdiction: string;
          name: string;
          status: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          country?: string;
          created_at?: string;
          created_by: string;
          currency?: string;
          default_locale?: string;
          fallback_locale?: string;
          id?: string;
          legal_jurisdiction?: string;
          name: string;
          status?: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          country?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          default_locale?: string;
          fallback_locale?: string;
          id?: string;
          legal_jurisdiction?: string;
          name?: string;
          status?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "households_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      hypotheses: {
        Row: {
          confidence: number | null;
          contradicting_observation_ids: string[];
          created_at: string;
          dog_id: string;
          excluded_claim_codes: unknown[];
          hypothesis_code: string;
          id: string;
          review_status: string;
          supporting_observation_ids: string[];
        };
        Insert: {
          confidence?: number | null;
          contradicting_observation_ids?: string[];
          created_at?: string;
          dog_id: string;
          excluded_claim_codes?: unknown[];
          hypothesis_code: string;
          id?: string;
          review_status?: string;
          supporting_observation_ids?: string[];
        };
        Update: {
          confidence?: number | null;
          contradicting_observation_ids?: string[];
          created_at?: string;
          dog_id?: string;
          excluded_claim_codes?: unknown[];
          hypothesis_code?: string;
          id?: string;
          review_status?: string;
          supporting_observation_ids?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "hypotheses_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
        ];
      };
      legal_document_localizations: {
        Row: {
          consent_document_id: string;
          created_at: string;
          id: string;
          localized_content_id: string;
        };
        Insert: {
          consent_document_id: string;
          created_at?: string;
          id?: string;
          localized_content_id: string;
        };
        Update: {
          consent_document_id?: string;
          created_at?: string;
          id?: string;
          localized_content_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "legal_document_localizations_consent_document_id_fkey";
            columns: ["consent_document_id"];
            isOneToOne: false;
            referencedRelation: "consent_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "legal_document_localizations_localized_content_id_fkey";
            columns: ["localized_content_id"];
            isOneToOne: false;
            referencedRelation: "localized_content";
            referencedColumns: ["id"];
          },
        ];
      };
      live_coaching_sessions: {
        Row: {
          actor_user_id: string;
          completed_at: string | null;
          consumed_minutes: number;
          created_at: string;
          dog_id: string;
          household_id: string;
          id: string;
          planned_minutes: number;
          room_name: string;
          started_at: string | null;
          status: Database["api"]["Enums"]["live_coaching_status"];
          summary: string | null;
          updated_at: string;
        };
        Insert: {
          actor_user_id: string;
          completed_at?: string | null;
          consumed_minutes?: number;
          created_at?: string;
          dog_id: string;
          household_id: string;
          id?: string;
          planned_minutes: number;
          room_name: string;
          started_at?: string | null;
          status?: Database["api"]["Enums"]["live_coaching_status"];
          summary?: string | null;
          updated_at?: string;
        };
        Update: {
          actor_user_id?: string;
          completed_at?: string | null;
          consumed_minutes?: number;
          created_at?: string;
          dog_id?: string;
          household_id?: string;
          id?: string;
          planned_minutes?: number;
          room_name?: string;
          started_at?: string | null;
          status?: Database["api"]["Enums"]["live_coaching_status"];
          summary?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "live_coaching_sessions_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "live_coaching_sessions_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "live_coaching_sessions_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      localized_content: {
        Row: {
          body: Json;
          canonical_content_id: string;
          canonical_version: number;
          content_type: string;
          created_at: string;
          human_reviewer_user_id: string | null;
          id: string;
          locale: string;
          reviewed_at: string | null;
          source_locale: string;
          title: string | null;
          translation_method: Database["api"]["Enums"]["translation_method"];
          translation_status: Database["api"]["Enums"]["translation_status"];
          valid_from: string | null;
          valid_until: string | null;
          validity_state: Database["api"]["Enums"]["validity_state"];
        };
        Insert: {
          body: Json;
          canonical_content_id: string;
          canonical_version: number;
          content_type: string;
          created_at?: string;
          human_reviewer_user_id?: string | null;
          id?: string;
          locale: string;
          reviewed_at?: string | null;
          source_locale: string;
          title?: string | null;
          translation_method: Database["api"]["Enums"]["translation_method"];
          translation_status: Database["api"]["Enums"]["translation_status"];
          valid_from?: string | null;
          valid_until?: string | null;
          validity_state?: Database["api"]["Enums"]["validity_state"];
        };
        Update: {
          body?: Json;
          canonical_content_id?: string;
          canonical_version?: number;
          content_type?: string;
          created_at?: string;
          human_reviewer_user_id?: string | null;
          id?: string;
          locale?: string;
          reviewed_at?: string | null;
          source_locale?: string;
          title?: string | null;
          translation_method?: Database["api"]["Enums"]["translation_method"];
          translation_status?: Database["api"]["Enums"]["translation_status"];
          valid_from?: string | null;
          valid_until?: string | null;
          validity_state?: Database["api"]["Enums"]["validity_state"];
        };
        Relationships: [
          {
            foreignKeyName: "localized_content_human_reviewer_user_id_fkey";
            columns: ["human_reviewer_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      media_assets: {
        Row: {
          consent_id: string;
          created_at: string;
          dog_id: string;
          duration_ms: number | null;
          goal_id: string | null;
          household_id: string;
          id: string;
          mime_type: string;
          object_key: string;
          processing_status: string;
          protocol_version_id: string | null;
          retention_until: string;
          session_id: string | null;
          size_bytes: number;
          storage_bucket: string;
        };
        Insert: {
          consent_id: string;
          created_at?: string;
          dog_id: string;
          duration_ms?: number | null;
          goal_id?: string | null;
          household_id: string;
          id?: string;
          mime_type: string;
          object_key: string;
          processing_status?: string;
          protocol_version_id?: string | null;
          retention_until: string;
          session_id?: string | null;
          size_bytes: number;
          storage_bucket?: string;
        };
        Update: {
          consent_id?: string;
          created_at?: string;
          dog_id?: string;
          duration_ms?: number | null;
          goal_id?: string | null;
          household_id?: string;
          id?: string;
          mime_type?: string;
          object_key?: string;
          processing_status?: string;
          protocol_version_id?: string | null;
          retention_until?: string;
          session_id?: string | null;
          size_bytes?: number;
          storage_bucket?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_assets_consent_id_fkey";
            columns: ["consent_id"];
            isOneToOne: false;
            referencedRelation: "consents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_assets_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_assets_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_assets_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_assets_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      message_catalog_entries: {
        Row: {
          channel: string;
          created_at: string;
          id: string;
          localized_content_id: string;
          message_key: string;
          message_version: number;
        };
        Insert: {
          channel?: string;
          created_at?: string;
          id?: string;
          localized_content_id: string;
          message_key: string;
          message_version: number;
        };
        Update: {
          channel?: string;
          created_at?: string;
          id?: string;
          localized_content_id?: string;
          message_key?: string;
          message_version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "message_catalog_entries_localized_content_id_fkey";
            columns: ["localized_content_id"];
            isOneToOne: false;
            referencedRelation: "localized_content";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          created_at: string;
          household_id: string;
          quiet_hours_end: string | null;
          quiet_hours_start: string | null;
          timezone: string;
          updated_at: string;
          web_push_enabled: boolean;
        };
        Insert: {
          created_at?: string;
          household_id: string;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          timezone?: string;
          updated_at?: string;
          web_push_enabled?: boolean;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          timezone?: string;
          updated_at?: string;
          web_push_enabled?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: true;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      observations: {
        Row: {
          confidence: number | null;
          created_at: string;
          dog_id: string;
          id: string;
          observation_code: string;
          observed_from: string;
          observed_until: string | null;
          observed_value: Json;
          session_id: string | null;
          source: string;
          supporting_evidence_ids: string[];
          unsupported_inference_codes: unknown[];
        };
        Insert: {
          confidence?: number | null;
          created_at?: string;
          dog_id: string;
          id?: string;
          observation_code: string;
          observed_from: string;
          observed_until?: string | null;
          observed_value: Json;
          session_id?: string | null;
          source: string;
          supporting_evidence_ids?: string[];
          unsupported_inference_codes?: unknown[];
        };
        Update: {
          confidence?: number | null;
          created_at?: string;
          dog_id?: string;
          id?: string;
          observation_code?: string;
          observed_from?: string;
          observed_until?: string | null;
          observed_value?: Json;
          session_id?: string | null;
          source?: string;
          supporting_evidence_ids?: string[];
          unsupported_inference_codes?: unknown[];
        };
        Relationships: [
          {
            foreignKeyName: "observations_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "observations_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      owner_checkins: {
        Row: {
          concern_codes: unknown[];
          confidence_rating: number | null;
          created_at: string;
          difficulty_rating: number | null;
          id: string;
          notes: string | null;
          notes_locale: string | null;
          perceived_outcome_code: string | null;
          session_id: string;
          user_id: string;
        };
        Insert: {
          concern_codes?: unknown[];
          confidence_rating?: number | null;
          created_at?: string;
          difficulty_rating?: number | null;
          id?: string;
          notes?: string | null;
          notes_locale?: string | null;
          perceived_outcome_code?: string | null;
          session_id: string;
          user_id: string;
        };
        Update: {
          concern_codes?: unknown[];
          confidence_rating?: number | null;
          created_at?: string;
          difficulty_rating?: number | null;
          id?: string;
          notes?: string | null;
          notes_locale?: string | null;
          perceived_outcome_code?: string | null;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "owner_checkins_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "owner_checkins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      owner_profiles: {
        Row: {
          accessibility_needs: Json;
          available_minutes_per_day: number | null;
          communication_preferences: Json;
          confidence_level: number | null;
          created_at: string;
          experience_level: string | null;
          household_id: string;
          id: string;
          reinforcement_preferences: unknown[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          accessibility_needs?: Json;
          available_minutes_per_day?: number | null;
          communication_preferences?: Json;
          confidence_level?: number | null;
          created_at?: string;
          experience_level?: string | null;
          household_id: string;
          id?: string;
          reinforcement_preferences?: unknown[];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          accessibility_needs?: Json;
          available_minutes_per_day?: number | null;
          communication_preferences?: Json;
          confidence_level?: number | null;
          created_at?: string;
          experience_level?: string | null;
          household_id?: string;
          id?: string;
          reinforcement_preferences?: unknown[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "owner_profiles_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "owner_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_adjustments: {
        Row: {
          created_at: string;
          decision_code: string;
          engine_version: string;
          escalation_code: string | null;
          evidence_ids: string[];
          id: string;
          new_plan_version_id: string | null;
          plan_id: string;
          previous_plan_version_id: string;
          reason_codes: unknown[];
          required_question_codes: unknown[];
        };
        Insert: {
          created_at?: string;
          decision_code: string;
          engine_version: string;
          escalation_code?: string | null;
          evidence_ids?: string[];
          id?: string;
          new_plan_version_id?: string | null;
          plan_id: string;
          previous_plan_version_id: string;
          reason_codes: unknown[];
          required_question_codes?: unknown[];
        };
        Update: {
          created_at?: string;
          decision_code?: string;
          engine_version?: string;
          escalation_code?: string | null;
          evidence_ids?: string[];
          id?: string;
          new_plan_version_id?: string | null;
          plan_id?: string;
          previous_plan_version_id?: string;
          reason_codes?: unknown[];
          required_question_codes?: unknown[];
        };
        Relationships: [
          {
            foreignKeyName: "plan_adjustments_new_plan_version_id_fkey";
            columns: ["new_plan_version_id"];
            isOneToOne: false;
            referencedRelation: "plan_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_adjustments_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "current_plan_summary";
            referencedColumns: ["plan_id"];
          },
          {
            foreignKeyName: "plan_adjustments_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_adjustments_previous_plan_version_id_fkey";
            columns: ["previous_plan_version_id"];
            isOneToOne: false;
            referencedRelation: "plan_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_steps: {
        Row: {
          created_at: string;
          difficulty_parameters: Json;
          duration_seconds: number | null;
          id: string;
          plan_version_id: string;
          prerequisite_step_ids: string[];
          protocol_step_code: string;
          repetitions: number | null;
          sequence_number: number;
          stop_condition_codes: unknown[];
        };
        Insert: {
          created_at?: string;
          difficulty_parameters?: Json;
          duration_seconds?: number | null;
          id?: string;
          plan_version_id: string;
          prerequisite_step_ids?: string[];
          protocol_step_code: string;
          repetitions?: number | null;
          sequence_number: number;
          stop_condition_codes?: unknown[];
        };
        Update: {
          created_at?: string;
          difficulty_parameters?: Json;
          duration_seconds?: number | null;
          id?: string;
          plan_version_id?: string;
          prerequisite_step_ids?: string[];
          protocol_step_code?: string;
          repetitions?: number | null;
          sequence_number?: number;
          stop_condition_codes?: unknown[];
        };
        Relationships: [
          {
            foreignKeyName: "plan_steps_plan_version_id_fkey";
            columns: ["plan_version_id"];
            isOneToOne: false;
            referencedRelation: "plan_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_versions: {
        Row: {
          created_at: string;
          effective_from: string | null;
          effective_until: string | null;
          generation_mode: string;
          generation_reason_codes: unknown[];
          id: string;
          plan_id: string;
          protocol_version_id: string;
          rule_set_id: string;
          status: string;
          superseded_by_plan_version_id: string | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          effective_from?: string | null;
          effective_until?: string | null;
          generation_mode: string;
          generation_reason_codes: unknown[];
          id?: string;
          plan_id: string;
          protocol_version_id: string;
          rule_set_id: string;
          status?: string;
          superseded_by_plan_version_id?: string | null;
          version: number;
        };
        Update: {
          created_at?: string;
          effective_from?: string | null;
          effective_until?: string | null;
          generation_mode?: string;
          generation_reason_codes?: unknown[];
          id?: string;
          plan_id?: string;
          protocol_version_id?: string;
          rule_set_id?: string;
          status?: string;
          superseded_by_plan_version_id?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "plan_versions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "current_plan_summary";
            referencedColumns: ["plan_id"];
          },
          {
            foreignKeyName: "plan_versions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_versions_superseded_by_plan_version_id_fkey";
            columns: ["superseded_by_plan_version_id"];
            isOneToOne: false;
            referencedRelation: "plan_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          active_plan_version_id: string | null;
          created_at: string;
          dog_id: string;
          goal_version_id: string;
          id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          active_plan_version_id?: string | null;
          created_at?: string;
          dog_id: string;
          goal_version_id: string;
          id?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          active_plan_version_id?: string | null;
          created_at?: string;
          dog_id?: string;
          goal_version_id?: string;
          id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plans_active_plan_version_fk";
            columns: ["active_plan_version_id"];
            isOneToOne: false;
            referencedRelation: "plan_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plans_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plans_goal_version_id_fkey";
            columns: ["goal_version_id"];
            isOneToOne: false;
            referencedRelation: "goal_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      privacy_deletion_requests: {
        Row: {
          actor_user_id: string;
          completed_at: string | null;
          household_id: string;
          id: string;
          reason: string | null;
          requested_at: string;
          retention_summary: Json;
          status: Database["api"]["Enums"]["privacy_request_status"];
        };
        Insert: {
          actor_user_id: string;
          completed_at?: string | null;
          household_id: string;
          id?: string;
          reason?: string | null;
          requested_at?: string;
          retention_summary?: Json;
          status?: Database["api"]["Enums"]["privacy_request_status"];
        };
        Update: {
          actor_user_id?: string;
          completed_at?: string | null;
          household_id?: string;
          id?: string;
          reason?: string | null;
          requested_at?: string;
          retention_summary?: Json;
          status?: Database["api"]["Enums"]["privacy_request_status"];
        };
        Relationships: [
          {
            foreignKeyName: "privacy_deletion_requests_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "privacy_deletion_requests_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      professional_referrals: {
        Row: {
          attribution_expires_at: string | null;
          created_at: string;
          dog_id: string;
          goal_id: string | null;
          household_id: string;
          id: string;
          reason_code: string;
          signed_token_hash: string | null;
          status: string;
          trainer_id: string | null;
          updated_at: string;
        };
        Insert: {
          attribution_expires_at?: string | null;
          created_at?: string;
          dog_id: string;
          goal_id?: string | null;
          household_id: string;
          id?: string;
          reason_code: string;
          signed_token_hash?: string | null;
          status?: string;
          trainer_id?: string | null;
          updated_at?: string;
        };
        Update: {
          attribution_expires_at?: string | null;
          created_at?: string;
          dog_id?: string;
          goal_id?: string | null;
          household_id?: string;
          id?: string;
          reason_code?: string;
          signed_token_hash?: string | null;
          status?: string;
          trainer_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "professional_referrals_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "professional_referrals_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "professional_referrals_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "professional_referrals_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      progress_dimensions: {
        Row: {
          created_at: string;
          dimension_code: string;
          id: string;
          progress_evaluation_id: string;
          result: Json;
        };
        Insert: {
          created_at?: string;
          dimension_code: string;
          id?: string;
          progress_evaluation_id: string;
          result: Json;
        };
        Update: {
          created_at?: string;
          dimension_code?: string;
          id?: string;
          progress_evaluation_id?: string;
          result?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "progress_dimensions_progress_evaluation_id_fkey";
            columns: ["progress_evaluation_id"];
            isOneToOne: false;
            referencedRelation: "progress_evaluations";
            referencedColumns: ["id"];
          },
        ];
      };
      progress_evaluations: {
        Row: {
          candidate_next_action: string | null;
          confidence: string | null;
          created_at: string;
          engine_version: string;
          evaluated_at: string;
          evidence_ids: string[];
          id: string;
          missing_metric_codes: unknown[];
          plan_version_id: string;
          reason_codes: unknown[];
          rule_set_id: string;
          status_code: string;
        };
        Insert: {
          candidate_next_action?: string | null;
          confidence?: string | null;
          created_at?: string;
          engine_version: string;
          evaluated_at: string;
          evidence_ids?: string[];
          id?: string;
          missing_metric_codes?: unknown[];
          plan_version_id: string;
          reason_codes?: unknown[];
          rule_set_id: string;
          status_code: string;
        };
        Update: {
          candidate_next_action?: string | null;
          confidence?: string | null;
          created_at?: string;
          engine_version?: string;
          evaluated_at?: string;
          evidence_ids?: string[];
          id?: string;
          missing_metric_codes?: unknown[];
          plan_version_id?: string;
          reason_codes?: unknown[];
          rule_set_id?: string;
          status_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "progress_evaluations_plan_version_id_fkey";
            columns: ["plan_version_id"];
            isOneToOne: false;
            referencedRelation: "plan_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      protocol_localizations: {
        Row: {
          created_at: string;
          id: string;
          localized_content_id: string;
          protocol_version_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          localized_content_id: string;
          protocol_version_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          localized_content_id?: string;
          protocol_version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "protocol_localizations_localized_content_id_fkey";
            columns: ["localized_content_id"];
            isOneToOne: false;
            referencedRelation: "localized_content";
            referencedColumns: ["id"];
          },
        ];
      };
      question_definitions: {
        Row: {
          answer_schema: Json;
          created_at: string;
          id: string;
          question_code: string;
          sensitivity: string;
          validity_state: Database["api"]["Enums"]["validity_state"];
          version: number;
        };
        Insert: {
          answer_schema: Json;
          created_at?: string;
          id?: string;
          question_code: string;
          sensitivity?: string;
          validity_state?: Database["api"]["Enums"]["validity_state"];
          version: number;
        };
        Update: {
          answer_schema?: Json;
          created_at?: string;
          id?: string;
          question_code?: string;
          sensitivity?: string;
          validity_state?: Database["api"]["Enums"]["validity_state"];
          version?: number;
        };
        Relationships: [];
      };
      question_localizations: {
        Row: {
          created_at: string;
          id: string;
          localized_content_id: string;
          question_definition_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          localized_content_id: string;
          question_definition_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          localized_content_id?: string;
          question_definition_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_localizations_localized_content_id_fkey";
            columns: ["localized_content_id"];
            isOneToOne: false;
            referencedRelation: "localized_content";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_localizations_question_definition_id_fkey";
            columns: ["question_definition_id"];
            isOneToOne: false;
            referencedRelation: "question_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
      risk_assessments: {
        Row: {
          assessed_at: string;
          created_at: string;
          disposition_code: string;
          dog_id: string;
          explanation_evidence_ids: string[];
          goal_id: string | null;
          id: string;
          permitted_action_codes: unknown[];
          prohibited_action_codes: unknown[];
          reason_codes: unknown[];
          required_question_codes: unknown[];
          resolution: Json | null;
          reviewer_user_id: string | null;
          risk_level_code: string;
          rule_set_id: string;
          triggered_rule_codes: unknown[];
        };
        Insert: {
          assessed_at: string;
          created_at?: string;
          disposition_code: string;
          dog_id: string;
          explanation_evidence_ids?: string[];
          goal_id?: string | null;
          id?: string;
          permitted_action_codes?: unknown[];
          prohibited_action_codes?: unknown[];
          reason_codes?: unknown[];
          required_question_codes?: unknown[];
          resolution?: Json | null;
          reviewer_user_id?: string | null;
          risk_level_code: string;
          rule_set_id: string;
          triggered_rule_codes: unknown[];
        };
        Update: {
          assessed_at?: string;
          created_at?: string;
          disposition_code?: string;
          dog_id?: string;
          explanation_evidence_ids?: string[];
          goal_id?: string | null;
          id?: string;
          permitted_action_codes?: unknown[];
          prohibited_action_codes?: unknown[];
          reason_codes?: unknown[];
          required_question_codes?: unknown[];
          resolution?: Json | null;
          reviewer_user_id?: string | null;
          risk_level_code?: string;
          rule_set_id?: string;
          triggered_rule_codes?: unknown[];
        };
        Relationships: [
          {
            foreignKeyName: "risk_assessments_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "risk_assessments_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "risk_assessments_reviewer_user_id_fkey";
            columns: ["reviewer_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      safety_events: {
        Row: {
          behavior_concern_id: string | null;
          created_at: string;
          dog_id: string;
          event_code: string;
          id: string;
          occurred_at: string | null;
          recency_code: string | null;
          review_status: string;
          severity: number | null;
          source: string;
          updated_at: string;
        };
        Insert: {
          behavior_concern_id?: string | null;
          created_at?: string;
          dog_id: string;
          event_code: string;
          id?: string;
          occurred_at?: string | null;
          recency_code?: string | null;
          review_status?: string;
          severity?: number | null;
          source?: string;
          updated_at?: string;
        };
        Update: {
          behavior_concern_id?: string | null;
          created_at?: string;
          dog_id?: string;
          event_code?: string;
          id?: string;
          occurred_at?: string | null;
          recency_code?: string | null;
          review_status?: string;
          severity?: number | null;
          source?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "safety_events_behavior_concern_id_fkey";
            columns: ["behavior_concern_id"];
            isOneToOne: false;
            referencedRelation: "behavior_concerns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "safety_events_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
        ];
      };
      scheduled_sessions: {
        Row: {
          created_at: string;
          duration_seconds: number;
          id: string;
          is_recovery: boolean;
          is_review: boolean;
          is_video_requested: boolean;
          plan_step_id: string;
          planned_end: string | null;
          planned_start: string;
          purpose_code: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          duration_seconds: number;
          id?: string;
          is_recovery?: boolean;
          is_review?: boolean;
          is_video_requested?: boolean;
          plan_step_id: string;
          planned_end?: string | null;
          planned_start: string;
          purpose_code: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          duration_seconds?: number;
          id?: string;
          is_recovery?: boolean;
          is_review?: boolean;
          is_video_requested?: boolean;
          plan_step_id?: string;
          planned_end?: string | null;
          planned_start?: string;
          purpose_code?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_sessions_plan_step_id_fkey";
            columns: ["plan_step_id"];
            isOneToOne: false;
            referencedRelation: "plan_steps";
            referencedColumns: ["id"];
          },
        ];
      };
      session_context: {
        Row: {
          created_at: string;
          distraction_level: number | null;
          environment: Json;
          exercise_context: Json | null;
          feeding_context: Json | null;
          handler_state: string | null;
          id: string;
          location_code: string | null;
          session_id: string;
          sleep_context: Json | null;
          trigger_code: string | null;
          trigger_distance_meters: number | null;
        };
        Insert: {
          created_at?: string;
          distraction_level?: number | null;
          environment?: Json;
          exercise_context?: Json | null;
          feeding_context?: Json | null;
          handler_state?: string | null;
          id?: string;
          location_code?: string | null;
          session_id: string;
          sleep_context?: Json | null;
          trigger_code?: string | null;
          trigger_distance_meters?: number | null;
        };
        Update: {
          created_at?: string;
          distraction_level?: number | null;
          environment?: Json;
          exercise_context?: Json | null;
          feeding_context?: Json | null;
          handler_state?: string | null;
          id?: string;
          location_code?: string | null;
          session_id?: string;
          sleep_context?: Json | null;
          trigger_code?: string | null;
          trigger_distance_meters?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "session_context_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: true;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      session_measurements: {
        Row: {
          created_at: string;
          id: string;
          is_unknown: boolean;
          measured_at: string;
          method_code: string | null;
          metric_code: string;
          quality: string;
          session_id: string;
          source: string;
          unit_code: string | null;
          unknown_reason: string | null;
          value_boolean: boolean | null;
          value_json: Json | null;
          value_numeric: number | null;
          value_text: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_unknown?: boolean;
          measured_at: string;
          method_code?: string | null;
          metric_code: string;
          quality: string;
          session_id: string;
          source: string;
          unit_code?: string | null;
          unknown_reason?: string | null;
          value_boolean?: boolean | null;
          value_json?: Json | null;
          value_numeric?: number | null;
          value_text?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_unknown?: boolean;
          measured_at?: string;
          method_code?: string | null;
          metric_code?: string;
          quality?: string;
          session_id?: string;
          source?: string;
          unit_code?: string | null;
          unknown_reason?: string | null;
          value_boolean?: boolean | null;
          value_json?: Json | null;
          value_numeric?: number | null;
          value_text?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "session_measurements_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      sessions: {
        Row: {
          completion_status: string;
          created_at: string;
          dog_id: string;
          ended_at: string | null;
          handler_user_id: string;
          id: string;
          interruption_reason_code: string | null;
          scheduled_session_id: string | null;
          started_at: string | null;
          updated_at: string;
        };
        Insert: {
          completion_status?: string;
          created_at?: string;
          dog_id: string;
          ended_at?: string | null;
          handler_user_id: string;
          id?: string;
          interruption_reason_code?: string | null;
          scheduled_session_id?: string | null;
          started_at?: string | null;
          updated_at?: string;
        };
        Update: {
          completion_status?: string;
          created_at?: string;
          dog_id?: string;
          ended_at?: string | null;
          handler_user_id?: string;
          id?: string;
          interruption_reason_code?: string | null;
          scheduled_session_id?: string | null;
          started_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sessions_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_handler_user_id_fkey";
            columns: ["handler_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_scheduled_session_id_fkey";
            columns: ["scheduled_session_id"];
            isOneToOne: false;
            referencedRelation: "scheduled_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          canonical_status: string;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          household_id: string;
          id: string;
          provider: string;
          provider_customer_id: string | null;
          provider_subscription_id: string | null;
          tier_code: string;
          updated_at: string;
        };
        Insert: {
          canonical_status: string;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          household_id: string;
          id?: string;
          provider: string;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          tier_code: string;
          updated_at?: string;
        };
        Update: {
          canonical_status?: string;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          household_id?: string;
          id?: string;
          provider?: string;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          tier_code?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      trainer_credentials: {
        Row: {
          created_at: string;
          credential_body: string;
          credential_identifier: string | null;
          id: string;
          trainer_id: string;
          valid_from: string | null;
          valid_until: string | null;
          verification_status: string;
          verified_by_user_id: string | null;
        };
        Insert: {
          created_at?: string;
          credential_body: string;
          credential_identifier?: string | null;
          id?: string;
          trainer_id: string;
          valid_from?: string | null;
          valid_until?: string | null;
          verification_status?: string;
          verified_by_user_id?: string | null;
        };
        Update: {
          created_at?: string;
          credential_body?: string;
          credential_identifier?: string | null;
          id?: string;
          trainer_id?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          verification_status?: string;
          verified_by_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trainer_credentials_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trainer_credentials_verified_by_user_id_fkey";
            columns: ["verified_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      trainer_specialties: {
        Row: {
          approval_status: string;
          created_at: string;
          id: string;
          risk_capability_code: string | null;
          specialty_code: string;
          trainer_id: string;
        };
        Insert: {
          approval_status?: string;
          created_at?: string;
          id?: string;
          risk_capability_code?: string | null;
          specialty_code: string;
          trainer_id: string;
        };
        Update: {
          approval_status?: string;
          created_at?: string;
          id?: string;
          risk_capability_code?: string | null;
          specialty_code?: string;
          trainer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trainer_specialties_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      trainers: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          remote_available: boolean;
          service_countries: unknown[];
          status: string;
          supported_locales: unknown[];
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id?: string;
          remote_available?: boolean;
          service_countries?: unknown[];
          status?: string;
          supported_locales?: unknown[];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          remote_available?: boolean;
          service_countries?: unknown[];
          status?: string;
          supported_locales?: unknown[];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trainers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      training_protocols: {
        Row: {
          created_at: string;
          goal_family: string;
          id: string;
          protocol_code: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          goal_family: string;
          id?: string;
          protocol_code: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          goal_family?: string;
          id?: string;
          protocol_code?: string;
          status?: string;
        };
        Relationships: [];
      };
      user_contacts: {
        Row: {
          contact_hash: string;
          created_at: string;
          encrypted_contact: string | null;
          id: string;
          linked_at: string | null;
          provider: string;
          updated_at: string;
          user_id: string | null;
          verification_status: string;
          verified_at: string | null;
        };
        Insert: {
          contact_hash: string;
          created_at?: string;
          encrypted_contact?: string | null;
          id?: string;
          linked_at?: string | null;
          provider: string;
          updated_at?: string;
          user_id?: string | null;
          verification_status?: string;
          verified_at?: string | null;
        };
        Update: {
          contact_hash?: string;
          created_at?: string;
          encrypted_contact?: string | null;
          id?: string;
          linked_at?: string | null;
          provider?: string;
          updated_at?: string;
          user_id?: string | null;
          verification_status?: string;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_contacts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          auth_user_id: string;
          country: string;
          created_at: string;
          currency: string;
          display_name: string | null;
          fallback_locale: string;
          id: string;
          legal_jurisdiction: string;
          locale_status: Database["api"]["Enums"]["locale_status"];
          preferred_locale: string;
          status: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          auth_user_id: string;
          country?: string;
          created_at?: string;
          currency?: string;
          display_name?: string | null;
          fallback_locale?: string;
          id?: string;
          legal_jurisdiction?: string;
          locale_status?: Database["api"]["Enums"]["locale_status"];
          preferred_locale?: string;
          status?: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          auth_user_id?: string;
          country?: string;
          created_at?: string;
          currency?: string;
          display_name?: string | null;
          fallback_locale?: string;
          id?: string;
          legal_jurisdiction?: string;
          locale_status?: Database["api"]["Enums"]["locale_status"];
          preferred_locale?: string;
          status?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      video_analyses: {
        Row: {
          actor_user_id: string;
          completed_at: string | null;
          content_type: string;
          created_at: string;
          dog_id: string;
          failure_code: string | null;
          findings: Json;
          household_id: string;
          id: string;
          original_filename: string;
          size_bytes: number;
          status: Database["api"]["Enums"]["video_analysis_status"];
          storage_object_key: string;
          updated_at: string;
          uploaded_at: string | null;
        };
        Insert: {
          actor_user_id: string;
          completed_at?: string | null;
          content_type: string;
          created_at?: string;
          dog_id: string;
          failure_code?: string | null;
          findings?: Json;
          household_id: string;
          id?: string;
          original_filename: string;
          size_bytes: number;
          status?: Database["api"]["Enums"]["video_analysis_status"];
          storage_object_key: string;
          updated_at?: string;
          uploaded_at?: string | null;
        };
        Update: {
          actor_user_id?: string;
          completed_at?: string | null;
          content_type?: string;
          created_at?: string;
          dog_id?: string;
          failure_code?: string | null;
          findings?: Json;
          household_id?: string;
          id?: string;
          original_filename?: string;
          size_bytes?: number;
          status?: Database["api"]["Enums"]["video_analysis_status"];
          storage_object_key?: string;
          updated_at?: string;
          uploaded_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "video_analyses_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "video_analyses_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "video_analyses_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      current_plan_summary: {
        Row: {
          active_plan_version_id: string | null;
          dog_id: string | null;
          effective_from: string | null;
          effective_until: string | null;
          goal_version_id: string | null;
          household_id: string | null;
          plan_id: string | null;
          plan_version_status: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dogs_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plans_active_plan_version_fk";
            columns: ["active_plan_version_id"];
            isOneToOne: false;
            referencedRelation: "plan_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plans_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plans_goal_version_id_fkey";
            columns: ["goal_version_id"];
            isOneToOne: false;
            referencedRelation: "goal_versions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      resolve_localized_content: {
        Args: {
          fallback_locale?: unknown;
          requested_content_id: unknown;
          requested_locale: unknown;
          requested_version: number;
        };
        Returns: {
          body: Json;
          canonical_content_id: string;
          canonical_version: number;
          content_type: string;
          created_at: string;
          human_reviewer_user_id: string | null;
          id: string;
          locale: string;
          reviewed_at: string | null;
          source_locale: string;
          title: string | null;
          translation_method: Database["api"]["Enums"]["translation_method"];
          translation_status: Database["api"]["Enums"]["translation_status"];
          valid_from: string | null;
          valid_until: string | null;
          validity_state: Database["api"]["Enums"]["validity_state"];
        }[];
        SetofOptions: {
          from: "*";
          to: "localized_content";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
    };
    Enums: {
      evidence_level:
        | "verified_fact"
        | "professional_consensus"
        | "pending_professional_review"
        | "product_assumption"
        | "owner_report"
        | "measured_observation"
        | "hypothesis";
      live_coaching_status: "created" | "active" | "completed" | "failed";
      locale_status: "unconfirmed" | "detected" | "confirmed";
      membership_role: "owner" | "caregiver" | "viewer";
      membership_status: "invited" | "active" | "revoked";
      privacy_request_status:
        "requested" | "processing" | "completed" | "rejected_legal_hold";
      translation_method:
        | "source_authored"
        | "machine_translation"
        | "human_translation"
        | "runtime_constrained_translation";
      translation_status:
        | "draft_machine_translation"
        | "human_review_pending"
        | "professionally_reviewed"
        | "legal_reviewed"
        | "approved_for_release"
        | "superseded";
      validity_state: "draft" | "valid" | "expired" | "revoked" | "superseded";
      video_analysis_status:
        "upload_requested" | "uploaded" | "processing" | "completed" | "failed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  api: {
    Enums: {
      evidence_level: [
        "verified_fact",
        "professional_consensus",
        "pending_professional_review",
        "product_assumption",
        "owner_report",
        "measured_observation",
        "hypothesis",
      ],
      live_coaching_status: ["created", "active", "completed", "failed"],
      locale_status: ["unconfirmed", "detected", "confirmed"],
      membership_role: ["owner", "caregiver", "viewer"],
      membership_status: ["invited", "active", "revoked"],
      privacy_request_status: [
        "requested",
        "processing",
        "completed",
        "rejected_legal_hold",
      ],
      translation_method: [
        "source_authored",
        "machine_translation",
        "human_translation",
        "runtime_constrained_translation",
      ],
      translation_status: [
        "draft_machine_translation",
        "human_review_pending",
        "professionally_reviewed",
        "legal_reviewed",
        "approved_for_release",
        "superseded",
      ],
      validity_state: ["draft", "valid", "expired", "revoked", "superseded"],
      video_analysis_status: [
        "upload_requested",
        "uploaded",
        "processing",
        "completed",
        "failed",
      ],
    },
  },
} as const;
