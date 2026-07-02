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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          deleted_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          metadata: Json
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      advertiser_profiles: {
        Row: {
          about: string | null
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          brand_name: string | null
          created_at: string
          deleted_at: string | null
          industry: string | null
          logo_url: string | null
          rejection_reason: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          about?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          brand_name?: string | null
          created_at?: string
          deleted_at?: string | null
          industry?: string | null
          logo_url?: string | null
          rejection_reason?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          about?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          brand_name?: string | null
          created_at?: string
          deleted_at?: string | null
          industry?: string | null
          logo_url?: string | null
          rejection_reason?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advertiser_profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advertiser_profiles_profile_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          campaign_id: string
          created_at: string
          creator_id: string
          deleted_at: string | null
          id: string
          pitch: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          creator_id: string
          deleted_at?: string | null
          id?: string
          pitch?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          creator_id?: string
          deleted_at?: string | null
          id?: string
          pitch?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_creator_profile_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          advertiser_id: string
          attachments: Json | null
          brief: string | null
          budget_max: number | null
          budget_min: number | null
          category: string | null
          cover_url: string | null
          created_at: string
          creator_tier: string | null
          deadline: string | null
          deleted_at: string | null
          deliverables: string | null
          id: string
          languages: string[] | null
          location: string | null
          platform: string | null
          requirements: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          title: string
          updated_at: string
        }
        Insert: {
          advertiser_id: string
          attachments?: Json | null
          brief?: string | null
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          cover_url?: string | null
          created_at?: string
          creator_tier?: string | null
          deadline?: string | null
          deleted_at?: string | null
          deliverables?: string | null
          id?: string
          languages?: string[] | null
          location?: string | null
          platform?: string | null
          requirements?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          title: string
          updated_at?: string
        }
        Update: {
          advertiser_id?: string
          attachments?: Json | null
          brief?: string | null
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          cover_url?: string | null
          created_at?: string
          creator_tier?: string | null
          deadline?: string | null
          deleted_at?: string | null
          deliverables?: string | null
          id?: string
          languages?: string[] | null
          location?: string | null
          platform?: string | null
          requirements?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_advertiser_profile_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          advertiser_id: string
          amount: number
          application_id: string | null
          campaign_id: string
          created_at: string
          creator_id: string
          currency: string
          deleted_at: string | null
          end_date: string | null
          id: string
          metadata: Json
          signed_by_advertiser_at: string | null
          signed_by_creator_at: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          terms: string | null
          title: string
          updated_at: string
        }
        Insert: {
          advertiser_id: string
          amount: number
          application_id?: string | null
          campaign_id: string
          created_at?: string
          creator_id: string
          currency?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json
          signed_by_advertiser_at?: string | null
          signed_by_creator_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          advertiser_id?: string
          amount?: number
          application_id?: string | null
          campaign_id?: string
          created_at?: string
          creator_id?: string
          currency?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json
          signed_by_advertiser_at?: string | null
          signed_by_creator_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          advertiser_id: string
          campaign_id: string | null
          created_at: string
          creator_id: string
          deleted_at: string | null
          id: string
          last_message_at: string
        }
        Insert: {
          advertiser_id: string
          campaign_id?: string | null
          created_at?: string
          creator_id: string
          deleted_at?: string | null
          id?: string
          last_message_at?: string
        }
        Update: {
          advertiser_id?: string
          campaign_id?: string | null
          created_at?: string
          creator_id?: string
          deleted_at?: string | null
          id?: string
          last_message_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_advertiser_profile_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_creator_profile_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_profiles: {
        Row: {
          analytics: Json
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          audience_demographics: Json
          availability_status: string
          available: boolean
          categories: string[]
          created_at: string
          deleted_at: string | null
          follower_count: number | null
          headline: string | null
          languages: string[]
          past_collaborations: Json
          portfolio_media: Json
          pricing: Json
          profile_slug: string | null
          rate_max: number | null
          rate_min: number | null
          rejection_reason: string | null
          socials: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          analytics?: Json
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          audience_demographics?: Json
          availability_status?: string
          available?: boolean
          categories?: string[]
          created_at?: string
          deleted_at?: string | null
          follower_count?: number | null
          headline?: string | null
          languages?: string[]
          past_collaborations?: Json
          portfolio_media?: Json
          pricing?: Json
          profile_slug?: string | null
          rate_max?: number | null
          rate_min?: number | null
          rejection_reason?: string | null
          socials?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          analytics?: Json
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          audience_demographics?: Json
          availability_status?: string
          available?: boolean
          categories?: string[]
          created_at?: string
          deleted_at?: string | null
          follower_count?: number | null
          headline?: string | null
          languages?: string[]
          past_collaborations?: Json
          portfolio_media?: Json
          pricing?: Json
          profile_slug?: string | null
          rate_max?: number | null
          rate_min?: number | null
          rejection_reason?: string | null
          socials?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_profiles_profile_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_files: {
        Row: {
          bucket: string
          created_at: string
          deleted_at: string | null
          duration_ms: number | null
          height: number | null
          id: string
          is_public: boolean
          kind: Database["public"]["Enums"]["media_kind"]
          metadata: Json
          mime_type: string | null
          owner_id: string
          path: string
          size_bytes: number | null
          updated_at: string
          width: number | null
        }
        Insert: {
          bucket: string
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          height?: number | null
          id?: string
          is_public?: boolean
          kind?: Database["public"]["Enums"]["media_kind"]
          metadata?: Json
          mime_type?: string | null
          owner_id: string
          path: string
          size_bytes?: number | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          bucket?: string
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          height?: number | null
          id?: string
          is_public?: boolean
          kind?: Database["public"]["Enums"]["media_kind"]
          metadata?: Json
          mime_type?: string | null
          owner_id?: string
          path?: string
          size_bytes?: number | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_files_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edit_count: number
          edited_at: string | null
          id: string
          message_type: string
          pinned: boolean
          pinned_at: string | null
          read_at: string | null
          sender_id: string
        }
        Insert: {
          attachments?: Json
          body: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edit_count?: number
          edited_at?: string | null
          id?: string
          message_type?: string
          pinned?: boolean
          pinned_at?: string | null
          read_at?: string | null
          sender_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edit_count?: number
          edited_at?: string | null
          id?: string
          message_type?: string
          pinned?: boolean
          pinned_at?: string | null
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          deleted_at: string | null
          id: string
          payload: Json
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          currency: string
          deleted_at: string | null
          id: string
          metadata: Json
          payee_id: string
          payer_id: string
          processed_at: string | null
          provider: string | null
          provider_ref: string | null
          status: Database["public"]["Enums"]["payment_status"]
          type: Database["public"]["Enums"]["payment_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json
          payee_id: string
          payer_id: string
          processed_at?: string | null
          provider?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          type?: Database["public"]["Enums"]["payment_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json
          payee_id?: string
          payer_id?: string
          processed_at?: string | null
          provider?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          type?: Database["public"]["Enums"]["payment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio: {
        Row: {
          cover_media_id: string | null
          created_at: string
          creator_id: string
          deleted_at: string | null
          description: string | null
          external_url: string | null
          id: string
          is_public: boolean
          position: number
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          cover_media_id?: string | null
          created_at?: string
          creator_id: string
          deleted_at?: string | null
          description?: string | null
          external_url?: string | null
          id?: string
          is_public?: boolean
          position?: number
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          cover_media_id?: string | null
          created_at?: string
          creator_id?: string
          deleted_at?: string | null
          description?: string | null
          external_url?: string | null
          id?: string
          is_public?: boolean
          position?: number
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_role: Database["public"]["Enums"]["app_role"] | null
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          id: string
          location: string | null
          onboarded: boolean
          phone: string | null
          suspended_at: string | null
          suspended_reason: string | null
          updated_at: string
        }
        Insert: {
          active_role?: Database["public"]["Enums"]["app_role"] | null
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id: string
          location?: string | null
          onboarded?: boolean
          phone?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Update: {
          active_role?: Database["public"]["Enums"]["app_role"] | null
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          location?: string | null
          onboarded?: boolean
          phone?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolver_id: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolver_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolver_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolver_id_fkey"
            columns: ["resolver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          campaign_id: string | null
          contract_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_public: boolean
          rating: number
          reviewee_id: string
          reviewer_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          campaign_id?: string | null
          contract_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_public?: boolean
          rating: number
          reviewee_id: string
          reviewer_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          campaign_id?: string | null
          contract_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_public?: boolean
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_campaigns: {
        Row: {
          campaign_id: string
          created_at: string
          deleted_at: string | null
          id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_campaigns_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_campaigns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_creators: {
        Row: {
          created_at: string
          creator_id: string
          deleted_at: string | null
          id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_creators_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_creators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          created_at: string
          deleted_at: string | null
          engagement_rate: number | null
          follower_count: number | null
          handle: string
          id: string
          metadata: Json
          platform: Database["public"]["Enums"]["social_platform"]
          updated_at: string
          url: string | null
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          engagement_rate?: number | null
          follower_count?: number | null
          handle: string
          id?: string
          metadata?: Json
          platform: Database["public"]["Enums"]["social_platform"]
          updated_at?: string
          url?: string | null
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          engagement_rate?: number | null
          follower_count?: number | null
          handle?: string
          id?: string
          metadata?: Json
          platform?: Database["public"]["Enums"]["social_platform"]
          updated_at?: string
          url?: string | null
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assignee_id: string | null
          body: string
          category: string | null
          created_at: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignee_id?: string | null
          body: string
          category?: string | null
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignee_id?: string | null
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_requests: {
        Row: {
          created_at: string
          deleted_at: string | null
          evidence: Json
          id: string
          kind: Database["public"]["Enums"]["verification_kind"]
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["verification_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          evidence?: Json
          id?: string
          kind: Database["public"]["Enums"]["verification_kind"]
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          evidence?: Json
          id?: string
          kind?: Database["public"]["Enums"]["verification_kind"]
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_approval: {
        Args: {
          _kind: string
          _reason?: string
          _status: Database["public"]["Enums"]["approval_status"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_set_suspension: {
        Args: { _reason?: string; _suspend: boolean; _user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "advertiser" | "creator" | "admin"
      application_status: "pending" | "accepted" | "rejected" | "withdrawn"
      approval_status: "pending" | "approved" | "rejected"
      campaign_status: "draft" | "open" | "closed" | "archived" | "paused"
      contract_status:
        | "draft"
        | "sent"
        | "signed"
        | "active"
        | "completed"
        | "cancelled"
        | "disputed"
      media_kind: "image" | "video" | "audio" | "document"
      notification_type:
        | "application_received"
        | "application_status"
        | "new_message"
        | "campaign_update"
        | "system"
        | "mention"
        | "pin_update"
      payment_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "refunded"
        | "cancelled"
      payment_type: "deposit" | "milestone" | "final" | "bonus" | "refund"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      social_platform:
        | "instagram"
        | "tiktok"
        | "youtube"
        | "twitter"
        | "twitch"
        | "linkedin"
        | "facebook"
        | "other"
      ticket_priority: "low" | "normal" | "high" | "urgent"
      ticket_status: "open" | "in_progress" | "waiting" | "resolved" | "closed"
      verification_kind: "identity" | "brand" | "social" | "payout"
      verification_status: "pending" | "approved" | "rejected"
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
      app_role: ["advertiser", "creator", "admin"],
      application_status: ["pending", "accepted", "rejected", "withdrawn"],
      approval_status: ["pending", "approved", "rejected"],
      campaign_status: ["draft", "open", "closed", "archived", "paused"],
      contract_status: [
        "draft",
        "sent",
        "signed",
        "active",
        "completed",
        "cancelled",
        "disputed",
      ],
      media_kind: ["image", "video", "audio", "document"],
      notification_type: [
        "application_received",
        "application_status",
        "new_message",
        "campaign_update",
        "system",
        "mention",
        "pin_update",
      ],
      payment_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "refunded",
        "cancelled",
      ],
      payment_type: ["deposit", "milestone", "final", "bonus", "refund"],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      social_platform: [
        "instagram",
        "tiktok",
        "youtube",
        "twitter",
        "twitch",
        "linkedin",
        "facebook",
        "other",
      ],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: ["open", "in_progress", "waiting", "resolved", "closed"],
      verification_kind: ["identity", "brand", "social", "payout"],
      verification_status: ["pending", "approved", "rejected"],
    },
  },
} as const
