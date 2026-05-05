// Supabase 프로젝트 연결 후: npx supabase gen types typescript --local > lib/supabase/types.ts
// 현재는 수동 정의

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      campaigns_snapshot: {
        Row: {
          id: string
          campaign_id: string
          campaign_name: string | null
          adset_id: string | null
          adset_name: string | null
          spend: number
          impressions: number
          clicks: number
          conversions: number
          cpa: number | null
          ctr: number | null
          roas: number | null
          revenue: number
          captured_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          campaign_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          spend?: number
          impressions?: number
          clicks?: number
          conversions?: number
          cpa?: number | null
          ctr?: number | null
          roas?: number | null
          revenue?: number
          captured_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          campaign_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          spend?: number
          impressions?: number
          clicks?: number
          conversions?: number
          cpa?: number | null
          ctr?: number | null
          roas?: number | null
          revenue?: number
          captured_at?: string
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          id: string
          name: string
          description: string | null
          metric: string
          operator: string
          threshold: number
          action: string
          action_value: number | null
          severity: string
          scope: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          metric: string
          operator: string
          threshold: number
          action: string
          action_value?: number | null
          severity?: string
          scope?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          metric?: string
          operator?: string
          threshold?: number
          action?: string
          action_value?: number | null
          severity?: string
          scope?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      action_queue: {
        Row: {
          id: string
          rule_id: string | null
          campaign_id: string
          campaign_name: string | null
          proposed_change: Json
          severity: string
          status: string
          approved_by: string | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rule_id?: string | null
          campaign_id: string
          campaign_name?: string | null
          proposed_change: Json
          severity: string
          status?: string
          approved_by?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rule_id?: string | null
          campaign_id?: string
          campaign_name?: string | null
          proposed_change?: Json
          severity?: string
          status?: string
          approved_by?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'action_queue_rule_id_fkey'
            columns: ['rule_id']
            isOneToOne: false
            referencedRelation: 'automation_rules'
            referencedColumns: ['id']
          }
        ]
      }
      execution_log: {
        Row: {
          id: string
          action_queue_id: string | null
          meta_api_response: Json | null
          result: string
          error_message: string | null
          executed_at: string
        }
        Insert: {
          id?: string
          action_queue_id?: string | null
          meta_api_response?: Json | null
          result: string
          error_message?: string | null
          executed_at?: string
        }
        Update: {
          id?: string
          action_queue_id?: string | null
          meta_api_response?: Json | null
          result?: string
          error_message?: string | null
          executed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'execution_log_action_queue_id_fkey'
            columns: ['action_queue_id']
            isOneToOne: false
            referencedRelation: 'action_queue'
            referencedColumns: ['id']
          }
        ]
      }
      creatives: {
        Row: {
          id: string
          creative_id: string
          campaign_id: string | null
          adset_id: string | null
          name: string | null
          type: string | null
          thumbnail_url: string | null
          ctr: number | null
          cpm: number | null
          cvr: number | null
          spend: number | null
          fatigue_score: number
          is_active: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          creative_id: string
          campaign_id?: string | null
          adset_id?: string | null
          name?: string | null
          type?: string | null
          thumbnail_url?: string | null
          ctr?: number | null
          cpm?: number | null
          cvr?: number | null
          spend?: number | null
          fatigue_score?: number
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          creative_id?: string
          campaign_id?: string | null
          adset_id?: string | null
          name?: string | null
          type?: string | null
          thumbnail_url?: string | null
          ctr?: number | null
          cpm?: number | null
          cvr?: number | null
          spend?: number | null
          fatigue_score?: number
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
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
  }
}

// 편의 타입
export type CampaignsSnapshot = Database['public']['Tables']['campaigns_snapshot']['Row']
export type AutomationRule = Database['public']['Tables']['automation_rules']['Row']
export type ActionQueue = Database['public']['Tables']['action_queue']['Row']
export type ExecutionLog = Database['public']['Tables']['execution_log']['Row']
export type Creative = Database['public']['Tables']['creatives']['Row']

export type ProposedChange = {
  action: string
  metric: string
  current_value: number
  threshold: number
  reason: string
  proposed_budget?: number | null
}
