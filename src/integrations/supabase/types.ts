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
      admin_bootstrap_emails: {
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
      campaign_payment_summary: {
        Row: {
          campaign_id: string
          created_at: string
          currency: string
          deleted_at: string | null
          id: string
          last_payment_at: string | null
          total_held: number
          total_paid: number
          total_refunded: number
          total_released: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          last_payment_at?: string | null
          total_held?: number
          total_paid?: number
          total_refunded?: number
          total_released?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          last_payment_at?: string | null
          total_held?: number
          total_paid?: number
          total_refunded?: number
          total_released?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_payment_summary_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
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
          funded: boolean
          funded_amount: number | null
          funded_at: string | null
          funded_payment_id: string | null
          gst_pct: number
          id: string
          languages: string[] | null
          location: string | null
          platform: string | null
          platform_fee_pct: number
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
          funded?: boolean
          funded_amount?: number | null
          funded_at?: string | null
          funded_payment_id?: string | null
          gst_pct?: number
          id?: string
          languages?: string[] | null
          location?: string | null
          platform?: string | null
          platform_fee_pct?: number
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
          funded?: boolean
          funded_amount?: number | null
          funded_at?: string | null
          funded_payment_id?: string | null
          gst_pct?: number
          id?: string
          languages?: string[] | null
          location?: string | null
          platform?: string | null
          platform_fee_pct?: number
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
          {
            foreignKeyName: "campaigns_funded_payment_id_fkey"
            columns: ["funded_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
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
          deliverable_urls: Json
          end_date: string | null
          id: string
          metadata: Json
          payment_id: string | null
          reviewed_at: string | null
          revision_count: number
          revision_notes: string | null
          signed_by_advertiser_at: string | null
          signed_by_creator_at: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          submission_notes: string | null
          submitted_at: string | null
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
          deliverable_urls?: Json
          end_date?: string | null
          id?: string
          metadata?: Json
          payment_id?: string | null
          reviewed_at?: string | null
          revision_count?: number
          revision_notes?: string | null
          signed_by_advertiser_at?: string | null
          signed_by_creator_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          submission_notes?: string | null
          submitted_at?: string | null
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
          deliverable_urls?: Json
          end_date?: string | null
          id?: string
          metadata?: Json
          payment_id?: string | null
          reviewed_at?: string | null
          revision_count?: number
          revision_notes?: string | null
          signed_by_advertiser_at?: string | null
          signed_by_creator_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          submission_notes?: string | null
          submitted_at?: string | null
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
          {
            foreignKeyName: "contracts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
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
      payment_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          deleted_at: string | null
          from_status: Database["public"]["Enums"]["payment_status"] | null
          id: string
          message: string | null
          metadata: Json | null
          payment_id: string | null
          to_status: Database["public"]["Enums"]["payment_status"] | null
          updated_at: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          deleted_at?: string | null
          from_status?: Database["public"]["Enums"]["payment_status"] | null
          id?: string
          message?: string | null
          metadata?: Json | null
          payment_id?: string | null
          to_status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          deleted_at?: string | null
          from_status?: Database["public"]["Enums"]["payment_status"] | null
          id?: string
          message?: string | null
          metadata?: Json | null
          payment_id?: string | null
          to_status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhooks: {
        Row: {
          attempts: number
          created_at: string
          deleted_at: string | null
          error: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          provider: string
          signature: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          deleted_at?: string | null
          error?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          provider?: string
          signature?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          deleted_at?: string | null
          error?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          provider?: string
          signature?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          campaign_id: string | null
          contract_id: string | null
          created_at: string
          creator_earnings: number | null
          currency: string
          deleted_at: string | null
          failure_reason: string | null
          fee: number | null
          gross_amount: number | null
          gst: number | null
          id: string
          invoice_number: string | null
          metadata: Json
          notes: Json | null
          payee_id: string
          payer_id: string
          platform_fee: number | null
          processed_at: string | null
          provider: string | null
          provider_ref: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          receipt_number: string | null
          status: Database["public"]["Enums"]["payment_status"]
          status_v2: Database["public"]["Enums"]["payment_status"] | null
          tax: number | null
          type: Database["public"]["Enums"]["payment_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          campaign_id?: string | null
          contract_id?: string | null
          created_at?: string
          creator_earnings?: number | null
          currency?: string
          deleted_at?: string | null
          failure_reason?: string | null
          fee?: number | null
          gross_amount?: number | null
          gst?: number | null
          id?: string
          invoice_number?: string | null
          metadata?: Json
          notes?: Json | null
          payee_id: string
          payer_id: string
          platform_fee?: number | null
          processed_at?: string | null
          provider?: string | null
          provider_ref?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          receipt_number?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          status_v2?: Database["public"]["Enums"]["payment_status"] | null
          tax?: number | null
          type?: Database["public"]["Enums"]["payment_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          campaign_id?: string | null
          contract_id?: string | null
          created_at?: string
          creator_earnings?: number | null
          currency?: string
          deleted_at?: string | null
          failure_reason?: string | null
          fee?: number | null
          gross_amount?: number | null
          gst?: number | null
          id?: string
          invoice_number?: string | null
          metadata?: Json
          notes?: Json | null
          payee_id?: string
          payer_id?: string
          platform_fee?: number | null
          processed_at?: string | null
          provider?: string | null
          provider_ref?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          receipt_number?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          status_v2?: Database["public"]["Enums"]["payment_status"] | null
          tax?: number | null
          type?: Database["public"]["Enums"]["payment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
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
      payout_methods: {
        Row: {
          account_holder_name: string | null
          account_number: string | null
          account_number_hash: string | null
          account_number_last4: string | null
          account_type: Database["public"]["Enums"]["bank_account_type"] | null
          bank_name: string | null
          created_at: string
          id: string
          ifsc: string | null
          is_default: boolean
          label: string | null
          method_type: Database["public"]["Enums"]["payout_method_type"]
          rejection_reason: string | null
          updated_at: string
          upi_id: string | null
          user_id: string
          verification_status: Database["public"]["Enums"]["payout_verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_holder_name?: string | null
          account_number?: string | null
          account_number_hash?: string | null
          account_number_last4?: string | null
          account_type?: Database["public"]["Enums"]["bank_account_type"] | null
          bank_name?: string | null
          created_at?: string
          id?: string
          ifsc?: string | null
          is_default?: boolean
          label?: string | null
          method_type: Database["public"]["Enums"]["payout_method_type"]
          rejection_reason?: string | null
          updated_at?: string
          upi_id?: string | null
          user_id: string
          verification_status?: Database["public"]["Enums"]["payout_verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_holder_name?: string | null
          account_number?: string | null
          account_number_hash?: string | null
          account_number_last4?: string | null
          account_type?: Database["public"]["Enums"]["bank_account_type"] | null
          bank_name?: string | null
          created_at?: string
          id?: string
          ifsc?: string | null
          is_default?: boolean
          label?: string | null
          method_type?: Database["public"]["Enums"]["payout_method_type"]
          rejection_reason?: string | null
          updated_at?: string
          upi_id?: string | null
          user_id?: string
          verification_status?: Database["public"]["Enums"]["payout_verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
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
          avatar_updated_at: string | null
          avatar_url: string | null
          banner_position: Json
          banner_updated_at: string | null
          banner_url: string | null
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
          username: string | null
        }
        Insert: {
          active_role?: Database["public"]["Enums"]["app_role"] | null
          avatar_updated_at?: string | null
          avatar_url?: string | null
          banner_position?: Json
          banner_updated_at?: string | null
          banner_url?: string | null
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
          username?: string | null
        }
        Update: {
          active_role?: Database["public"]["Enums"]["app_role"] | null
          avatar_updated_at?: string | null
          avatar_url?: string | null
          banner_position?: Json
          banner_updated_at?: string | null
          banner_url?: string | null
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
          username?: string | null
        }
        Relationships: []
      }
      refunds: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          failure_reason: string | null
          id: string
          metadata: Json | null
          payment_id: string
          processed_at: string | null
          razorpay_refund_id: string | null
          reason: string | null
          rejection_reason: string | null
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["refund_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          payment_id: string
          processed_at?: string | null
          razorpay_refund_id?: string | null
          reason?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string
          processed_at?: string | null
          razorpay_refund_id?: string | null
          reason?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
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
      transactions: {
        Row: {
          account: string | null
          amount: number
          campaign_id: string | null
          contract_id: string | null
          counterparty_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string | null
          direction: string
          entry_type: string | null
          event_type: string | null
          group_id: string | null
          id: string
          idempotency_key: string | null
          metadata: Json | null
          payment_id: string | null
          posted_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          account?: string | null
          amount: number
          campaign_id?: string | null
          contract_id?: string | null
          counterparty_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          direction: string
          entry_type?: string | null
          event_type?: string | null
          group_id?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          payment_id?: string | null
          posted_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          account?: string | null
          amount?: number
          campaign_id?: string | null
          contract_id?: string | null
          counterparty_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          direction?: string
          entry_type?: string | null
          event_type?: string | null
          group_id?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          payment_id?: string | null
          posted_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
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
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["wallet_txn_type"]
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          type: Database["public"]["Enums"]["wallet_txn_type"]
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          type?: Database["public"]["Enums"]["wallet_txn_type"]
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          available_balance: number
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          held_balance: number
          id: string
          lifetime_earned: number
          pending_balance: number
          updated_at: string
          updated_by: string | null
          user_id: string
          withdrawn_balance: number
        }
        Insert: {
          available_balance?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          held_balance?: number
          id?: string
          lifetime_earned?: number
          pending_balance?: number
          updated_at?: string
          updated_by?: string | null
          user_id: string
          withdrawn_balance?: number
        }
        Update: {
          available_balance?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          held_balance?: number
          id?: string
          lifetime_earned?: number
          pending_balance?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          withdrawn_balance?: number
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_notes: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          destination: Json
          failure_reason: string | null
          fee: number
          id: string
          method: string
          payout_id: string | null
          payout_ref: string | null
          processed_at: string | null
          razorpay_payout_id: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
          updated_by: string | null
          user_id: string
          wallet_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          destination?: Json
          failure_reason?: string | null
          fee?: number
          id?: string
          method?: string
          payout_id?: string | null
          payout_ref?: string | null
          processed_at?: string | null
          razorpay_payout_id?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
          wallet_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          destination?: Json
          failure_reason?: string | null
          fee?: number
          id?: string
          method?: string
          payout_id?: string | null
          payout_ref?: string | null
          processed_at?: string | null
          razorpay_payout_id?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      audit_logs: {
        Row: {
          action: string | null
          admin_id: string | null
          id: string | null
          ip_address: unknown
          metadata: Json | null
          target_id: string | null
          target_type: string | null
          timestamp: string | null
          user_agent: string | null
        }
        Insert: {
          action?: string | null
          admin_id?: string | null
          id?: string | null
          ip_address?: unknown
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          timestamp?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string | null
          admin_id?: string | null
          id?: string | null
          ip_address?: unknown
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          timestamp?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      apply_wallet_txn: {
        Args: {
          _amount: number
          _description?: string
          _metadata?: Json
          _reference_id?: string
          _reference_type?: string
          _type: Database["public"]["Enums"]["wallet_txn_type"]
          _user_id: string
        }
        Returns: string
      }
      ensure_wallet: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_invoice_number: { Args: never; Returns: string }
      next_receipt_number: { Args: never; Returns: string }
      notify_user: {
        Args: {
          _body?: string
          _payload?: Json
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_id: string
        }
        Returns: undefined
      }
      post_ledger_entry: {
        Args: {
          _amount: number
          _campaign_id?: string
          _contract_id?: string
          _created_by?: string
          _credit_account: string
          _credit_user?: string
          _currency: string
          _debit_account: string
          _debit_user?: string
          _description?: string
          _event_type: string
          _idempotency_key?: string
          _metadata?: Json
          _payment_id?: string
        }
        Returns: string
      }
      search_creators: {
        Args: {
          _category?: string
          _limit?: number
          _location?: string
          _offset?: number
          _q?: string
          _skill?: string
        }
        Returns: {
          avatar_url: string
          bio: string
          categories: string[]
          display_name: string
          follower_count: number
          headline: string
          languages: string[]
          location: string
          rate_max: number
          rate_min: number
          total_count: number
          updated_at: string
          user_id: string
          username: string
        }[]
      }
      upsert_campaign_payment_summary: {
        Args: { _campaign_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "advertiser" | "creator" | "admin" | "moderator"
      application_status: "pending" | "accepted" | "rejected" | "withdrawn"
      approval_status: "pending" | "approved" | "rejected"
      bank_account_type: "savings" | "current"
      campaign_status: "draft" | "open" | "closed" | "archived" | "paused"
      contract_status:
        | "draft"
        | "sent"
        | "signed"
        | "active"
        | "completed"
        | "cancelled"
        | "disputed"
        | "submitted"
        | "revision_requested"
        | "approved"
      media_kind: "image" | "video" | "audio" | "document"
      notification_type:
        | "application_received"
        | "application_status"
        | "new_message"
        | "campaign_update"
        | "system"
        | "mention"
        | "pin_update"
        | "payment_success"
        | "campaign_funded"
        | "creator_accepted"
        | "deliverables_uploaded"
        | "revision_requested"
        | "payment_released"
        | "withdrawal_approved"
        | "withdrawal_completed"
        | "refund_completed"
      payment_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "refunded"
        | "cancelled"
        | "held"
        | "released"
        | "revision_requested"
        | "withdrawal_requested"
        | "withdrawn"
        | "refund_pending"
        | "paid"
      payment_type:
        | "deposit"
        | "milestone"
        | "final"
        | "bonus"
        | "refund"
        | "campaign_payment"
      payout_method_type: "bank" | "upi"
      payout_verification_status: "pending" | "verified" | "rejected"
      refund_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "requested"
        | "approved"
        | "rejected"
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
      wallet_txn_type:
        | "credit"
        | "debit"
        | "hold"
        | "release"
        | "withdrawal"
        | "refund"
        | "fee"
        | "adjustment"
      withdrawal_status:
        | "requested"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
        | "approved"
        | "rejected"
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
      app_role: ["advertiser", "creator", "admin", "moderator"],
      application_status: ["pending", "accepted", "rejected", "withdrawn"],
      approval_status: ["pending", "approved", "rejected"],
      bank_account_type: ["savings", "current"],
      campaign_status: ["draft", "open", "closed", "archived", "paused"],
      contract_status: [
        "draft",
        "sent",
        "signed",
        "active",
        "completed",
        "cancelled",
        "disputed",
        "submitted",
        "revision_requested",
        "approved",
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
        "payment_success",
        "campaign_funded",
        "creator_accepted",
        "deliverables_uploaded",
        "revision_requested",
        "payment_released",
        "withdrawal_approved",
        "withdrawal_completed",
        "refund_completed",
      ],
      payment_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "refunded",
        "cancelled",
        "held",
        "released",
        "revision_requested",
        "withdrawal_requested",
        "withdrawn",
        "refund_pending",
        "paid",
      ],
      payment_type: [
        "deposit",
        "milestone",
        "final",
        "bonus",
        "refund",
        "campaign_payment",
      ],
      payout_method_type: ["bank", "upi"],
      payout_verification_status: ["pending", "verified", "rejected"],
      refund_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "requested",
        "approved",
        "rejected",
      ],
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
      wallet_txn_type: [
        "credit",
        "debit",
        "hold",
        "release",
        "withdrawal",
        "refund",
        "fee",
        "adjustment",
      ],
      withdrawal_status: [
        "requested",
        "processing",
        "completed",
        "failed",
        "cancelled",
        "approved",
        "rejected",
      ],
    },
  },
} as const
