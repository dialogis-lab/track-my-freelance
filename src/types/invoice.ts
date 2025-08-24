export interface Invoice {
  id: string;
  user_id: string;
  client_id: string;
  project_ids: string[];
  currency: string;
  total_minor: number;
  status: 'draft' | 'sent' | 'paid';
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  project_id: string;
  project_name: string;
  hours: number;
  rate_per_hour: number;
  total: number;
}

export interface InvoiceData extends Omit<Invoice, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  client_name: string;
  line_items: InvoiceLineItem[];
  invoice_number: string;
  date: string;
}