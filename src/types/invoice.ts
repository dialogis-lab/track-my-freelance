export interface Invoice {
  id: string;
  user_id: string;
  client_id: string;
  project_ids: string[];
  currency: string;
  total_minor: number;
  status: 'draft' | 'sent' | 'paid';
  issue_date: string;
  due_date: string | null;
  number: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  project_id: string | null;
  minutes: number;
  rate_minor: number;
  amount_minor: number;
  description: string | null;
}

export interface InvoiceLineItem {
  project_id: string;
  project_name: string;
  minutes: number;
  rate_minor: number;
  amount_minor: number;
  description?: string;
}

export interface InvoiceWithDetails extends Invoice {
  client_name: string;
  line_items: InvoiceLineItem[];
}