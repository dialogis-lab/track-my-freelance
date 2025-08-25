import { supabase } from "@/integrations/supabase/client";
import { formatMoney, fromMinor, toMinor, type Currency } from "./currencyUtils";

export interface Expense {
  id: string;
  user_id: string;
  project_id: string;
  client_id: string | null;
  spent_on: string;
  vendor: string | null;
  category: string | null;
  description: string | null;
  quantity: number;
  unit_amount_cents: number;
  currency: string;
  vat_rate: number;
  net_amount_cents: number;
  vat_amount_cents: number;
  gross_amount_cents: number;
  billable: boolean;
  reimbursable: boolean;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseFormData {
  id?: string;
  project_id: string;
  client_id?: string;
  spent_on: string;
  vendor?: string;
  category?: string;
  description?: string;
  quantity: number;
  unit_amount_cents: number;
  currency: Currency;
  vat_rate: number;
  billable: boolean;
  reimbursable: boolean;
  receipt_url?: string;
}

export async function listProjectExpenses(projectId: string) {
  return supabase
    .from('expenses')
    .select('*')
    .eq('project_id', projectId)
    .order('spent_on', { ascending: false });
}

export async function getProjectExpenseTotal(projectId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select('gross_amount_cents, currency')
    .eq('project_id', projectId)
    .eq('billable', true);

  if (error) throw error;

  const totals = data.reduce((acc, expense) => {
    const currency = expense.currency as Currency;
    if (!acc[currency]) acc[currency] = 0;
    acc[currency] += expense.gross_amount_cents;
    return acc;
  }, {} as Record<Currency, number>);

  return totals;
}

export async function upsertExpense(expense: ExpenseFormData) {
  const { data, error } = await supabase.rpc('expense_upsert', {
    p_id: expense.id || null,
    p_project_id: expense.project_id,
    p_client_id: expense.client_id || null,
    p_spent_on: expense.spent_on,
    p_vendor: expense.vendor || null,
    p_category: expense.category || null,
    p_description: expense.description || null,
    p_quantity: expense.quantity,
    p_unit_amount_cents: expense.unit_amount_cents,
    p_currency: expense.currency,
    p_vat_rate: expense.vat_rate,
    p_billable: expense.billable,
    p_reimbursable: expense.reimbursable,
    p_receipt_url: expense.receipt_url || null
  });

  if (error) throw error;
  return data;
}

export async function deleteExpense(expenseId: string) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId);

  if (error) throw error;
}

export function formatCurrency(amountCents: number, currency: Currency): string {
  return formatMoney(amountCents, currency);
}

export function centsToCurrency(cents: number): number {
  return fromMinor(cents, 'CHF'); // Using CHF as base for display
}

export function currencyToCents(amount: number): number {
  return toMinor(amount, 'CHF'); // Using CHF as base for calculation
}

export async function uploadReceipt(file: File, expenseId: string, userId: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${expenseId}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  return filePath;
}

export async function getReceiptUrl(path: string): Promise<string> {
  const { data } = await supabase.storage
    .from('receipts')
    .createSignedUrl(path, 3600); // 1 hour expiry

  return data?.signedUrl || '';
}