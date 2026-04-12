export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      coherence_history: {
        Row: {
          id: number
          kappa: number
          r_bar: number
          recurrence_rate: number | null
          structure_score: number | null
          t_dom: number | null
          timestamp: number
        }
        Insert: {
          id?: never
          kappa: number
          r_bar: number
          recurrence_rate?: number | null
          structure_score?: number | null
          t_dom?: number | null
          timestamp: number
        }
        Update: {
          id?: never
          kappa?: number
          r_bar?: number
          recurrence_rate?: number | null
          structure_score?: number | null
          t_dom?: number | null
          timestamp?: number
        }
        Relationships: []
      }
      gp_states: {
        Row: {
          inputs: Json
          kernel_inverse: Json | null
          outputs: Json
          regime_id: number
          updated_at: string
        }
        Insert: {
          inputs?: Json
          kernel_inverse?: Json | null
          outputs?: Json
          regime_id: number
          updated_at?: string
        }
        Update: {
          inputs?: Json
          kernel_inverse?: Json | null
          outputs?: Json
          regime_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      portfolio: {
        Row: {
          bar_count: number
          cooldowns: Json
          equity: number
          equity_curve: Json
          id: string
          initial_equity: number
          returns: Json
          saved_at: string
          version: number
        }
        Insert: {
          bar_count?: number
          cooldowns?: Json
          equity?: number
          equity_curve?: Json
          id?: string
          initial_equity?: number
          returns?: Json
          saved_at?: string
          version?: number
        }
        Update: {
          bar_count?: number
          cooldowns?: Json
          equity?: number
          equity_curve?: Json
          id?: string
          initial_equity?: number
          returns?: Json
          saved_at?: string
          version?: number
        }
        Relationships: []
      }
      price_series: {
        Row: {
          denoised_return: number
          id: number
          log_return: number
          price: number
          timestamp: number
        }
        Insert: {
          denoised_return: number
          id?: never
          log_return: number
          price: number
          timestamp: number
        }
        Update: {
          denoised_return?: number
          id?: never
          log_return?: number
          price?: number
          timestamp?: number
        }
        Relationships: []
      }
      smooth_state: {
        Row: {
          alpha: Json
          clock_pos: number
          dim: number
          hmm_a: Json | null
          hmm_tdom_a: number
          id: string
          last_regime_id: number | null
          last_tdom: number
          phase_kappa_history: Json
          t_dom: number
          tau: number
          trail: Json
          vel: number
          vm_kappa: number
          vm_mu: number
        }
        Insert: {
          alpha?: Json
          clock_pos?: number
          dim?: number
          hmm_a?: Json | null
          hmm_tdom_a?: number
          id?: string
          last_regime_id?: number | null
          last_tdom?: number
          phase_kappa_history?: Json
          t_dom?: number
          tau?: number
          trail?: Json
          vel?: number
          vm_kappa?: number
          vm_mu?: number
        }
        Update: {
          alpha?: Json
          clock_pos?: number
          dim?: number
          hmm_a?: Json | null
          hmm_tdom_a?: number
          id?: string
          last_regime_id?: number | null
          last_tdom?: number
          phase_kappa_history?: Json
          t_dom?: number
          tau?: number
          trail?: Json
          vel?: number
          vm_kappa?: number
          vm_mu?: number
        }
        Relationships: []
      }
      trades: {
        Row: {
          bars: number
          direction: number
          entry_kappa: number | null
          entry_r_bar: number | null
          exit_price: number
          id: number
          param_vector: Json
          pnl: number
          reason: string
          regime_id: number
          return_pct: number
          reward: number
          timestamp: number
        }
        Insert: {
          bars: number
          direction: number
          entry_kappa?: number | null
          entry_r_bar?: number | null
          exit_price: number
          id?: never
          param_vector?: Json
          pnl: number
          reason: string
          regime_id: number
          return_pct: number
          reward: number
          timestamp: number
        }
        Update: {
          bars?: number
          direction?: number
          entry_kappa?: number | null
          entry_r_bar?: number | null
          exit_price?: number
          id?: never
          param_vector?: Json
          pnl?: number
          reason?: string
          regime_id?: number
          return_pct?: number
          reward?: number
          timestamp?: number
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
