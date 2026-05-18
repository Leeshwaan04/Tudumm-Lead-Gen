import type { PlanType } from './workspace'

export type TransactionType = 'DEBIT' | 'CREDIT' | 'REFUND'

export interface Plan {
  type: PlanType
  name: string
  monthlyPrice: number
  creditAllocation: number
  execHours: number
  slots: number
  proxyGbRate: number
  aiCreditRate: number
  emailCreditRate: number
}

export interface Invoice {
  id: string
  amount: number
  currency: string
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE'
  periodStart: string
  periodEnd: string
  pdfUrl?: string
  paidAt?: string
}

export interface CreditTransaction {
  id: string
  type: TransactionType
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string
  createdAt: string
}
