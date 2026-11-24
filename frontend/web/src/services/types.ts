export type ThemePreference = 'system' | 'light' | 'dark'

export interface UserPreferences {
  currency: string
  timezone: string
  theme: ThemePreference
  email_notifications: boolean
  push_notifications: boolean
  weekly_summary: boolean
  onboarding_completed: boolean
}

export interface User {
  id: string
  full_name: string
  email: string
  is_active: boolean
  created_at: string
  updated_at: string
  preferences: UserPreferences
}

export interface AuthResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  refresh_token?: string | null
  user: User
}

export interface RegisterInput {
  full_name: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface ProfileUpdate {
  full_name?: string
  preferences?: Partial<UserPreferences>
}

export interface PreferencesUpdate {
  currency?: string
  timezone?: string
  theme?: ThemePreference
  email_notifications?: boolean
  push_notifications?: boolean
  weekly_summary?: boolean
  onboarding_completed?: boolean
}

/* ------------------------------------------------------------------ */
/* Phase 2: consent-based financial data                               */
/* ------------------------------------------------------------------ */

export type BillRecurrence =
  | 'none'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export interface ProviderInstitution {
  id: string
  name: string
  country: string
  is_mock: boolean
}

export interface BankProvider {
  slug: string
  display_name: string
  is_mock: boolean
  institutions: ProviderInstitution[]
}

export interface BankConsent {
  id: string
  status: string
  scopes: string
  granted_at: string
  expires_at: string
  revoked_at: string | null
}

export interface FinancialAccount {
  id: string
  connection_id: string | null
  name: string
  account_type: string
  currency: string
  balance: string
  available_balance: string
  is_active: boolean
  is_mock: boolean
  last_synced_at: string | null
  created_at: string
}

export interface BankConnection {
  id: string
  provider: string
  institution_id: string
  institution_name: string
  status: string
  is_mock: boolean
  last_synced_at: string | null
  last_error: string | null
  created_at: string
  accounts: FinancialAccount[]
  consents: BankConsent[]
}

export interface SyncJob {
  id: string
  connection_id: string
  status: string
  started_at: string
  finished_at: string | null
  accounts_synced: number
  transactions_created: number
  transactions_skipped: number
  error_message: string | null
}

export interface ConnectionCreateResponse {
  connection: BankConnection
  sync_job: SyncJob | null
}

export interface Category {
  id: string
  slug: string
  name: string
  kind: string
  is_system: boolean
}

export interface TransactionAccountRef {
  id: string
  name: string
  account_type: string
}

export interface Transaction {
  id: string
  account_id: string
  account: TransactionAccountRef
  category: Category | null
  amount: string
  currency: string
  description: string
  merchant: string | null
  occurred_on: string
  transaction_type: string
  source: string
  is_pending: boolean
  notes: string | null
  created_at: string
  alerts?: FinancialInsight[]
}

export interface TransactionPage {
  items: Transaction[]
  total: number
  limit: number
  offset: number
}

export interface TransactionFilters {
  account_id?: string
  category_id?: string
  transaction_type?: string
  from_date?: string
  to_date?: string
  search?: string
  source?: string
  limit?: number
  offset?: number
}

export interface TransactionCreate {
  account_id: string
  amount: string
  currency?: string
  description: string
  merchant?: string | null
  occurred_on: string
  category_id?: string | null
  notes?: string | null
  allow_duplicate?: boolean
}

export interface TransactionUpdate {
  category_id?: string | null
  merchant?: string | null
  notes?: string | null
}

export interface Payment {
  id: string
  bill_id: string | null
  subscription_id: string | null
  amount: string
  currency: string
  paid_on: string
  note: string | null
  created_at: string
}

export interface Bill {
  id: string
  name: string
  payee: string | null
  amount: string
  currency: string
  due_date: string
  recurrence: string
  status: string
  state: string
  autopay: boolean
  reminder_days_before: number
  notes: string | null
  category_id: string | null
  last_paid_at: string | null
  created_at: string
  updated_at: string
}

export interface BillPage {
  items: Bill[]
  total: number
  limit: number
  offset: number
}

export interface BillInput {
  name: string
  payee?: string | null
  amount: string
  currency?: string
  due_date: string
  recurrence?: BillRecurrence
  autopay?: boolean
  reminder_days_before?: number
  category_id?: string | null
  notes?: string | null
}

export interface Subscription {
  id: string
  name: string
  provider: string | null
  amount: string
  currency: string
  billing_cycle: string
  next_payment_date: string
  started_on: string | null
  status: string
  monthly_equivalent: string
  reminder_days_before: number
  notes: string | null
  category_id: string | null
  created_at: string
  updated_at: string
}

export interface SubscriptionPage {
  items: Subscription[]
  total: number
  limit: number
  offset: number
}

export interface SubscriptionInput {
  name: string
  provider?: string | null
  amount: string
  currency?: string
  billing_cycle?: BillingCycle
  next_payment_date: string
  started_on?: string | null
  reminder_days_before?: number
  category_id?: string | null
  notes?: string | null
}

export interface UpcomingPayment {
  kind: 'bill' | 'subscription'
  id: string
  name: string
  amount: string
  currency: string
  due_date: string
  status: string
  autopay: boolean
  is_recurring: boolean
}

export interface Summary {
  currency: string
  total_balance: string
  total_available: string
  accounts_count: number
  connected_accounts_count: number
  is_mock_data: boolean
  month_income: string
  month_expenses: string
  net_this_month: string
  upcoming_total: string
  upcoming_bills_count: number
  upcoming_subscriptions_count: number
  upcoming_payments: UpcomingPayment[]
  recent_transactions: Transaction[]
  last_synced_at: string | null
  currency_breakdown?: CurrencyTotals[]
}

export interface CurrencyTotals {
  currency: string
  total_balance: string
  total_available: string
  accounts_count: number
  month_income: string
  month_expenses: string
  upcoming_total: string
}

export interface RecurringSuggestion {
  merchant: string
  cadence: string
  average_amount: string
  currency: string
  occurrences: number
  last_seen_on: string
  next_expected_on: string
  confidence: number
  matched_subscription_id: string | null
  matched_bill_id: string | null
  sample_transaction_ids: string[]
}

/* ------------------------------------------------------------------ */
/* Phase 3: financial intelligence                                     */
/* ------------------------------------------------------------------ */

export type BudgetPeriod = 'monthly'

export interface Budget {
  id: string
  category_id: string | null
  name: string
  period_start: string
  period_end: string
  amount: string
  currency: string
  alert_threshold: number
  is_active: boolean
  created_at: string
  updated_at: string
  period: string
}

export interface BudgetCreate {
  category_id?: string | null
  name: string
  period_start: string
  period_end: string
  amount: string
  currency?: string
  alert_threshold?: number
  is_active?: boolean
}

export interface BudgetUpdate {
  name?: string
  period_start?: string
  period_end?: string
  amount?: string
  currency?: string
  alert_threshold?: number
  is_active?: boolean
  category_id?: string | null
}

export interface BudgetPage {
  items: Budget[]
  total: number
  limit: number
  offset: number
}

export interface BudgetSpending {
  budget_id: string
  name: string
  period: string
  amount: string
  currency: string
  spent: string
  remaining: string
  alert_threshold: number
  overspending: boolean
  percent_used: number
  category_id: string | null
}

export interface SavingsGoal {
  id: string
  name: string
  target_amount: string
  current_amount: string
  currency: string
  target_date: string | null
  is_active: boolean
  remaining: string
  percent_funded: number
  created_at: string
  updated_at: string
}

export interface SavingsGoalCreate {
  name: string
  target_amount: string
  currency?: string
  target_date?: string | null
  is_active?: boolean
}

export interface SavingsGoalUpdate {
  name?: string
  target_amount?: string
  currency?: string
  target_date?: string | null
  current_amount?: string
  is_active?: boolean
}

export interface SavingsGoalPage {
  items: SavingsGoal[]
  total: number
  limit: number
  offset: number
}

export interface SavingsGoalsSummary {
  currency?: string
  total_target: string
  total_saved: string
  remaining: string
  goal_count: number
  currency_breakdown?: Record<
    string,
    {
      total_target: string
      total_saved: string
      remaining: string
      goal_count: number
    }
  >
}

export interface SpendingPreferences {
  id: string
  user_id: string
  proactive_awareness_enabled: boolean
  significant_spending_threshold: string
  reminder_advance_days: number
  enable_due_reminders: boolean
  enable_post_payment_reminders: boolean
  enable_entertainment_alerts: boolean
  entertainment_categories: string
  reminder_frequency: string
  currency: string
  created_at: string
  updated_at: string
}

export interface SpendingPreferencesUpdate {
  proactive_awareness_enabled?: boolean
  significant_spending_threshold?: string
  reminder_advance_days?: number
  enable_due_reminders?: boolean
  enable_post_payment_reminders?: boolean
  enable_entertainment_alerts?: boolean
  entertainment_categories?: string
  reminder_frequency?: string
  currency?: string
}

export interface Forecast {
  id: string
  forecast_date: string
  projected_balance: string
  expected_income: string
  expected_expenses: string
  currency: string
  generated_at: string
  assumptions: string | null
}

export interface ForecastCreate {
  forecast_date: string
  projected_balance: string
  expected_income?: string
  expected_expenses?: string
  currency?: string
  assumptions?: string | null
}

export interface ForecastPage {
  items: Forecast[]
  total: number
  limit: number
  offset: number
}

export type InsightType =
  | 'low_balance'
  | 'unusual_spending'
  | 'upcoming_obligation'
  | 'overspending_budget'
  | 'unreviewed_recurring'
  | 'spending_trend'

export type InsightSeverity = 'info' | 'warning' | 'critical'

export interface FinancialInsight {
  id: string
  insight_type: string
  severity: string
  title: string
  description: string
  amount: string | null
  currency: string | null
  related_date: string | null
  is_dismissed: boolean
  created_at: string
  updated_at: string
}

export interface FinancialInsightCreate {
  insight_type: InsightType
  severity: InsightSeverity
  title: string
  description: string
  amount?: string | null
  currency?: string | null
  related_date?: string | null
}

export interface FinancialInsightPage {
  items: FinancialInsight[]
  total: number
  limit: number
  offset: number
}

export interface CashFlowForecast {
  days: number
  start_date: string
  end_date: string
  available_balance: string
  expected_income: string
  expected_expenses: string
  projected_balance: string
  currency: string
  upcoming_obligations: Array<{
    kind: 'bill' | 'subscription'
    id: string
    name: string
    amount: string
    due_date: string
    currency: string
  }>
  daily_projection: Array<{
    date: string
    projected_balance: string
  }>
  assumptions: string
}

export interface ProactiveAwareness {
  significant_spending: boolean
  transaction_amount: string
  currency: string
  available_balance: string
  remaining_after_spending: string
  upcoming_dues: Array<{
    kind: string
    id: string
    name: string
    amount: string
    due_date: string
    currency: string
  }>
  upcoming_total: string
  insufficient_after_spending: boolean
  advice: string
}

export interface MonthlySummary {
  year: number
  month: number
  period_start: string
  period_end: string
  currency: string
  income: string
  expenses: string
  net: string
  category_income: Record<string, string>
  category_expenses: Record<string, string>
  currency_breakdown: Record<
    string,
    { income: string; expenses: string; count: number }
  >
  transaction_count: number
}

export interface SpendingTrend {
  lookback_days: number
  since: string
  weekly_spending: Record<string, string>
  trend: string
}

export interface FinancialRisk {
  insight_type: string
  severity: string
  title: string
  description: string
  amount: string | null
  currency: string | null
  related_date: string | null
}

export interface ReportCategory {
  category: string
  income: string
  expenses: string
  share_percent: number
}

export interface ReportMerchant {
  name: string
  amount: string
  count: number
}

export interface ReportPeriod {
  year: number
  month: number
  income: string
  expenses: string
  net: string
}

export interface FinancialReport {
  year: number
  month: number
  period_start: string
  period_end: string
  generated_at: string
  currency: string
  income: string
  expenses: string
  net: string
  savings_rate: number | null
  transaction_count: number
  category_breakdown: ReportCategory[]
  top_merchants: ReportMerchant[]
  previous_period: ReportPeriod
  change: {
    income_percent: number | null
    expenses_percent: number | null
    net_percent: number | null
  }
  budgets: BudgetSpending[]
  savings: SavingsGoalsSummary
  currency_breakdown: Record<
    string,
    { income: string; expenses: string; count: number }
  >
  notes: string[]
}
