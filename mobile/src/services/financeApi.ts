import { api } from './apiClient'
import type {
  BankConnection,
  BankProvider,
  Bill,
  BillInput,
  BillPage,
  Budget,
  BudgetCreate,
  BudgetPage,
  BudgetUpdate,
  Category,
  CashFlowForecast,
  ConnectionCreateResponse,
  FinancialAccount,
  FinancialInsight,
  FinancialInsightPage,
  FinancialReport,
  FinancialRisk,
  MonthlySummary,
  Payment,
  ProactiveAwareness,
  RecurringSuggestion,
  SavingsGoal,
  SavingsGoalCreate,
  SavingsGoalPage,
  SavingsGoalUpdate,
  SavingsGoalsSummary,
  SpendingPreferences,
  SpendingPreferencesUpdate,
  SpendingTrend,
  Subscription,
  SubscriptionInput,
  SubscriptionPage,
  Summary,
  SyncJob,
  Transaction,
  TransactionCreate,
  TransactionFilters,
  TransactionPage,
  TransactionUpdate,
  UpcomingPayment,
} from './types'

function cleanParams(
  params: Record<string, string | number | undefined>,
): Record<string, string | number> {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== '',
  )
  return Object.fromEntries(entries) as Record<string, string | number>
}

export const financeApi = {
  /* ---------------------------------------------------------- banking */
  async getProviders(): Promise<BankProvider[]> {
    const { data } = await api.get<BankProvider[]>('/banking/providers')
    return data
  },

  async getConnections(): Promise<BankConnection[]> {
    const { data } = await api.get<BankConnection[]>('/banking/connections')
    return data
  },

  async createConnection(input: {
    institution_id: string
    provider?: string
  }): Promise<ConnectionCreateResponse> {
    const { data } = await api.post<ConnectionCreateResponse>(
      '/banking/connections',
      input,
    )
    return data
  },

  async syncConnection(connectionId: string): Promise<SyncJob> {
    const { data } = await api.post<SyncJob>(
      `/banking/connections/${connectionId}/sync`,
    )
    return data
  },

  async revokeConnection(connectionId: string): Promise<void> {
    await api.delete(`/banking/connections/${connectionId}`)
  },

  /* --------------------------------------------------------- accounts */
  async getAccounts(activeOnly = true): Promise<FinancialAccount[]> {
    const { data } = await api.get<FinancialAccount[]>('/accounts', {
      params: { active_only: activeOnly },
    })
    return data
  },

  /* ----------------------------------------------------- transactions */
  async getCategories(): Promise<Category[]> {
    const { data } = await api.get<Category[]>('/transactions/categories')
    return data
  },

  async getTransactions(
    filters: TransactionFilters = {},
  ): Promise<TransactionPage> {
    const { data } = await api.get<TransactionPage>('/transactions', {
      params: cleanParams({
        account_id: filters.account_id,
        category_id: filters.category_id,
        transaction_type: filters.transaction_type,
        from_date: filters.from_date,
        to_date: filters.to_date,
        search: filters.search,
        source: filters.source,
        limit: filters.limit,
        offset: filters.offset,
      }),
    })
    return data
  },

  async createTransaction(input: TransactionCreate): Promise<Transaction> {
    const { data } = await api.post<Transaction>('/transactions', input)
    return data
  },

  async updateTransaction(
    transactionId: string,
    input: TransactionUpdate,
  ): Promise<Transaction> {
    const { data } = await api.patch<Transaction>(
      `/transactions/${transactionId}`,
      input,
    )
    return data
  },

  async deleteTransaction(transactionId: string): Promise<void> {
    await api.delete(`/transactions/${transactionId}`)
  },

  /* ------------------------------------------------------------ bills */
  async getBills(
    params: { state?: string; days?: number; search?: string } = {},
  ): Promise<BillPage> {
    const { data } = await api.get<BillPage>('/bills', {
      params: cleanParams({
        state: params.state,
        days: params.days,
        search: params.search,
        limit: 100,
      }),
    })
    return data
  },

  async createBill(input: BillInput): Promise<Bill> {
    const { data } = await api.post<Bill>('/bills', input)
    return data
  },

  async updateBill(billId: string, input: Partial<BillInput>): Promise<Bill> {
    const { data } = await api.patch<Bill>(`/bills/${billId}`, input)
    return data
  },

  async deleteBill(billId: string): Promise<void> {
    await api.delete(`/bills/${billId}`)
  },

  async payBill(
    billId: string,
    input: { paid_on?: string; amount?: string; note?: string } = {},
  ): Promise<Bill> {
    const { data } = await api.post<Bill>(`/bills/${billId}/pay`, input)
    return data
  },

  async getBillPayments(billId: string): Promise<Payment[]> {
    const { data } = await api.get<Payment[]>(`/bills/${billId}/payments`)
    return data
  },

  /* ---------------------------------------------------- subscriptions */
  async getSubscriptions(
    params: { status?: string; search?: string } = {},
  ): Promise<SubscriptionPage> {
    const { data } = await api.get<SubscriptionPage>('/subscriptions', {
      params: cleanParams({
        status: params.status,
        search: params.search,
        limit: 100,
      }),
    })
    return data
  },

  async createSubscription(
    input: SubscriptionInput,
  ): Promise<Subscription> {
    const { data } = await api.post<Subscription>('/subscriptions', input)
    return data
  },

  async updateSubscription(
    subscriptionId: string,
    input: Partial<SubscriptionInput> & {
      status?: 'active' | 'paused' | 'cancelled'
    },
  ): Promise<Subscription> {
    const { data } = await api.patch<Subscription>(
      `/subscriptions/${subscriptionId}`,
      input,
    )
    return data
  },

  async deleteSubscription(subscriptionId: string): Promise<void> {
    await api.delete(`/subscriptions/${subscriptionId}`)
  },

  async paySubscription(
    subscriptionId: string,
    input: { paid_on?: string; amount?: string; note?: string } = {},
  ): Promise<Subscription> {
    const { data } = await api.post<Subscription>(
      `/subscriptions/${subscriptionId}/pay`,
      input,
    )
    return data
  },

  async getSubscriptionPayments(
    subscriptionId: string,
  ): Promise<Payment[]> {
    const { data } = await api.get<Payment[]>(
      `/subscriptions/${subscriptionId}/payments`,
    )
    return data
  },

  /* --------------------------------------------------------- overview */
  async getSummary(days = 30): Promise<Summary> {
    const { data } = await api.get<Summary>('/summary', { params: { days } })
    return data
  },

  async getUpcoming(days = 30): Promise<UpcomingPayment[]> {
    const { data } = await api.get<UpcomingPayment[]>('/upcoming', {
      params: { days },
    })
    return data
  },

  async getRecurringSuggestions(): Promise<RecurringSuggestion[]> {
    const { data } = await api.get<RecurringSuggestion[]>(
      '/recurring-payments',
    )
    return data
  },

  /* ---------------------------------------------------------- budgets */
  async getBudgets(params?: {
    is_active?: boolean
    category_id?: string
    include_spending?: boolean
    limit?: number
    offset?: number
  }): Promise<BudgetPage> {
    const { data } = await api.get<BudgetPage>('/budgets', {
      params: {
        is_active: params?.is_active === true ? 'true' : undefined,
        category_id: params?.category_id,
        include_spending: params?.include_spending === true ? 'true' : undefined,
        limit: params?.limit,
        offset: params?.offset,
      },
    })
    return data
  },

  async createBudget(input: BudgetCreate): Promise<Budget> {
    const { data } = await api.post<Budget>('/budgets', input)
    return data
  },

  async getBudget(budgetId: string): Promise<Budget> {
    const { data } = await api.get<Budget>(`/budgets/${budgetId}`)
    return data
  },

  async updateBudget(budgetId: string, input: BudgetUpdate): Promise<Budget> {
    const { data } = await api.patch<Budget>(`/budgets/${budgetId}`, input)
    return data
  },

  async deleteBudget(budgetId: string): Promise<void> {
    await api.delete(`/budgets/${budgetId}`)
  },

  /* ----------------------------------------------------- savings goals */
  async getSavingsGoals(params?: {
    is_active?: boolean
    limit?: number
    offset?: number
  }): Promise<SavingsGoalPage> {
    const { data } = await api.get<SavingsGoalPage>('/savings-goals', {
      params: cleanParams({
        is_active: params?.is_active === true ? 'true' : undefined,
        limit: params?.limit,
        offset: params?.offset,
      }),
    })
    return data
  },

  async getSavingsGoalsSummary(): Promise<SavingsGoalsSummary> {
    const { data } = await api.get<SavingsGoalsSummary>(
      '/savings-goals/summary',
    )
    return data
  },

  async createSavingsGoal(input: SavingsGoalCreate): Promise<SavingsGoal> {
    const { data } = await api.post<SavingsGoal>('/savings-goals', input)
    return data
  },

  async updateSavingsGoal(
    goalId: string,
    input: SavingsGoalUpdate,
  ): Promise<SavingsGoal> {
    const { data } = await api.patch<SavingsGoal>(
      `/savings-goals/${goalId}`,
      input,
    )
    return data
  },

  async deleteSavingsGoal(goalId: string): Promise<void> {
    await api.delete(`/savings-goals/${goalId}`)
  },

  /* ------------------------------------------------ spending preferences */
  async getSpendingPreferences(): Promise<SpendingPreferences> {
    const { data } = await api.get<SpendingPreferences>(
      '/spending-preferences',
    )
    return data
  },

  async updateSpendingPreferences(
    input: SpendingPreferencesUpdate,
  ): Promise<SpendingPreferences> {
    const { data } = await api.patch<SpendingPreferences>(
      '/spending-preferences',
      input,
    )
    return data
  },

  /* -------------------------------------------------------- intelligence */
  async getMonthlySummary(params: {
    year: number
    month: number
  }): Promise<MonthlySummary> {
    const { data } = await api.get<MonthlySummary>('/intelligence/summary', {
      params: { year: params.year, month: params.month },
    })
    return data
  },

  async getCashFlowForecast(params?: { days?: number }): Promise<
    CashFlowForecast
  > {
    const { data } = await api.get<CashFlowForecast>('/intelligence/forecast', {
      params: { days: params?.days },
    })
    return data
  },

  async getFinancialReport(params: {
    year: number
    month: number
  }): Promise<FinancialReport> {
    const { data } = await api.get<FinancialReport>(
      '/intelligence/reports',
      { params: { year: params.year, month: params.month } },
    )
    return data
  },

  async checkProactiveAwareness(input: {
    transaction_amount: string
    transaction_category?: string | null
  }): Promise<ProactiveAwareness | null> {
    const { data } = await api.post<ProactiveAwareness | null>(
      '/intelligence/proactive-awareness',
      input,
    )
    return data
  },

  async generateInsights(): Promise<FinancialInsight[]> {
    const { data } = await api.post<FinancialInsight[]>(
      '/intelligence/insights',
    )
    return data
  },

  async dismissInsight(insightId: string): Promise<void> {
    await api.patch(`/intelligence/insights/${insightId}/dismiss`)
  },

  async detectFinancialRisks(): Promise<FinancialRisk[]> {
    const { data } = await api.get<FinancialRisk[]>('/intelligence/risks')
    return data
  },

  async getSpendingTrends(params?: { lookback_days?: number }): Promise<
    SpendingTrend
  > {
    const { data } = await api.get<SpendingTrend>('/intelligence/trends', {
      params: { lookback_days: params?.lookback_days },
    })
    return data
  },

  async listInsights(params?: {
    insight_type?: string
    severity?: string
    is_dismissed?: boolean
    limit?: number
    offset?: number
  }): Promise<FinancialInsightPage> {
    const { data } = await api.get<FinancialInsightPage>(
      '/intelligence/insights',
      {
        params: {
          insight_type: params?.insight_type,
          severity: params?.severity,
          is_dismissed: params?.is_dismissed === true ? 'true' : undefined,
          limit: params?.limit,
          offset: params?.offset,
        },
      },
    )
    return data
  },
}
