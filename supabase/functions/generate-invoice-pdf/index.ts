import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    
    let invoiceId;
    
    if (req.method === 'POST') {
      try {
        const text = await req.text();
        console.log('Raw request body:', text);
        
        if (text) {
          const body = JSON.parse(text);
          console.log('Parsed request body:', body);
          invoiceId = body.invoiceId;
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return new Response(JSON.stringify({ 
          error: 'Invalid JSON in request body',
          details: parseError.message
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    } else {
      // Handle GET requests with invoice ID in URL path
      const url = new URL(req.url);
      invoiceId = url.pathname.split('/').pop();
    }

    console.log('Invoice ID:', invoiceId);

    if (!invoiceId) {
      console.error('No invoice ID provided');
      return new Response(JSON.stringify({ error: 'Invoice ID required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(JSON.stringify({ error: 'Authorization required' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
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

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = page.getSize();

    // Load fonts
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let yPosition = height - 50;

    // Load logo if available
    let logoImage;
    if (profile?.logo_url) {
      try {
        const logoResponse = await fetch(profile.logo_url);
        const logoBytes = await logoResponse.arrayBuffer();
        const logoType = profile.logo_url.toLowerCase().includes('.png') ? 'png' : 'jpg';
        logoImage = logoType === 'png' 
          ? await pdfDoc.embedPng(logoBytes)
          : await pdfDoc.embedJpg(logoBytes);
      } catch (error) {
        console.log('Could not load logo:', error);
      }
    }

    // Header section
    if (logoImage) {
      const logoHeight = 40;
      const logoWidth = logoImage.width * (logoHeight / logoImage.height);
      page.drawImage(logoImage, {
        x: 50,
        y: yPosition - logoHeight,
        width: logoWidth,
        height: logoHeight,
      });
    }

    // Company info (left side)
    page.drawText(profile?.company_name || 'Your Company', {
      x: 50,
      y: yPosition - (logoImage ? 60 : 0),
      size: 16,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= logoImage ? 80 : 20;

    if (profile?.address) {
      const addressLines = profile.address.split('\n');
      for (const line of addressLines) {
        page.drawText(line, {
          x: 50,
          y: yPosition,
          size: 10,
          font: font,
          color: rgb(0, 0, 0),
        });
        yPosition -= 15;
      }
    }

    if (profile?.vat_id) {
      page.drawText(`VAT ID: ${profile.vat_id}`, {
        x: 50,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0, 0, 0),
      });
      yPosition -= 15;
    }

    // Invoice info (right side)
    yPosition = height - 50;
    page.drawText('INVOICE', {
      x: width - 200,
      y: yPosition,
      size: 24,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= 30;
    page.drawText(`Number: ${invoice.number || 'DRAFT'}`, {
      x: width - 200,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });

    yPosition -= 20;
    page.drawText(`Date: ${new Date(invoice.issue_date).toLocaleDateString()}`, {
      x: width - 200,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });

    if (invoice.due_date) {
      yPosition -= 20;
      page.drawText(`Due: ${new Date(invoice.due_date).toLocaleDateString()}`, {
        x: width - 200,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
    }

    // Client info
    yPosition = height - 200;
    page.drawText('Bill To:', {
      x: 50,
      y: yPosition,
      size: 14,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= 25;
    page.drawText((invoice.clients as any).name, {
      x: 50,
      y: yPosition,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    // Items table
    yPosition -= 60;
    const tableStartY = yPosition;
    const tableHeaders = ['Project', 'Hours', 'Rate', 'Amount'];
    const columnWidths = [200, 100, 100, 100];
    const columnPositions = [50, 250, 350, 450];

    // Table header
    page.drawRectangle({
      x: 50,
      y: yPosition - 20,
      width: 500,
      height: 25,
      color: rgb(0.95, 0.95, 0.95),
    });

    for (let i = 0; i < tableHeaders.length; i++) {
      page.drawText(tableHeaders[i], {
        x: columnPositions[i] + 5,
        y: yPosition - 15,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
    }

    yPosition -= 25;

    // Table rows
    for (const item of items || []) {
      const rowData = [
        (item.projects as any)?.name || 'Unknown Project',
        `${formatDuration(item.minutes).normal} (${formatDuration(item.minutes).industrial}h)`,
        formatMoney(item.rate_minor, invoice.currency),
        formatMoney(item.amount_minor, invoice.currency)
      ];

      for (let i = 0; i < rowData.length; i++) {
        page.drawText(rowData[i], {
          x: columnPositions[i] + 5,
          y: yPosition - 15,
          size: 10,
          font: font,
          color: rgb(0, 0, 0),
        });
      }

      // Row border
      page.drawLine({
        start: { x: 50, y: yPosition - 20 },
        end: { x: 550, y: yPosition - 20 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });

      yPosition -= 25;
    }

    // Total row
    page.drawRectangle({
      x: 50,
      y: yPosition - 20,
      width: 500,
      height: 25,
      color: rgb(0.9, 0.9, 0.9),
    });

    page.drawText('Total', {
      x: 355,
      y: yPosition - 15,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText(formatMoney(invoice.total_minor, invoice.currency), {
      x: 455,
      y: yPosition - 15,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    // Bank details
    if (profile?.bank_details) {
      yPosition -= 60;
      page.drawText('Payment Details:', {
        x: 50,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPosition -= 20;
      const bankLines = profile.bank_details.split('\n');
      for (const line of bankLines) {
        page.drawText(line, {
          x: 50,
          y: yPosition,
          size: 10,
          font: font,
          color: rgb(0, 0, 0),
        });
        yPosition -= 15;
      }
    }

    // Footer
    page.drawText(`Generated by TimeHatch • ${new Date().toLocaleDateString()}`, {
      x: width / 2 - 100,
      y: 50,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();
    
    // Convert to base64 for proper transmission via Functions API
    const base64PDF = btoa(String.fromCharCode(...pdfBytes));
    
    return new Response(JSON.stringify({ 
      pdf: base64PDF,
      filename: `invoice-${invoice.number || 'draft'}.pdf`
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return new Response(JSON.stringify({ 
      error: 'Error generating invoice', 
      message: error.message,
      stack: error.stack 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});