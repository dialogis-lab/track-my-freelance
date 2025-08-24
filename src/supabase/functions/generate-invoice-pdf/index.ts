import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const invoiceId = url.pathname.split('/').pop();

    if (!invoiceId) {
      return new Response('Invoice ID required', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get invoice data
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        clients (name)
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError) {
      console.error('Invoice error:', invoiceError);
      return new Response('Invoice not found', { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    // Get profile data
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name, address, vat_id, bank_details, logo_url')
      .eq('id', invoice.user_id)
      .single();

    // Get invoice items
    const { data: items } = await supabase
      .from('invoice_items')
      .select(`
        *,
        projects (name)
      `)
      .eq('invoice_id', invoiceId);

    // Helper functions
    const formatMoney = (minor: number, currency: string) => {
      const major = minor / 100;
      return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency 
      }).format(major);
    };

    const formatDuration = (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      const normal = h > 0 ? `${h}h ${m}m` : `${m}m`;
      const industrial = (minutes / 60).toFixed(2);
      return { normal, industrial };
    };

    // Generate simple HTML for PDF conversion
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoice.number || 'DRAFT'}</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      margin: 0; 
      padding: 20px; 
      line-height: 1.4; 
      font-size: 14px;
    }
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start; 
      margin-bottom: 30px; 
      border-bottom: 2px solid #eee;
      padding-bottom: 20px;
    }
    .logo { max-height: 40px; margin-bottom: 10px; }
    .company-info { text-align: left; }
    .invoice-info { text-align: right; }
    .client-info { margin: 30px 0; padding: 15px; background-color: #f8f9fa; border-radius: 4px; }
    .items-table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 20px 0; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .items-table th, .items-table td { 
      border: 1px solid #ddd; 
      padding: 12px; 
      text-align: left; 
    }
    .items-table th { 
      background-color: #f5f5f5; 
      font-weight: bold;
    }
    .total-row { 
      font-weight: bold; 
      background-color: #e9ecef; 
      font-size: 16px;
    }
    .bank-details { 
      margin-top: 30px; 
      padding: 15px; 
      background-color: #f8f9fa; 
      border-radius: 4px;
      border-left: 4px solid #007bff;
    }
    h1, h2, h3 { margin: 0 0 10px 0; }
    p { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      ${profile?.logo_url ? `<img src="${profile.logo_url}" class="logo" alt="Company Logo">` : ''}
      <h2>${profile?.company_name || 'Your Company'}</h2>
      ${profile?.address ? `<p>${profile.address.replace(/\n/g, '<br>')}</p>` : ''}
      ${profile?.vat_id ? `<p><strong>VAT ID:</strong> ${profile.vat_id}</p>` : ''}
    </div>
    <div class="invoice-info">
      <h1>INVOICE</h1>
      <p><strong>Number:</strong> ${invoice.number || 'DRAFT'}</p>
      <p><strong>Date:</strong> ${new Date(invoice.issue_date).toLocaleDateString()}</p>
      ${invoice.due_date ? `<p><strong>Due:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>` : ''}
    </div>
  </div>

  <div class="client-info">
    <h3>Bill To:</h3>
    <p><strong>${(invoice.clients as any).name}</strong></p>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th>Project</th>
        <th>Hours</th>
        <th>Rate</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${(items || []).map((item: any) => `
        <tr>
          <td>${(item.projects as any)?.name || 'Unknown Project'}</td>
          <td>${formatDuration(item.minutes).normal} (${formatDuration(item.minutes).industrial}h)</td>
          <td>${formatMoney(item.rate_minor, invoice.currency)}</td>
          <td>${formatMoney(item.amount_minor, invoice.currency)}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="3"><strong>Total</strong></td>
        <td><strong>${formatMoney(invoice.total_minor, invoice.currency)}</strong></td>
      </tr>
    </tbody>
  </table>

  ${profile?.bank_details ? `
    <div class="bank-details">
      <h4>Payment Details:</h4>
      <p>${profile.bank_details.replace(/\n/g, '<br>')}</p>
    </div>
  ` : ''}

  <div style="margin-top: 40px; text-align: center; color: #666; font-size: 12px;">
    <p>Generated by TimeHatch • ${new Date().toLocaleDateString()}</p>
  </div>
</body>
</html>
    `;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
    });

  } catch (error) {
    console.error('Error generating invoice HTML:', error);
    return new Response(`Error generating invoice: ${error.message}`, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});