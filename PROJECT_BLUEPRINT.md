# AI PAYMENT GUARDIAN
## Master Project Blueprint and Development Instructions

> **Product name update:** this blueprint is the original specification, written
> under the working name "AI Payment Guardian". The product now ships as
> **UniFlow**. The historical name is retained throughout this document for
> traceability; only user-facing surfaces use the new name.

**Project Name:** AI Payment Guardian  
**Project Type:** AI-Powered Personal Finance and Payment Management Agent  
**Development Approach:** Six-Phase Incremental Development  
**Platforms:** Web and Mobile  
**AI Autonomy:** Approval-Based Agent  
**Financial Data Source:** Bank Integration  
**Architecture:** Modular Monolithic Architecture  

---

# 1. PROJECT OVERVIEW

AI Payment Guardian is an AI-powered financial management application designed to help users monitor their bank accounts, understand their spending patterns, manage upcoming payments, predict their future financial balance and make informed financial decisions.

The application should work as an intelligent personal financial assistant.

Instead of requiring users to manually analyse their transactions, calculate upcoming expenses and remember payment dates, AI Payment Guardian should analyse authorised financial data and provide meaningful insights, recommendations and timely alerts.

The system should have two interfaces:

1. Web Application.
2. Mobile Application.

Both applications must communicate with the same backend and database. Financial information, user preferences, transactions, bills, AI conversations and approval records must remain synchronised across both platforms.

The application must be simple, intuitive and user-friendly. It should not overwhelm users with excessive charts, unnecessary information or complicated navigation.

The primary objective is to build a reliable AI financial assistant that can understand a user's financial situation and assist with financial management while keeping the user in control of important decisions.

---

# 2. FINALIZED PROJECT DECISIONS

The following decisions are finalized and must be treated as project requirements.

| Component | Selected Technology / Decision |
|---|---|
| Web frontend | React.js |
| Mobile frontend | React Native with Expo |
| Backend | Python with FastAPI |
| Database | PostgreSQL |
| AI integration | LLM-based AI agent |
| Financial calculations | Python-based deterministic services |
| Background processing | Redis and Celery |
| Containerization | Docker |
| Version control | Git and GitHub |
| CI/CD | GitHub Actions |
| Bank data | Consent-based bank integration |
| Agent autonomy | Approval required for consequential actions |
| Architecture | Modular monolithic architecture |

Do not introduce alternative frameworks or technologies without first explaining why the existing architecture cannot satisfy a requirement.

Do not unnecessarily increase project complexity.

---

# 3. PROJECT OBJECTIVES

The application must achieve the following objectives.

1. Allow users to securely register and access their accounts.
2. Connect users' bank accounts through an authorised integration.
3. Retrieve and organise financial information.
4. Display account balances and transaction history.
5. Identify income and expense patterns.
6. Detect recurring payments and subscriptions.
7. Maintain upcoming payment schedules.
8. Calculate projected account balances.
9. Identify potential financial risks.
10. Provide AI-powered financial explanations.
11. Recommend appropriate payment priorities.
12. Generate timely reminders and alerts.
13. Prepare proposed financial actions.
14. Request user approval before consequential actions.
15. Maintain a history of recommendations, approvals and actions.
16. Provide Smart Tax Planning for Indian income-tax, comparing old and new tax regimes using versioned, effective-dated tax rules.
17. Provide AI Investment Intelligence for stock market analysis, gold and silver tracking, and personalized investment suggestions, clearly distinguishing factual data, AI predictions and recommendations.
18. Provide Unified Financial Intelligence integrating tax planning, investment intelligence and existing payment/budget data with cash-flow-aware guardrails.
19. Detect fraudulent or suspicious investment opportunities and suspicious UPI accounts without silently blocking legitimate transactions.

The application must never pretend that a simulated operation is a real bank transaction.

During development, mock financial data may be used, but it must always be clearly identified as mock data.

---

# 4. CORE FUNCTIONALITIES

## 4.1 User Management

The system must support:

- User registration.
- User login and logout.
- Secure authentication.
- User profile management.
- Password management.
- User preferences.
- Session management.
- Account status management. Disabling an account invalidates every existing
  session; re-enabling it does not restore them. Application-driven status
  changes are applied atomically with session revocation, and an ORM guard
  enforces the same rule for any other ORM write of `User.is_active`. Phase 1
  exposes no public or administrative status operation; the invariant exists
  so that any future one is safe by construction.
- Account deletion and data management.

Each user must only be able to access their own financial information.

## 4.2 Bank Account Management

The system must support:

- Connecting bank accounts.
- Viewing connected accounts.
- Displaying account information.
- Retrieving authorised account information.
- Synchronising financial data.
- Displaying the last synchronisation time.
- Handling expired or revoked consent.
- Disconnecting bank accounts.

Bank integration must be implemented through a provider-independent adapter.

For the Indian banking ecosystem, investigate the Account Aggregator framework and suitable authorised integration partners.

Do not collect or store internet-banking passwords, UPI PINs, OTPs, CVVs or card PINs.

## 4.3 Transaction Management

The system must:

- Retrieve authorised transactions.
- Display transaction details.
- Identify income and expenses.
- Categorise transactions.
- Allow users to correct categories.
- Identify recurring transactions.
- Detect potential duplicate transactions.
- Support transaction filtering.
- Maintain transaction history.

## 4.4 Bill and Subscription Management

The system must:

- Identify recurring payment patterns.
- Allow manual bill creation.
- Maintain bill due dates.
- Identify subscription payments.
- Display upcoming payments.
- Track payment status.
- Generate reminders.
- Identify subscriptions that may require user review.

Do not automatically assume that every repeated transaction is a confirmed subscription.

## 4.5 Financial Intelligence

The system must:

- Calculate income.
- Calculate expenses.
- Calculate available balances using the latest valid information.
- Analyse spending patterns.
- Identify unusual transactions.
- Estimate upcoming expenses.
- Forecast future balances.
- Identify potential low-balance situations.
- Explain financial risks.

All authoritative financial calculations must be performed by deterministic backend services rather than relying on LLM-generated arithmetic.

## 4.6 AI Financial Assistant

The AI assistant must:

- Understand user questions.
- Retrieve authorised financial information.
- Explain spending patterns.
- Explain upcoming payments.
- Answer balance-related questions.
- Explain financial forecasts.
- Identify potential cash-flow problems.
- Recommend payment priorities.
- Generate actionable suggestions.
- Ask clarifying questions when information is insufficient.

The AI must never invent transactions, account balances, payment confirmations or financial information.

## 4.7 Payment Approval System

The AI agent must be able to prepare proposed actions, but it must not independently execute consequential financial actions.

The user must explicitly approve every consequential action.

The approval process must display:

- Action description.
- Amount.
- Destination or payee, where applicable.
- Source account, where applicable.
- Proposed date.
- Reason for the recommendation.
- Relevant conditions.

If any important action detail changes, the previous approval must become invalid.

If an authorised payment integration is unavailable, the application should provide a safe reminder or hand-off instead of simulating payment execution.

## 4.8 Smart Tax Planning (ADDITION)

The system must support Indian Smart Tax Planning:

- Calculate estimated Indian income-tax using versioned, effective-dated tax rules for both the old and new tax regimes.
- Apply the latest applicable tax slabs, deductions, rebates, cess and other relevant rules.
- Store tax rules with effective dates so they can be updated when legislation changes.
- Calculate estimated tax based on user-provided financial information (income, deductions, investments).
- Compare the old and new tax regimes and recommend the more suitable regime based on the user's actual circumstances.
- Explain tax calculations and assumptions transparently, showing slab breakdowns and deduction details.
- Include tax-saving investment information (e.g., Section 80C, 80D) where applicable.
- All tax arithmetic must be performed by deterministic backend services; the LLM may explain but never calculate tax.

## 4.9 AI Investment Intelligence (ADDITION)

The system must support AI Investment Intelligence:

- Provide AI-powered stock-market analysis and forecasting, explaining daily market rises and declines.
- Provide stock insights, risk analysis and potential opportunities.
- Provide personalized investment suggestions based on financial goals, available budget and risk tolerance.
- Track gold and silver market prices with price analysis and trading-related information.
- Include fraud detection and suspicious investment alerts.
- Detect suspicious UPI accounts based on the user's own payment history and user-supplied payment requests.
- Clearly distinguish factual market data, AI-generated predictions and recommendations through explicit labeling.
- Never guarantee returns.
- Never execute trades without explicit, per-order user authorization.
- Start with mock market data and a provider-independent architecture; do not commit to paid APIs before evaluating cost, licensing and reliability.
- Investment suggestions must account for upcoming bills, subscriptions, dues, available balances and savings goals, and must not recommend investments that could compromise the user's ability to meet upcoming financial obligations.
- False positives in fraud detection must not silently block legitimate transactions.

## 4.10 Unified Financial Intelligence (ADDITION / IMPROVEMENT)

The system must provide Unified Financial Intelligence:

- Integrate tax planning and investment intelligence with existing payment, budget, bill and subscription data.
- Consider upcoming bills, subscriptions, dues, available balances and savings goals before suggesting investments.
- Avoid recommendations that could compromise the user's ability to meet upcoming financial obligations.
- Provide a unified financial overview without compromising privacy.
- Tax planning, stock-market intelligence, gold and silver analysis are additional capabilities and must not displace core payment-management functionality.

---

# 5. SYSTEM ARCHITECTURE

Implement a modular monolithic architecture.

The web application and mobile application must share a centralized backend.

### Architecture Flow

Web Application (React)
             |
             |
Mobile Application (React Native)
             |
             |
         FastAPI Backend
             |
   ---------------------------
   |       |       |         |
 Auth   Banking   AI     Analytics
   |       |       |         |
   ---------------------------
             |
       PostgreSQL
             |
       Redis / Celery
             |
   Background Processing
             |
 Authorised Bank Provider

### Frontend Responsibilities

The frontend must handle:

- User interface.
- Navigation.
- Authentication screens.
- Dashboard.
- Financial data presentation.
- Transaction management.
- Bill management.
- AI assistant interface.
- Notification centre.
- Approval interface.
- User settings.

The frontend must not independently calculate authoritative financial balances or make direct bank-provider requests.

### Backend Responsibilities

The backend must handle:

- Authentication and authorisation.
- Financial data processing.
- Bank integration.
- Transaction management.
- Database operations.
- Financial calculations.
- Forecast generation.
- AI agent orchestration.
- Notification management.
- Approval validation.
- Action execution through authorised providers.
- Audit logging.

### Database Responsibilities

PostgreSQL must store:

- User information.
- Account metadata.
- Bank connection references.
- Consent records.
- Transactions.
- Categories.
- Bills.
- Subscriptions.
- Forecasts.
- Financial insights.
- AI conversations.
- Notifications.
- Approval records.
- Action records.
- Audit events.

All user-owned data must be associated with the appropriate user identifier.

---

# 6. SIX-PHASE DEVELOPMENT PLAN

The complete project must be developed through six independent but interconnected phases.

Each phase must build upon the previous phase.

Do not skip required dependencies or implement future-phase functionality prematurely.

## PHASE 1 — PROJECT FOUNDATION AND AUTHENTICATION

**Status:** Complete and formally closed on 18 November 2026 (independent
review: **FINAL PASS**, no blocking findings). Final test results, accepted
limitations and verification evidence are recorded in
`phases/PHASE_1_PROGRESS.md`.

### Objective

Establish the project infrastructure, configure all development environments and implement secure user authentication.

### Frontend Development

Create the React web application and React Native mobile application.

Implement:

1. Project entry points.
2. Navigation structure.
3. Common UI components.
4. Responsive layouts.
5. Welcome screen.
6. Registration screen.
7. Login screen.
8. Dashboard layout.
9. Profile screen.
10. Settings screen.
11. Loading and error states.

### Backend Development

Implement:

1. FastAPI application.
2. API routing.
3. Database connection.
4. Environment configuration.
5. Authentication services.
6. User management.
7. Password hashing.
8. Token/session management.
9. Authentication middleware or dependencies.
10. Centralised exception handling.

### Database Development

Create:

- Users.
- User preferences.
- Authentication/session records.

Use database migrations.

### Security Requirements

- Never store plain-text passwords.
- Protect private API endpoints.
- Validate incoming data.
- Protect authentication tokens.
- Rate-limit login, registration and refresh endpoints and return `429` with `Retry-After` when a client exceeds the limit.
- Store secrets in environment variables.
- Enforce user-level data isolation.

### Completion Criteria

Phase 1 is complete when:

- Both frontend applications start successfully.
- Backend starts successfully.
- PostgreSQL connection works.
- Users can register and log in.
- Authentication works correctly.
- Protected endpoints reject unauthenticated requests.
- Both applications communicate with the backend.

### Expected Deliverable

A working web and mobile application with secure authentication and a centralized backend.

---

## PHASE 2 — BANK INTEGRATION AND FINANCIAL DATA MANAGEMENT

**Status:** Implemented on 20 November 2026 and re-verified on 21 November 2026
after an independent read-only review. Requirement checklist,
exact test results and accepted limitations are recorded in
`phases/PHASE_2_PROGRESS.md`. Only the mock provider is bundled; no Phase 3
analysis, forecasting or AI behaviour is included.

### Objective

Establish the financial data infrastructure and implement account, transaction, bill and subscription management.

This phase must create the reliable financial data foundation required by the intelligence and AI systems.

### Bank Integration

Implement:

1. Bank provider adapter.
2. Mock bank provider for development.
3. Bank connection workflow.
4. Consent management.
5. Account information retrieval.
6. Transaction synchronisation.
7. Synchronisation status.
8. Error handling.
9. Consent expiry handling.
10. Consent revocation.

The provider adapter must allow a legitimate bank-data provider to be integrated without rewriting the financial management modules.

### Transaction Management

Implement:

- Transaction retrieval.
- Transaction storage.
- Transaction categorisation.
- Transaction filtering.
- Transaction history.
- Duplicate detection.
- Income identification.
- Expense identification.
- Manual transaction entry.

### Bill Management

Implement:

- Bill creation.
- Bill editing.
- Bill deletion.
- Due-date management.
- Payment status.
- Upcoming bill identification.
- Recurring bill management.

### Subscription Management

Implement:

- Subscription identification.
- Subscription creation.
- Subscription editing.
- Subscription history.
- Recurring payment tracking.
- Subscription reminders.

### Frontend Screens

- Bank connection screen.
- Connected accounts screen.
- Transaction dashboard.
- Transaction details.
- Bill management.
- Subscription management.
- Upcoming payments calendar.
- Synchronisation status.

### Database Entities

- Bank connections.
- Bank consents.
- Financial accounts.
- Transactions.
- Transaction categories.
- Bills.
- Subscriptions.
- Synchronisation jobs.

### Completion Criteria

- Users can view their connected accounts.
- Transactions are retrieved or loaded from mock providers.
- Duplicate transactions are prevented.
- Bills and subscriptions can be managed.
- Synchronisation status is visible.
- Financial records are correctly associated with their owners.
- Consent revocation prevents further unauthorised synchronisation.

### Expected Deliverable

A functional financial data management system.

---

## PHASE 3 — FINANCIAL INTELLIGENCE AND PREDICTION ENGINE

**Status:** Implemented and verified on 23 November 2026. **Not formally
closed:** migration `0003_phase3_intelligence` is not yet applied to the
development database. Verification evidence is recorded in
`phases/PHASE_3_PROGRESS.md`. Phase 4 has not been started.

### Objective

Transform the financial records obtained in Phase 2 into meaningful financial intelligence.

This phase introduces the core analytical engine that will later support the AI agent.

### Financial Analysis

Implement:

1. Total income calculation.
2. Total expense calculation.
3. Monthly financial summaries.
4. Category-wise expense analysis.
5. Spending trends.
6. Recurring payment analysis.
7. Financial history analysis.

### Cash Flow Prediction

Implement:

1. Upcoming expense calculation.
2. Expected income calculation.
3. Projected balance calculation.
4. Daily cash-flow projections.
5. Weekly financial forecasts.
6. Monthly financial forecasts.
7. Low-balance prediction.

### Risk Detection

Implement:

- Potential unusual spending detection.
- Possible duplicate transaction detection.
- Upcoming payment conflicts.
- Potential insufficient-balance warnings.
- Unusual changes in spending patterns.
- Unreviewed recurring payments.

### Budget Planner

Implement:

- Monthly and category-based budgets.
- Create, edit and manage budgets.
- Track actual spending, remaining amounts and overspending.
- Savings goals where appropriate.

### Proactive Spending Awareness

Implement:

- Configurable advance reminders, including 3–4 days before dues.
- Due-date and optional post-payment reminders.
- Entertainment spending alerts before/after transactions according to user preference.
- Configurable categories, thresholds, timing and frequency.
- Persist user preferences reliably.

### Intelligence Engine Design

Use deterministic Python services for calculations and financial rules.

The engine must receive financial records and generate structured insights.

Example:

Input:
- Current available balance.
- Upcoming bills.
- Expected income.
- Recent spending history.

Output:
- Projected balance.
- Expected expenses.
- Potential financial risks.
- Relevant warnings.
- Explanations and supporting records.

### Frontend Screens

- Financial overview.
- Spending analysis.
- Cash-flow forecast.
- Upcoming payment insights.
- Risk notifications.
- Financial reports.
- Budget planner.
- Spending preferences.

### Completion Criteria

- Calculations are accurate.
- Forecasts are reproducible.
- Historical records are considered appropriately.
- Predictions clearly identify their assumptions.
- Missing or outdated information is communicated.
- Users can understand why an insight was generated.

### Expected Deliverable

A reliable financial intelligence and prediction engine.

---

## PHASE 4 — AI GUARDIAN AGENT, TAX PLANNING AND INVESTMENT INTELLIGENCE

### Objective

Introduce the AI agent that acts as the user's intelligent financial assistant, plus the Smart Tax Planning and AI Investment Intelligence engines.

The AI agent must use the financial data and intelligence services developed in earlier phases.

### AI Agent Capabilities (ORIGINAL)

The agent must:

1. Understand natural-language questions.
2. Retrieve relevant user financial information.
3. Analyse spending patterns.
4. Explain financial summaries.
5. Explain future balance predictions.
6. Identify upcoming payment priorities.
7. Identify potential financial risks.
8. Generate personalised recommendations.
9. Answer follow-up questions.
10. Prepare proposed actions for user review.

### Tool-Based Agent Architecture (ORIGINAL)

The AI agent must not have unrestricted access to the database.

Instead, implement controlled backend tools.

Example tools:

- `get_account_summary`
- `get_transaction_history`
- `get_monthly_spending`
- `get_upcoming_bills`
- `get_subscription_summary`
- `get_cashflow_forecast`
- `get_financial_insights`
- `create_action_proposal`

Every tool must enforce user authentication, authorisation and input validation.

### AI Agent Workflow (ORIGINAL)

User Question
      |
      v
AI Intent Understanding
      |
      v
Identify Required Information
      |
      v
Call Authorised Backend Tools
      |
      v
Retrieve Verified Financial Data
      |
      v
Analyse and Interpret Results
      |
      v
Generate Explanation or Recommendation
      |
      v
Display Response to User

### Example Questions (ORIGINAL)

- How much did I spend this month?
- What payments are due this week?
- Will I have enough balance after my upcoming payments?
- Which subscriptions are recurring?
- Why is my projected balance decreasing?
- Which payments should I prioritise?
- How much money can I safely spend based on my recorded commitments?

### AI Recommendation Engine (ORIGINAL)

Recommendations must be based on:

- Actual transaction history.
- Confirmed upcoming bills.
- Expected income records.
- User preferences.
- Financial forecasts.
- Detected risks.

The AI must explain why it makes a recommendation.

### Smart Tax Planning Engine (ADDITION)

The system must implement a deterministic Indian tax calculation engine:

- Support both old and new Indian income-tax regimes.
- Use versioned, effective-dated tax rules (slabs, deductions, rebates, cess) that can be updated when legislation changes.
- Calculate estimated tax based on user-provided financial information (income, deductions, investments).
- Compare old vs new regimes and recommend the more suitable regime based on the user's actual circumstances.
- Explain tax calculations and assumptions transparently (slab breakdowns, deduction details).
- Include tax-saving investment information (e.g., Section 80C, 80D) where applicable.
- All tax arithmetic performed by deterministic backend services; the LLM may explain but never calculate tax.

### AI Investment Intelligence Engine (ADDITION)

The system must implement AI-powered investment intelligence:

- Stock-market analysis and forecasting, explaining daily market rises and declines.
- Stock insights, risk analysis and potential opportunities.
- Personalized investment suggestions based on financial goals, available budget and risk tolerance.
- Gold and silver market tracking with price analysis and trading-related information.
- Fraud detection and suspicious investment alerts.
- Suspicious UPI account detection based on the user's own payment history and user-supplied payment requests.
- Clearly distinguish factual market data, AI-generated predictions and recommendations through explicit labeling.
- Never guarantee returns.
- Never execute trades without explicit, per-order user authorization.
- Start with mock market data and provider-independent architecture; do not commit to paid APIs before evaluating cost, licensing and reliability.
- Investment suggestions must account for upcoming bills, subscriptions, dues, available balances and savings goals.
- Avoid recommendations that could compromise the user's ability to meet upcoming financial obligations.
- False positives in fraud detection must not silently block legitimate transactions.

### Frontend Screens (ORIGINAL)

- Ask Guardian.
- Chat interface.
- Recommendation cards.
- Financial explanation screens.
- Conversation history.

### Tax and Investment Frontend Screens (ADDITION)

- Tax dashboard: regime comparison, estimated tax, tax-saving suggestions.
- Investment screen: stock analysis, gold/silver tracker, personalized suggestions.
- Factual vs AI-prediction vs recommendation labeling badges.
- Disclaimers: no guaranteed returns, no trade execution without authorization.

### Security Requirements (ORIGINAL)

- AI must only access the authenticated user's data.
- Do not expose unrestricted database access.
- Validate all tool calls.
- Treat retrieved financial data as untrusted input.
- Protect against prompt injection.
- Never allow AI-generated text alone to authorise payments.
- Do not allow the AI to invent financial information.

### Tax and Investment Security Requirements (ADDITION)

- Tax data is user-provided; never shared with third parties.
- Investment suggestions are clearly labeled as non-guaranteed.
- No trade execution in Phase 4 (read-only analysis).
- Market data fetched server-side only; frontend never calls external financial APIs directly.
- Fraud detection is advisory; never silently blocks user actions.

### Completion Criteria (ORIGINAL)

- Users can ask financial questions.
- The AI retrieves the correct user's financial information.
- The AI can explain Phase 3 predictions.
- Recommendations have identifiable supporting information.
- The agent cannot independently execute consequential actions.

### Tax and Investment Completion Criteria (ADDITION)

- Tax calculations match known Indian tax slabs (old/new regime boundary conditions).
- Investment insights labeled correctly (factual vs AI prediction vs recommendation).
- Fraud alerts do not block legitimate transactions.
- All new API endpoints require bearer auth and return 404 for cross-user access.

### Expected Deliverable

A functional AI financial assistant with controlled tools, recommendation capabilities, Smart Tax Planning engine and AI Investment Intelligence engine.

---

## PHASE 5 — INTELLIGENT ALERTS, APPROVAL WORKFLOW, UNIFIED INTELLIGENCE AND CONTROLLED ACTIONS

### Objective

Allow the AI agent to convert recommendations into proposed actions while ensuring that the user remains in control. Integrate tax planning and investment intelligence into the unified financial overview with cash-flow-aware guardrails.

This phase introduces the approval-based autonomy model.

### Notification System (ORIGINAL)

Implement:

1. Upcoming bill reminders.
2. Payment due notifications.
3. Low-balance warnings.
4. Potential unusual-spending alerts.
5. Subscription reminders.
6. Financial forecast alerts.
7. Action status notifications.

### Tax and Investment Notifications (ADDITION)

- Tax filing reminders.
- Investment alert notifications.
- Fraud alert delivery (suspicious investment and UPI account alerts via notification centre).

### Approval Management (ORIGINAL)

The AI agent must be able to prepare an action proposal.

Example:

The AI identifies an upcoming payment and recommends that the user review it.

It prepares a proposal containing:

- Payment description.
- Amount.
- Payee.
- Source account.
- Proposed date.
- Reason.
- Supporting information.

The user must explicitly approve or reject the proposal.

### Extended Approval Management (ADDITION)

- Tax regime change proposal (user approves switching tax regime; saved as preference).
- Tax-saving investment proposal (propose Section 80C/80D investments; user approves recording).
- Investment order proposal (read-only preparation of buy/sell order details; requires explicit per-order approval).
- All extended proposals follow the same approval workflow with exact action detail validation.

### Approval Workflow

AI Recommendation
       |
       v
Prepare Action Proposal
       |
       v
Validate Action Details
       |
       v
Display Approval Request
       |
       v
User Decision
       |
   -----------
   |         |
 Reject    Approve
   |         |
 Record    Revalidate
 Decision    |
             v
       Execute Through
       Authorised Provider
             |
             v
       Record Final Status

### Action Management

Implement:

- Action proposal creation.
- Approval requests.
- Approval history.
- Rejection handling.
- Expired approvals.
- Action execution status.
- Cancellation where supported.
- Action audit records.
- Duplicate execution protection.

### Unified Financial Intelligence (ADDITION / IMPROVEMENT)

- Integrate tax planning and investment intelligence with existing payment, budget, bill and subscription data.
- Consider upcoming bills, subscriptions, dues, available balances and savings goals before suggesting investments (cash-flow-aware guardrails).
- Avoid recommendations that could compromise the user's ability to meet upcoming financial obligations.
- Provide a unified financial overview without compromising privacy.

### Agent Autonomy Rules

The agent may:

- Analyse financial information.
- Generate insights.
- Recommend actions.
- Prepare action proposals.
- Generate reminders.
- Schedule non-consequential background checks.

The agent must not:

- Independently transfer money.
- Independently initiate consequential payments.
- Change payment destinations without approval.
- Change approved payment amounts without renewed approval.
- Execute an action based on ambiguous user instructions.
- Claim an action has succeeded without provider confirmation.

### Trading Restriction (ADDITION)

- No actual trade execution in Phase 4 or Phase 5.
- Trade execution requires regulatory, security and operational review before any future implementation.
- Read-only order preparation only; no stored brokerage credentials that allow withdrawal or transfer.

### Frontend Screens

- Notification centre.
- Approval inbox.
- Action review screen.
- Approval confirmation.
- Action history.
- Notification settings.

### Unified Overview and Tax/Investment Frontend Screens (ADDITION)

- Unified dashboard: balance, upcoming bills, tax estimate, investment summary.
- Tax regime change approval screen.
- Investment order approval screen (read-only preparation).
- Notification centre with tax/investment/fraud alert categories.

### Completion Criteria

- Notifications are generated correctly.
- Users can approve and reject proposals.
- Approval is tied to exact action details.
- Changed action details invalidate previous approval.
- Duplicate actions are prevented.
- All important actions are recorded.
- Provider failures are communicated clearly.

### Unified Intelligence and Tax/Investment Completion Criteria (ADDITION)

- Investment suggestions respect upcoming bill obligations (cash-flow guardrail testing).
- Tax regime change requires explicit approval.
- Order proposals expire and cannot be executed after expiry.
- Duplicate execution protection for tax/investment actions.
- Unified dashboard displays correct aggregated cross-domain data.

### Expected Deliverable

A functional approval-based financial agent with safe and controlled action management.

---

## PHASE 6 — TESTING, SECURITY, DEPLOYMENT AND FINAL INTEGRATION

### Objective

Integrate all six-phase functionality into a reliable, secure and deployable product.

### Testing (ORIGINAL)

Implement:

- Unit testing.
- Backend API testing.
- Database integration testing.
- Authentication testing.
- Bank synchronisation testing.
- Transaction processing testing.
- Financial calculation testing.
- Forecast testing.
- AI tool permission testing.
- Approval workflow testing.
- Frontend testing.
- Mobile application testing.
- End-to-end testing.

### Tax and Investment Testing (ADDITION)

- Tax calculation testing: boundary cases, regime comparison, Indian tax slabs, deductions, rebates.
- Investment insight labeling verification: factual vs AI prediction vs recommendation labels.
- Fraud detection false-positive testing: verify legitimate investments are not flagged.
- Unified overview end-to-end testing: cross-domain data aggregation accuracy.
- Regulatory disclaimer verification: verify disclaimers shown on all tax/investment screens.

### Security (ORIGINAL)

Implement:

- Secure authentication.
- Authorisation checks.
- Input validation.
- User-level data isolation.
- Rate limiting.
- Secure session handling.
- Secret management.
- Sensitive data protection.
- Audit logging.
- Dependency security checks.
- Secure error handling.

### Tax and Investment Security (ADDITION)

- Tax and investment data isolation between users.
- No API keys in frontend; server-side proxy for market data.
- Audit logging for tax regime changes and investment order proposals.
- Market data API failure handling with degraded mode and cached data.

### Docker

Containerise the necessary services.

The development environment should support:

- Backend container.
- PostgreSQL container.
- Redis container.
- Background worker container.
- Web development environment where appropriate.

Use Docker Compose for local development.

### CI/CD

Use GitHub Actions to automate:

- Code quality checks.
- Backend tests.
- Frontend tests.
- Build validation.
- Deployment workflow.

### Deployment

Prepare:

- Backend hosting.
- Database hosting.
- Web frontend deployment.
- Mobile application builds.
- Environment configurations.
- Production logging.
- Error monitoring.
- Database backup strategy.

### Documentation (ORIGINAL)

Maintain:

- Project README.
- Architecture documentation.
- Database documentation.
- API documentation.
- Installation instructions.
- Environment configuration.
- AI agent documentation.
- Security documentation.
- Deployment instructions.

### Tax and Investment Documentation (ADDITION)

- Tax rule version update procedure documentation.
- Market data API evaluation criteria (cost, licensing, reliability).
- Disclaimer content for all tax and investment screens.
- Investment read-only preparation and trading restriction documentation.

### Completion Criteria (ORIGINAL)

- All six phases work together.
- All critical tests pass.
- No unresolved critical security issues remain.
- Both applications communicate with the production backend.
- Database migrations work correctly.
- The application is deployable.
- Project documentation is complete.

### Tax and Investment Completion Criteria (ADDITION)

- Tax calculations match reference test cases.
- Investment insights properly labeled in UI.
- Unified dashboard displays correct aggregated data.
- Disclaimers present on all tax/investment screens.

### Expected Deliverable

A complete, tested and deployable AI Payment Guardian application.

---

# 7. RECOMMENDED PROJECT FOLDER STRUCTURE

Maintain the following structure.

ai-payment-guardian/
│
├── PROJECT_BLUEPRINT.md
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
│
├── frontend/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── features/
│       │   ├── services/
│       │   ├── hooks/
│       │   ├── styles/
│       │   └── utils/
│       └── package.json
│
├── mobile/
│   ├── app/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── banking/
│   │   │   ├── accounts/
│   │   │   ├── transactions/
│   │   │   ├── bills/
│   │   │   ├── subscriptions/
│   │   │   ├── analytics/
│   │   │   ├── forecasting/
│   │   │   ├── ai/
│   │   │   ├── approvals/
│   │   │   ├── notifications/
│   │   │   ├── audit/
│   │   │   ├── tax/
│   │   │   └── investment/
│   │   └── workers/
│   ├── migrations/
│   ├── tests/
│   └── requirements.txt
│
├── phases/
│   ├── PHASE_1_FOUNDATION.md
│   ├── PHASE_2_FINANCIAL_DATA.md
│   ├── PHASE_3_PREDICTION_ENGINE.md
│   ├── PHASE_4_AI_ASSISTANT.md
│   ├── PHASE_5_APPROVALS_AND_ALERTS.md
│   └── PHASE_6_TESTING_AND_DEPLOYMENT.md
│
├── docs/
│   ├── architecture/
│   ├── database/
│   ├── api/
│   ├── security/
│   └── deployment/
│
├── infrastructure/
│   ├── docker/
│   ├── scripts/
│   └── ci/
│
└── .github/
    └── workflows/

This is the target structure. Create directories and files progressively as required. Do not create empty files or unnecessary abstractions merely to match the structure.

---

# 8. DATABASE DESIGN PRINCIPLES

The database must be designed to support all six phases.

Expected core entities:

1. Users.
2. User preferences.
3. Bank connections.
4. Bank consents.
5. Financial accounts.
6. Account balance snapshots.
7. Transactions.
8. Transaction categories.
9. Bills.
10. Subscriptions.
11. Forecasts.
12. Financial insights.
13. AI conversations.
14. AI messages.
15. Action proposals.
16. Approvals.
17. Executed actions.
18. Notifications.
19. Audit events.
20. Tax rules (versioned, effective-dated Indian tax slabs, deductions, rebates, cess).
21. Tax calculations (user tax estimates, regime used, assumptions).
22. Tax regime preferences (user's selected tax regime).
23. Investment insights (stock/gold/silver analysis, factual vs AI-labeled).
24. Fraud alerts (suspicious investment and UPI account flags).
25. Investment order proposals (read-only prepared orders, approval status).
26. Tax saving investment records (user-recorded 80C/80D investments).

Use appropriate foreign keys, indexes, constraints and timestamps.

All user-specific records must have ownership validation.

Use database migrations to manage schema changes.

Do not modify existing database structures without analysing their dependencies.

---

# 9. API DEVELOPMENT PRINCIPLES

Use versioned REST APIs.

Recommended prefix:

/api/v1/

Organise APIs according to their functional modules.

Examples:

Authentication:
- POST /auth/register
- POST /auth/login
- POST /auth/logout
- GET /users/me

Banking:
- GET /bank-connections
- POST /bank-connections
- POST /bank-connections/{id}/sync
- POST /bank-connections/{id}/revoke

Financial Data:
- GET /accounts
- GET /transactions
- GET /bills
- GET /subscriptions

Analytics:
- GET /analytics/summary
- GET /analytics/spending
- GET /forecasts

AI:
- POST /assistant/conversations
- POST /assistant/messages

Approvals:
- GET /approvals
- POST /approvals/{id}/approve
- POST /approvals/{id}/reject

Tax:
- POST /tax/calculate
- GET /tax/regimes/compare
- GET /tax/rules
- POST /tax/regime-preference

Investment:
- GET /investment/stocks/analysis
- GET /investment/gold-silver/prices
- GET /investment/recommendations
- GET /investment/fraud-alerts
- POST /investment/order-proposals

Unified:
- GET /unified/overview

Use appropriate HTTP methods, validation, authentication and error responses.

Do not expose sensitive provider credentials through API responses.

---

# 10. AI AGENT ARCHITECTURE AND OPERATING RULES

The AI agent is the central intelligence layer of this project.

It must operate through controlled backend services and tools.

The agent must follow this sequence:

1. Receive the user's request.
2. Identify the user's intent.
3. Determine the required financial information.
4. Call authorised backend tools.
5. Retrieve verified information.
6. Analyse the information.
7. Generate an understandable response.
8. Identify whether an action proposal is needed.
9. Request user approval when necessary.
10. Record the final outcome.

The AI model must not independently modify database records or directly access financial providers.

All data modification must pass through validated backend services.

All financial calculations must be completed by the backend.

### AI Agent Tools for Tax and Investment (ADDITION)

The AI agent may use the following additional controlled tools:

- `get_tax_estimate` — calculate estimated Indian income-tax (deterministic backend service).
- `compare_tax_regimes` — compare old vs new tax regimes for the user.
- `get_stock_analysis` — retrieve stock market analysis and insights.
- `get_gold_silver_prices` — retrieve gold and silver market prices.
- `get_investment_recommendations` — personalized investment suggestions.
- `detect_investment_fraud` — flag suspicious investment opportunities.
- `detect_suspicious_upi_account` — flag suspicious UPI accounts based on user's payment history.
- `get_unified_overview` — retrieve unified financial summary across payments, tax and investments.

All tax calculations are performed by deterministic backend services; the LLM may explain but never calculate tax.

Market data tools distinguish factual data from AI predictions and recommendations through explicit labeling.

No tool may execute trades or guarantee returns.

The AI agent should be modular so that the LLM provider can be changed without rewriting the entire financial system.

---

# 11. UI/UX REQUIREMENTS

The application must prioritise simplicity.

The dashboard should display:

1. Greeting and account synchronisation status.
2. Available balance.
3. Upcoming payments.
4. Projected balance.
5. Important financial insight.
6. Recent transactions.
7. Ask Guardian entry point.

Web navigation:

- Dashboard.
- Transactions.
- Payments.
- Insights.
- Ask Guardian.
- Settings.

Mobile navigation:

- Home.
- Activity.
- Payments.
- Guardian.
- Profile.

Do not overload the dashboard with charts.

Use secondary pages for detailed financial analysis.

Maintain consistent design components across both applications.

Every screen must support appropriate loading, empty, success and error states.

### Tax and Investment UI/UX (ADDITION)

- Tax dashboard screen: regime comparison, estimated tax, tax-saving suggestions.
- Investment screen: stock analysis, gold/silver tracker, personalized suggestions.
- Factual vs AI-prediction vs recommendation labeling badges on all market data displays.
- Disclaimers: no guaranteed returns, no trade execution without authorization, on all tax and investment screens.
- Unified dashboard: balance, upcoming bills, tax estimate, investment summary.
- Tax regime change approval screen.
- Investment order approval screen (read-only preparation).

The dashboard must not be overloaded with tax or investment charts; use secondary pages for detailed tax and investment analysis.

---

# 12. SECURITY AND FINANCIAL SAFETY REQUIREMENTS

These requirements are mandatory throughout development.

1. Never store banking passwords.
2. Never request or store UPI PINs.
3. Never store OTPs or CVVs.
4. Obtain explicit bank-data consent.
5. Respect consent revocation.
6. Enforce user-level data isolation.
7. Protect API endpoints.
8. Validate all AI tool calls.
9. Keep sensitive information out of application logs.
10. Require explicit approval for consequential actions.
11. Revalidate action details before execution.
12. Prevent duplicate action execution.
13. Maintain an audit trail.
14. Never claim payment success without trusted confirmation.
15. Clearly distinguish mock data from actual bank data.
16. Clearly distinguish actual, pending and predicted financial values.
17. Clearly distinguish factual market data, AI predictions and investment recommendations.
18. Never guarantee investment returns.
19. Never execute trades without explicit, per-order user authorization.
20. Tax data is user-provided; never shared with third parties.
21. Fraud detection is advisory; never silently blocks legitimate transactions.
22. Investment suggestions must account for upcoming bills, subscriptions, dues, balances and savings goals.

Security must not be postponed until Phase 6. Basic security must be implemented in every phase, with comprehensive hardening in Phase 6.

---

# 13. GIT, DOCKER AND DEVELOPMENT MANAGEMENT

Use Git for version control.

Maintain a stable main branch.

Use separate feature branches for development.

Suggested branches:

- feature/phase-1-foundation
- feature/phase-2-financial-data
- feature/phase-3-prediction-engine
- feature/phase-4-ai-agent
- feature/phase-5-approval-system
- feature/phase-6-deployment

Commit changes in small, meaningful units.

Never commit:

- .env files.
- API keys.
- Access tokens.
- Banking credentials.
- Real financial records.
- Private certificates.

Use Docker for reproducible local development.

Use Docker Compose to manage services when required.

Keep configuration separate for development, testing and production.

---

# 14. MANDATORY INSTRUCTIONS FOR OPENCODE AI CODING AGENT

The following instructions must be followed whenever OpenCode analyses or implements any project phase.

## A. Understand Before Coding

Before making changes:

1. Read this complete PROJECT_BLUEPRINT.md.
2. Identify the current development phase.
3. Inspect the existing project folder structure.
4. Read relevant source files.
5. Identify already implemented functionality.
6. Understand the database schema.
7. Identify dependencies on previous phases.
8. Identify missing requirements.
9. Check whether existing code can be reused.
10. Prepare an implementation plan.

Never start modifying code immediately without analysing the existing project.

## B. Respect Phase Boundaries

Implement only the functionality requested for the current phase.

Understand future-phase requirements so that current code remains compatible with them.

Do not prematurely implement entire future phases.

For example:

- Phase 1 must prepare the application foundation for banking functionality.
- Phase 2 must prepare reliable financial records for analytics.
- Phase 3 must expose structured insights for the AI agent.
- Phase 4 must use those insights through controlled tools.
- Phase 5 must introduce approval-based actions.
- Phase 6 must integrate, test and deploy the complete application.

## C. Preserve Existing Functionality

Before modifying any file:

- Understand its current purpose.
- Identify its dependencies.
- Check its imports and API contracts.
- Avoid unnecessary rewrites.
- Preserve previously completed features.
- Do not delete existing functionality unless explicitly required.

Do not replace working code merely to implement a different coding style.

## D. Avoid Duplicate Implementations

Before creating a new component, service, model or API:

- Search the existing project.
- Check whether equivalent functionality already exists.
- Reuse existing implementations where appropriate.
- Extend existing modules instead of creating duplicate modules.

Maintain a single source of truth for important business logic.

## E. Maintain Architecture

Keep frontend, backend, database and integration responsibilities separate.

Do not place financial calculations in frontend components.

Do not place business logic directly inside API route handlers when it belongs in a service.

Do not allow the AI model to bypass backend permissions.

Do not make direct bank-provider calls from the frontend.

Use modular and maintainable code.

## F. Coding Standards

- Use meaningful names.
- Keep functions focused.
- Avoid unnecessary code duplication.
- Add type annotations where appropriate.
- Validate input and output.
- Handle exceptions properly.
- Use environment variables for configuration.
- Follow consistent formatting.
- Write reusable components.
- Document complex business logic.
- Add tests for important functionality.

Do not introduce unnecessary design patterns or abstractions.

## G. Dependency Management

Before installing a new dependency:

1. Check whether it is already installed.
2. Determine whether it is necessary.
3. Check compatibility with existing versions.
4. Explain its purpose.
5. Avoid installing multiple libraries for the same functionality.

Keep dependency files updated.

## H. Database Management

- Inspect existing models before changing them.
- Use migrations.
- Preserve existing records.
- Avoid destructive schema changes.
- Add appropriate relationships.
- Enforce data ownership.
- Add indexes where useful.
- Keep database and application schemas consistent.

Never reset or delete a working database without explicit permission.

## I. Frontend Requirements

- Maintain a simple and consistent interface.
- Avoid overcrowded screens.
- Use reusable components.
- Handle loading and error states.
- Maintain responsive layouts.
- Ensure web and mobile functionality remain consistent.
- Do not expose internal backend implementation details to users.

## J. AI Safety Requirements

- Use controlled backend tools.
- Enforce user-level permissions.
- Never expose unrestricted database access.
- Never rely on AI-generated arithmetic for authoritative financial calculations.
- Never allow AI text to count as payment approval.
- Require explicit user confirmation for consequential actions.
- Record important actions and decisions.

## K. Testing Requirements

After implementing a feature:

1. Run relevant tests.
2. Check backend startup.
3. Check frontend build.
4. Verify API communication.
5. Check database operations.
6. Check authentication and authorisation.
7. Check error handling.
8. Verify that previous functionality remains intact.

Do not claim that a feature works if it has not been tested.

If testing cannot be performed, explicitly report that limitation.

## L. Reporting Requirements

After completing a phase or requested task, provide a clear report containing:

1. What was analysed.
2. What was implemented.
3. Files created.
4. Files modified.
5. Dependencies installed.
6. Database changes.
7. Tests performed.
8. Test results.
9. Known limitations.
10. Remaining tasks.

Clearly distinguish completed functionality from partially implemented functionality.

---

# 15. PHASE COMPLETION PROTOCOL

A phase must not be considered complete merely because the code has been written.

Before declaring a phase complete:

- All requested features must be implemented.
- Previous-phase functionality must remain functional.
- Relevant tests must pass.
- API contracts must be consistent.
- Database changes must be verified.
- Security requirements must be checked.
- Documentation must be updated.

Maintain a phase progress document.

Suggested format:

| Requirement | Status | Notes |
|---|---|---|
| Authentication | Complete / Pending | |
| Database integration | Complete / Pending | |
| API implementation | Complete / Pending | |
| Frontend integration | Complete / Pending | |
| Testing | Complete / Pending | |
| Documentation | Complete / Pending | |

Do not mark incomplete features as completed.

---

# 16. FINAL PROJECT SUCCESS CRITERIA

AI Payment Guardian will be considered successfully developed when:

1. Users can securely access the application through web and mobile.
2. Users can connect financial accounts through an authorised integration.
3. Financial data is synchronised and organised correctly.
4. Transactions, bills and subscriptions can be managed.
5. The application can analyse spending patterns.
6. The prediction engine can estimate future cash flow.
7. The AI agent can understand and answer financial questions.
8. The AI agent can generate useful recommendations.
9. The system can issue relevant financial alerts.
10. The agent can prepare proposed financial actions.
11. Users retain control through explicit approval.
12. All important actions are recorded.
13. The application is tested and secure.
14. The complete application can be deployed.
15. The Smart Tax Planning engine calculates Indian income-tax correctly for both old and new regimes.
16. The AI Investment Intelligence engine distinguishes factual data, AI predictions and recommendations.
17. Investment suggestions respect cash-flow guardrails (upcoming bills, subscriptions, dues, balances, savings goals).
18. Fraud detection does not silently block legitimate transactions.
19. No trades are executed without explicit per-order user authorization and regulatory review.

---

# 17. FINAL DEVELOPMENT DIRECTIVE

AI Payment Guardian must be developed as a single integrated software product through six controlled development phases.

Every phase must contribute to the same final architecture.

The project must prioritise:

- Reliability over unnecessary complexity.
- Security over convenience.
- Accurate financial calculations over AI-generated guesses.
- User control over unrestricted agent autonomy.
- Reusability over duplicate code.
- Clear interfaces over information overload.
- Tested functionality over unverified implementation.

**MOST IMPORTANT INSTRUCTION TO THE OPENCODE AGENT:**

Before implementing any phase, analyse this entire blueprint and the existing project codebase. Understand the completed phases, identify the requirements of the requested phase, check dependencies, and prepare a detailed implementation plan.

Implement the requested phase without breaking previous functionality or introducing unnecessary changes.

Treat this document as the master reference for all future development decisions.

The ultimate goal is to deliver a complete, reliable, secure and intelligent AI Payment Guardian application that works consistently across web and mobile platforms.

**Development sequence: PHASE 1 → PHASE 2 → PHASE 3 → PHASE 4 → PHASE 5 → PHASE 6.**

---

# 18. LONG-TERM PRODUCT VISION

Everything in this section is **future scope**. None of it is implemented in
Phases 1–3, and none of it changes the phase sequence above. It records the
product direction so later phases are designed coherently rather than bolted
on.

Phases 4 and 5 introduce the foundational versions of several long-term
vision capabilities: Smart Tax Planning (Indian income-tax), AI Investment
Intelligence (stock market, gold and silver), fraud detection (suspicious
investments and UPI accounts), and Unified Financial Intelligence. These
are additions to the original Phase 4–5 roadmap and are clearly labeled
as ADDITION throughout this document. The long-term vision below describes
the eventual expansion beyond Phases 4–6.

The long-term product expands AI Payment Guardian from a passive financial
analyser into a guarded money assistant across banking, investments and
fraud protection — always with explicit user approval and auditable records.

## 18.1 Indian and global stock markets

- Read-only portfolio aggregation across Indian brokers (for example
  NSDL/CDSL-backed holdings and broker APIs) and global brokerage accounts,
  with per-account consent and revocation.
- Market data (quotes, indices, corporate actions) from a licensed data
  provider, clearly timestamps and sourced; no scraped or invented prices.
- Portfolio analytics: allocation, sector and geography exposure, unrealised
  and realised gain/loss in the holding's own currency, dividend history.
- Currency-aware reporting: INR and non-INR holdings are shown separately, or
  converted only with a disclosed, dated exchange rate.
- Educational, deterministic insights first (concentration risk, overlapping
  holdings, high expense ratios). No personalised buy/sell recommendation until
  the compliance work in 18.3 is complete.

## 18.2 Gold, silver and other physical/commodity holdings

- Track digital gold, sovereign gold bonds, ETFs, coins and jewellery as
  holdings with quantity, purity, purchase date and acquisition cost.
- Separate acquisition cost from current valuation; label valuation source and
  timestamp, and never present a stale price as current.
- Goal linkage: allow a savings goal to be backed by a commodity holding while
  keeping cash and commodity totals distinct.

## 18.3 User-approved trading (not autonomous trading)

- The agent may **prepare** a proposed order (instrument, quantity, order type,
  limit price, estimated charges and taxes) and explain it.
- Execution requires an explicit, per-order user approval with a re-entered
  credential or biometric confirmation, a visible expiry, and a full audit
  record of what was proposed, approved, rejected or failed.
- No autonomous trading, no unattended execution, no model-initiated order,
  and no stored brokerage credential that allows withdrawal or transfer.
- Hard safety controls: per-order and daily value caps, instrument allowlists,
  market-hours checks, dry-run mode, and an immediate global kill switch.
- Regulatory and legal review is a prerequisite: broker/exchange terms, SEBI
  and other applicable rules, suitability obligations, record retention and
  tax reporting. Until that review passes, the product remains read-only.

## 18.4 UPI and suspicious-account detection

- Analyse the user's **own** payment history (and user-supplied payment
  requests) for risk signals: first-time payee, sudden change in payee
  behaviour, mule-account patterns, mismatched payee name, unusual amount or
  timing, and repeated failed attempts.
- Present a clear, explainable warning before the user confirms a payment, with
  the specific signals that triggered it. Never silently block a legitimate
  payment and never claim to have intercepted one at the banking network.
- No collection or storage of another person's banking credentials, UPI PIN,
  OTP or card security code. Detection uses the user's records and consented
  data only.
- False-positive handling: easy dismissal, feedback capture and tuning, so
  warnings stay credible.

## 18.5 Scams, phishing and investment fraud

- Explainable fraud scoring for messages, links and payment requests the user
  explicitly submits: urgency and pressure language, impersonation of a bank
  or authority, unrealistic returns, payment to a personal account, and
  requests for OTPs or remote-access apps.
- Education-first guidance ("this pattern matches known investment fraud")
  rather than absolute claims. The assistant is not a substitute for the
  user's bank, regulator or law enforcement.
- A report-and-preserve flow that packages evidence for the user to submit,
  without uploading it anywhere without consent.
- Clear disclaimers, privacy limits on submitted content, and no retention of
  sensitive message contents beyond what the user chooses to keep.

## 18.6 Notification discipline (anti-spam)

- A single notification budget per user per day, with priority tiers
  (critical risk > due payment > budget warning > informational insight).
- Deduplication and quiet hours from user preferences, plus per-channel and
  per-category opt-in.
- Explain-why metadata on every alert, one-tap dismiss/snooze, and weekly
  digest batching for non-urgent items.
- Hard rule: no marketing or engagement notifications in the financial-alert
  channel.

## 18.7 Cross-cutting requirements for all long-term features

- User approval and auditability before any action that moves money or places
  an order.
- Consent-based data access with revocation, per-account scoping and no
  credential storage beyond opaque provider references.
- Deterministic, explainable calculations before generative explanations; an
  AI model may describe results, never invent them.
- Explicit currency handling with sourced rates and no silent conversion.
- Security review, threat modelling and abuse-case testing per feature,
  including data isolation between users.
- Legal and regulatory review per market before enabling anything beyond
  read-only analysis.