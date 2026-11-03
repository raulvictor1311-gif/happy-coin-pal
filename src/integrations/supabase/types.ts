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
      assets: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      cards: {
        Row: {
          brand: string
          closing_day: number
          color: string
          created_at: string
          debit_mode: string
          due_day: number
          id: string
          limit: number
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string
          closing_day?: number
          color?: string
          created_at?: string
          debit_mode?: string
          due_day?: number
          id?: string
          limit?: number
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string
          closing_day?: number
          color?: string
          created_at?: string
          debit_mode?: string
          due_day?: number
          id?: string
          limit?: number
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_card_invoices: {
        Row: {
          card_id: string
          closing_date: string
          connection_id: string
          due_date: string
          external_id: string
          id: string
          paid: number
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          closing_date: string
          connection_id: string
          due_date: string
          external_id: string
          id?: string
          paid?: number
          status: string
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          closing_date?: string
          connection_id?: string
          due_date?: string
          external_id?: string
          id?: string
          paid?: number
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_invoices_card_id_user_id_fkey"
            columns: ["card_id", "user_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "credit_card_invoices_connection_id_user_id_fkey"
            columns: ["connection_id", "user_id"]
            isOneToOne: false
            referencedRelation: "financial_connections"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      credit_card_transactions: {
        Row: {
          amount: number
          card_id: string
          category: string
          connection_id: string
          date: string
          description: string
          external_id: string
          id: string
          installment_number: number
          installments: number
          invoice_id: string | null
          invoice_paid: boolean
          manually_categorized: boolean
          matched_transaction_id: string | null
          review_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          card_id: string
          category: string
          connection_id: string
          date: string
          description: string
          external_id: string
          id?: string
          installment_number?: number
          installments?: number
          invoice_id?: string | null
          invoice_paid?: boolean
          manually_categorized?: boolean
          matched_transaction_id?: string | null
          review_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          card_id?: string
          category?: string
          connection_id?: string
          date?: string
          description?: string
          external_id?: string
          id?: string
          installment_number?: number
          installments?: number
          invoice_id?: string | null
          invoice_paid?: boolean
          manually_categorized?: boolean
          matched_transaction_id?: string | null
          review_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_transactions_card_id_user_id_fkey"
            columns: ["card_id", "user_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "credit_card_transactions_connection_id_user_id_fkey"
            columns: ["connection_id", "user_id"]
            isOneToOne: false
            referencedRelation: "financial_connections"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "credit_card_transactions_invoice_id_user_id_fkey"
            columns: ["invoice_id", "user_id"]
            isOneToOne: false
            referencedRelation: "credit_card_invoices"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          available_limit: number
          brand: string
          closing_date: string | null
          connection_id: string
          due_date: string | null
          external_id: string
          id: string
          included: boolean
          name: string
          total_limit: number
          updated_at: string
          used_limit: number
          user_id: string
        }
        Insert: {
          available_limit: number
          brand: string
          closing_date?: string | null
          connection_id: string
          due_date?: string | null
          external_id: string
          id?: string
          included?: boolean
          name: string
          total_limit: number
          updated_at?: string
          used_limit: number
          user_id: string
        }
        Update: {
          available_limit?: number
          brand?: string
          closing_date?: string | null
          connection_id?: string
          due_date?: string | null
          external_id?: string
          id?: string
          included?: boolean
          name?: string
          total_limit?: number
          updated_at?: string
          used_limit?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_connection_id_user_id_fkey"
            columns: ["connection_id", "user_id"]
            isOneToOne: false
            referencedRelation: "financial_connections"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      debts: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      financial_accounts: {
        Row: {
          balance: number
          balance_at: string
          connection_id: string
          created_at: string
          currency: string
          external_id: string
          id: string
          included: boolean
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          balance_at?: string
          connection_id: string
          created_at?: string
          currency?: string
          external_id: string
          id?: string
          included?: boolean
          name: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          balance_at?: string
          connection_id?: string
          created_at?: string
          currency?: string
          external_id?: string
          id?: string
          included?: boolean
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_connection_id_user_id_fkey"
            columns: ["connection_id", "user_id"]
            isOneToOne: false
            referencedRelation: "financial_connections"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      financial_connections: {
        Row: {
          authorization_expires_at: string | null
          authorization_hash: string | null
          connected_at: string | null
          created_at: string
          environment: string
          expires_at: string | null
          external_connection_id: string | null
          id: string
          institution_id: string
          institution_logo: string | null
          institution_name: string
          last_sync_at: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          authorization_expires_at?: string | null
          authorization_hash?: string | null
          connected_at?: string | null
          created_at?: string
          environment: string
          expires_at?: string | null
          external_connection_id?: string | null
          id?: string
          institution_id: string
          institution_logo?: string | null
          institution_name: string
          last_sync_at?: string | null
          provider: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          authorization_expires_at?: string | null
          authorization_hash?: string | null
          connected_at?: string | null
          created_at?: string
          environment?: string
          expires_at?: string | null
          external_connection_id?: string | null
          id?: string
          institution_id?: string
          institution_logo?: string | null
          institution_name?: string
          last_sync_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          account_id: string
          amount: number
          category: string
          connection_id: string
          date: string
          description: string
          external_id: string
          id: string
          kind: string
          manually_categorized: boolean
          matched_transaction_id: string | null
          review_status: string
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category: string
          connection_id: string
          date: string
          description: string
          external_id: string
          id?: string
          kind: string
          manually_categorized?: boolean
          matched_transaction_id?: string | null
          review_status?: string
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string
          connection_id?: string
          date?: string
          description?: string
          external_id?: string
          id?: string
          kind?: string
          manually_categorized?: boolean
          matched_transaction_id?: string | null
          review_status?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_account_id_user_id_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "financial_transactions_connection_id_user_id_fkey"
            columns: ["connection_id", "user_id"]
            isOneToOne: false
            referencedRelation: "financial_connections"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          deadline: string | null
          emoji: string
          id: string
          saved: number
          target: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          emoji?: string
          id?: string
          saved?: number
          target?: number
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          emoji?: string
          id?: string
          saved?: number
          target?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      installment_purchases: {
        Row: {
          card_id: string | null
          card_id_ref: string | null
          category: string
          created_at: string
          date: string
          id: string
          installments: number
          name: string
          paid: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id?: string | null
          card_id_ref?: string | null
          category?: string
          created_at?: string
          date?: string
          id?: string
          installments?: number
          name?: string
          paid?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          card_id?: string | null
          card_id_ref?: string | null
          category?: string
          created_at?: string
          date?: string
          id?: string
          installments?: number
          name?: string
          paid?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      open_finance_consents: {
        Row: {
          authorized_at: string | null
          connection_id: string
          created_at: string
          expires_at: string
          id: string
          policy_version: string
          purpose: string
          recipient: string
          revoked_at: string | null
          scopes: string[]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          authorized_at?: string | null
          connection_id: string
          created_at?: string
          expires_at: string
          id?: string
          policy_version?: string
          purpose: string
          recipient?: string
          revoked_at?: string | null
          scopes: string[]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          authorized_at?: string | null
          connection_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          policy_version?: string
          purpose?: string
          recipient?: string
          revoked_at?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_finance_consents_connection_id_user_id_fkey"
            columns: ["connection_id", "user_id"]
            isOneToOne: false
            referencedRelation: "financial_connections"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          connection_id: string | null
          created_at: string
          event: string
          id: string
          result: string
          user_id: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          event: string
          id?: string
          result?: string
          user_id: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          event?: string
          id?: string
          result?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_connection_id_user_id_fkey"
            columns: ["connection_id", "user_id"]
            isOneToOne: false
            referencedRelation: "financial_connections"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          card_id: string | null
          category: string
          created_at: string
          date: string
          description: string
          financial_account_id: string | null
          financial_institution_id: string | null
          id: string
          installments: number | null
          invoice_paid: boolean
          kind: string
          payment_method: string | null
          reconciled_open_finance_id: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          card_id?: string | null
          category?: string
          created_at?: string
          date?: string
          description?: string
          financial_account_id?: string | null
          financial_institution_id?: string | null
          id?: string
          installments?: number | null
          invoice_paid?: boolean
          kind: string
          payment_method?: string | null
          reconciled_open_finance_id?: string | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          card_id?: string | null
          category?: string
          created_at?: string
          date?: string
          description?: string
          financial_account_id?: string | null
          financial_institution_id?: string | null
          id?: string
          installments?: number | null
          invoice_paid?: boolean
          kind?: string
          payment_method?: string | null
          reconciled_open_finance_id?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_links: {
        Row: {
          created_at: string
          id: string
          phone: string
          sandbox_connected_at: string | null
          updated_at: string
          user_id: string
          verification_code: string | null
          verification_code_expires_at: string | null
          verification_code_hash: string | null
          verification_code_salt: string | null
          verified: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          phone: string
          sandbox_connected_at?: string | null
          updated_at?: string
          user_id: string
          verification_code?: string | null
          verification_code_expires_at?: string | null
          verification_code_hash?: string | null
          verification_code_salt?: string | null
          verified?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          phone?: string
          sandbox_connected_at?: string | null
          updated_at?: string
          user_id?: string
          verification_code?: string | null
          verification_code_expires_at?: string | null
          verification_code_hash?: string | null
          verification_code_salt?: string | null
          verified?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      of_command: {
        Args: { p_action: string; p_data: Json; p_user: string }
        Returns: Json
      }
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
    Enums: {},
  },
} as const
