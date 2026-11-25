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
  BudgetSpending,
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
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  ) as Record<string, string | number>
}

export const financeApi = {
  /* ---------------------------------------------------------- banking */
  async getProviders(): Promise<BankProvider[]> {
    const response = await api.get<BankProvider[]>('/banking/providers')
    return response.data
  },

  async getConnections(): Promise<BankConnection[]> {
    const response = await api.get<BankConnection[]>('/banking/connections')
    return response.data
  },

  async createConnection(input: {
    institution_id: string
    provider?: string
  }): Promise<ConnectionCreateResponse> {
    const response = await api.post<ConnectionCreateResponse>(
      '/banking/connections',
      input,
    )
    return response.data
  },

  async syncConnection(connectionId: string): Promise<SyncJob> {
    const response = await api.post<SyncJob>(
      `/banking/connections/${connectionId}/sync`,
    )
    return response.data
  },

  async revokeConnection(connectionId: string): Promise<void> {
    await api.delete(`/banking/connections/${connectionId}`)
  },

  /* --------------------------------------------------------- accounts */
  async getAccounts(activeOnly = true): Promise<FinancialAccount[]> {
    const response = await api.get<FinancialAccount[]>('/accounts', {
      params: { active_only: activeOnly },
    })
    return response.data
  },

  /* ----------------------------------------------------- transactions */
  async getCategories(): Promise<Category[]> {
    const response = await api.get<Category[]>('/transactions/categories')
    return response.data
  },

  async getTransactions(
    filters: TransactionFilters = {},
  ): Promise<TransactionPage> {
    const response = await api.get<TransactionPage>('/transactions', {
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
    return response.data
  },

  async createTransaction(input: TransactionCreate): Promise<Transaction> {
    const response = await api.post<Transaction>('/transactions', input)
    return response.data
  },

  async updateTransaction(
    transactionId: string,
    input: TransactionUpdate,
  ): Promise<Transaction> {
    const response = await api.patch<Transaction>(
      `/transactions/${transactionId}`,
      input,
    )
    return response.data
  },

  async deleteTransaction(transactionId: string): Promise<void> {
    await api.delete(`/transactions/${transactionId}`)
  },

  /* ------------------------------------------------------------ bills */
  async getBills(
    params: { state?: string; days?: number; search?: string } = {},
  ): Promise<BillPage> {
    const response = await api.get<BillPage>('/bills', {
      params: cleanParams({
        state: params.state,
        days: params.days,
        search: params.search,
        limit: 100,
      }),
    })
    return response.data
  },

  async createBill(input: BillInput): Promise<Bill> {
    const response = await api.post<Bill>('/bills', input)
    return response.data
  },

  async updateBill(billId: string, input: Partial<BillInput>): Promise<Bill> {
    const response = await api.patch<Bill>(`/bills/${billId}`, input)
    return response.data
  },

  async deleteBill(billId: string): Promise<void> {
    await api.delete(`/bills/${billId}`)
  },

  async payBill(
    billId: string,
    input: { paid_on?: string; amount?: string; note?: string } = {},
  ): Promise<Bill> {
    const response = await api.post<Bill>(`/bills/${billId}/pay`, input)
    return response.data
  },

  async getBillPayments(billId: string): Promise<Payment[]> {
    const response = await api.get<Payment[]>(`/bills/${billId}/payments`)
    return response.data
  },

  /* ---------------------------------------------------- subscriptions */
  async getSubscriptions(
    params: { status?: string; search?: string } = {},
  ): Promise<SubscriptionPage> {
    const response = await api.get<SubscriptionPage>('/subscriptions', {
      params: cleanParams({
        status: params.status,
        search: params.search,
        limit: 100,
      }),
    })
    return response.data
  },

  async createSubscription(
    input: SubscriptionInput,
  ): Promise<Subscription> {
    const response = await api.post<Subscription>('/subscriptions', input)
    return response.data
  },

  async updateSubscription(
    subscriptionId: string,
    input: Partial<SubscriptionInput> & {
      status?: 'active' | 'paused' | 'cancelled'
    },
  ): Promise<Subscription> {
    const response = await api.patch<Subscription>(
      `/subscriptions/${subscriptionId}`,
      input,
    )
    return response.data
  },

  async deleteSubscription(subscriptionId: string): Promise<void> {
    await api.delete(`/subscriptions/${subscriptionId}`)
  },

  async paySubscription(
    subscriptionId: string,
    input: { paid_on?: string; amount?: string; note?: string } = {},
  ): Promise<Subscription> {
    const response = await api.post<Subscription>(
      `/subscriptions/${subscriptionId}/pay`,
      input,
    )
    return response.data
  },

  async getSubscriptionPayments(
    subscriptionId: string,
  ): Promise<Payment[]> {
    const response = await api.get<Payment[]>(
      `/subscriptions/${subscriptionId}/payments`,
    )
    return response.data
  },

  /* --------------------------------------------------------- overview */
  async getSummary(days = 30): Promise<Summary> {
    const response = await api.get<Summary>('/summary', {
      params: { days },
    })
    return response.data
  },

  async getUpcoming(days = 30): Promise<UpcomingPayment[]> {
    const response = await api.get<UpcomingPayment[]>('/upcoming', {
      params: { days },
    })
    return response.data
  },

  async getRecurringSuggestions(): Promise<RecurringSuggestion[]> {
    const response = await api.get<RecurringSuggestion[]>(
      '/recurring-payments',
    )
    return response.data
  },

  /* ---------------------------------------------------------- budgets */
  async getBudgets(params?: {
    is_active?: boolean
    category_id?: string
    include_spending?: boolean
    limit?: number
    offset?: number
  }): Promise<BudgetPage> {
    const response = await api.get<BudgetPage>('/budgets', {
      params: cleanParams({
        is_active: params?.is_active === true ? 'true' : undefined,
        category_id: params?.category_id,
        include_spending: params?.include_spending === true ? 'true' : undefined,
        limit: params?.limit,
        offset: params?.offset,
      }),
    })
    return response.data
  },

  async createBudget(input: BudgetCreate): Promise<Budget> {
    const response = await api.post<Budget>('/budgets', input)
    return response.data
  },

  async getBudget(budgetId: string): Promise<Budget> {
    const response = await api.get<Budget>(`/budgets/${budgetId}`)
    return response.data
  },

  async updateBudget(
    budgetId: string,
    input: BudgetUpdate,
  ): Promise<Budget> {
    const response = await api.patch<Budget>(`/budgets/${budgetId}`, input)
    return response.data
  },

  async deleteBudget(budgetId: string): Promise<void> {
    await api.delete(`/budgets/${budgetId}`)
  },

  async getBudgetSpending(budgetId: string): Promise<BudgetSpending> {
    const response = await api.get<BudgetSpending>(
      `/budgets/${budgetId}/spending`,
    )
    return response.data
  },

  /* ----------------------------------------------------- savings goals */
  async getSavingsGoals(params?: {
    is_active?: boolean
    limit?: number
    offset?: number
  }): Promise<SavingsGoalPage> {
    const response = await api.get<SavingsGoalPage>('/savings-goals', {
      params: cleanParams({
        is_active: params?.is_active === true ? 'true' : undefined,
        limit: params?.limit,
        offset: params?.offset,
      }),
    })
    return response.data
  },

  async getSavingsGoalsSummary(): Promise<SavingsGoalsSummary> {
    const response = await api.get<SavingsGoalsSummary>(
      '/savings-goals/summary',
    )
    return response.data
  },

  async createSavingsGoal(input: SavingsGoalCreate): Promise<SavingsGoal> {
    const response = await api.post<SavingsGoal>('/savings-goals', input)
    return response.data
  },

  async getSavingsGoal(goalId: string): Promise<SavingsGoal> {
    const response = await api.get<SavingsGoal>(`/savings-goals/${goalId}`)
    return response.data
  },

  async updateSavingsGoal(
    goalId: string,
    input: SavingsGoalUpdate,
  ): Promise<SavingsGoal> {
    const response = await api.patch<SavingsGoal>(
      `/savings-goals/${goalId}`,
      input,
    )
    return response.data
  },

  async deleteSavingsGoal(goalId: string): Promise<void> {
    await api.delete(`/savings-goals/${goalId}`)
  },

  /* ------------------------------------------------ spending preferences */
  async getSpendingPreferences(): Promise<SpendingPreferences> {
    const response = await api.get<SpendingPreferences>(
      '/spending-preferences',
    )
    return response.data
  },

  async updateSpendingPreferences(
    input: SpendingPreferencesUpdate,
  ): Promise<SpendingPreferences> {
    const response = await api.patch<SpendingPreferences>(
      '/spending-preferences',
      input,
    )
    return response.data
  },

  /* -------------------------------------------------------- intelligence */
  async getMonthlySummary(params: {
    year: number
    month: number
  }): Promise<MonthlySummary> {
    const response = await api.get<MonthlySummary>('/intelligence/summary', {
      params: { year: params.year, month: params.month },
    })
    return response.data
  },

  async getSpendingTrends(params?: {
    lookback_days?: number
  }): Promise<SpendingTrend> {
    const response = await api.get<SpendingTrend>('/intelligence/trends', {
      params: cleanParams({
        lookback_days: params?.lookback_days,
      }),
    })
    return response.data
  },

  async getCashFlowForecast(params?: { days?: number }): Promise<
    CashFlowForecast
  > {
    const response = await api.get<CashFlowForecast>('/intelligence/forecast', {
      params: cleanParams({ days: params?.days }),
    })
    return response.data
  },

  async getFinancialReport(params: {
    year: number
    month: number
  }): Promise<FinancialReport> {
    const response = await api.get<FinancialReport>('/intelligence/reports', {
      params: { year: params.year, month: params.month },
    })
    return response.data
  },

  async detectFinancialRisks(): Promise<FinancialRisk[]> {
    const response = await api.get<FinancialRisk[]>('/intelligence/risks')
    return response.data
  },

  async generateInsights(): Promise<FinancialInsight[]> {
    const response = await api.post<FinancialInsight[]>(
      '/intelligence/insights',
    )
    return response.data
  },

  async listInsights(params?: {
    insight_type?: string
    severity?: string
    is_dismissed?: boolean
    limit?: number
    offset?: number
  }): Promise<FinancialInsightPage> {
    const response = await api.get<FinancialInsightPage>(
      '/intelligence/insights',
      {
        params: cleanParams({
          insight_type: params?.insight_type,
          severity: params?.severity,
          is_dismissed: params?.is_dismissed === true ? 'true' : undefined,
          limit: params?.limit,
          offset: params?.offset,
        }),
      },
    )
    return response.data
  },

  async dismissInsight(insightId: string): Promise<void> {
    await api.patch(`/intelligence/insights/${insightId}/dismiss`)
  },

  async checkProactiveAwareness(input: {
    transaction_amount: string
    transaction_category?: string | null
  }): Promise<ProactiveAwareness | null> {
    const response = await api.post<ProactiveAwareness | null>(
      '/intelligence/proactive-awareness',
      input,
    )
    return response.data
  },
}
