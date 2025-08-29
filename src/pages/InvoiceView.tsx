import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Send, CheckCircle, FileText } from 'lucide-react';
import { formatMoney } from '@/lib/currencyUtils';
import { formatDuration } from '@/lib/timeUtils';
import type { Invoice, InvoiceItem } from '@/types/invoice';

interface InvoiceWithDetails extends Invoice {
  client_name: string;
  company_name?: string;
  company_address?: string;
  logo_url?: string;
  invoice_items: (InvoiceItem & { project_name: string })[];
}

export default function InvoiceView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<InvoiceWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      loadInvoice();
    }
  }, [user, id]);

  const loadInvoice = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          clients!inner (name)
        `)
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      // Use safe profile access for basic company data
      const { data: profileData } = await supabase
        .rpc('get_profiles_safe');

      // Get invoice items separately
      const { data: itemsData } = await supabase
        .from('invoice_items')
        .select(`
          *,
          projects (name)
        `)
        .eq('invoice_id', id);

      const invoiceWithDetails: InvoiceWithDetails = {
        ...data,
        status: data.status as 'draft' | 'sent' | 'paid',
        client_name: (data.clients as any).name,
        company_name: profileData && profileData.length > 0 ? profileData[0].company_name : undefined,
        company_address: '', // Don't expose address without proper security
        logo_url: profileData && profileData.length > 0 ? profileData[0].logo_url : undefined,
        invoice_items: (itemsData || []).map((item: any) => ({
          ...item,
          project_name: item.projects?.name || 'Unknown Project',
        })),
      };

      setInvoice(invoiceWithDetails);
    } catch (error: any) {
      toast({
        title: "Error loading invoice",
        description: error.message,
        variant: "destructive",
      });
      navigate('/invoices');
    } finally {
      setLoading(false);
    }
  };

  const updateInvoiceStatus = async (status: 'sent' | 'paid') => {
    if (!invoice) return;

    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status })
        .eq('id', invoice.id);

      if (error) {
        throw error;
      }

      setInvoice({ ...invoice, status });
      toast({
        title: "Invoice updated",
        description: `Invoice marked as ${status}.`,
      });
    } catch (error: any) {
      toast({
        title: "Error updating invoice",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const generateInvoiceNumber = async () => {
    if (!invoice || invoice.number) return;

    try {
      const { data, error } = await supabase.rpc('generate_invoice_number');

      if (error) {
        toast({
          title: "Error generating invoice number",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      const { error: updateError } = await supabase
        .from('invoices')
        .update({ number: data })
        .eq('id', invoice.id);

      if (updateError) {
        toast({
          title: "Error updating invoice",
          description: updateError.message,
          variant: "destructive",
        });
        return;
      }

      setInvoice({ ...invoice, number: data });
      toast({
        title: "Invoice number generated",
        description: `Invoice number: ${data}`,
      });
    } catch (error: any) {
      toast({
        title: "Error generating invoice number",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const downloadPDF = async () => {
    if (!invoice) {
      toast({
        title: "Cannot download PDF",
        description: "Invoice not found.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await supabase.functions.invoke('generate-invoice-pdf', {
        body: { invoiceId: invoice.id }
      });

      console.log('PDF Response:', response);

      if (response.error) {
        console.error('PDF generation error:', response.error);
        throw new Error(response.error.message || 'Failed to generate PDF');
      }

      if (!response.data?.pdf) {
        throw new Error('No PDF data received from server');
      }

      // Decode base64 PDF data properly  
      const base64PDF = response.data.pdf;
      const filename = response.data.filename || `invoice-${invoice.number || 'draft'}.pdf`;
      
      // Decode the complete base64 string at once
      let binaryString = '';
      try {
        binaryString = atob(base64PDF);
      } catch (error) {
        console.error('Base64 decode error:', error);
        throw new Error('Failed to decode PDF data');
      }
      
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Create blob
      const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
      
      console.log('Blob size:', pdfBlob.size);
      
      if (pdfBlob.size === 0) {
        throw new Error('Generated PDF is empty');
      }

      // Download the file
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "PDF downloaded",
        description: "Invoice PDF has been downloaded successfully.",
      });
    } catch (error: any) {
      console.error('PDF download error:', error);
      toast({
        title: "Error downloading PDF",
        description: error.message || "Could not generate PDF",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      paid: 'bg-green-100 text-green-700',
    };

    return (
      <Badge className={colors[status as keyof typeof colors]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!invoice) {
    return (
      <AppLayout>
        <div className="p-6">
          <p>Invoice not found</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Invoices
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-foreground">
                  {invoice.number || 'Draft Invoice'}
                </h1>
                {getStatusBadge(invoice.status)}
              </div>
              <p className="text-muted-foreground">Invoice for {invoice.client_name}</p>
            </div>
          </div>
          
          <div className="flex space-x-2">            
            <Button variant="outline" onClick={downloadPDF}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            
            {invoice.status === 'draft' && (
              <Button onClick={() => updateInvoiceStatus('sent')}>
                <Send className="w-4 h-4 mr-2" />
                Mark as Sent
              </Button>
            )}
            
            {invoice.status === 'sent' && (
              <Button onClick={() => updateInvoiceStatus('paid')}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark as Paid
              </Button>
            )}
          </div>
        </div>

        {/* Invoice Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Invoice Info */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">Invoice Number</p>
                <p className="text-muted-foreground">{invoice.number || 'Not generated'}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Issue Date</p>
                <p className="text-muted-foreground">
                  {new Date(invoice.issue_date).toLocaleDateString()}
                </p>
              </div>
              {invoice.due_date && (
                <div>
                  <p className="text-sm font-medium">Due Date</p>
                  <p className="text-muted-foreground">
                    {new Date(invoice.due_date).toLocaleDateString()}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium">Currency</p>
                <p className="text-muted-foreground">{invoice.currency}</p>
              </div>
            </CardContent>
          </Card>

          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle>Bill To</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{invoice.client_name}</p>
            </CardContent>
          </Card>

          {/* Company Info */}
          <Card>
            <CardHeader>
              <CardTitle>From</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {invoice.logo_url && (
                <img
                  src={invoice.logo_url}
                  alt="Company logo"
                  className="w-16 h-10 object-contain"
                />
              )}
              <p className="font-medium">{invoice.company_name || 'Your Company'}</p>
              {invoice.company_address && (
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {invoice.company_address}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {invoice.invoice_items.map((item) => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <div>
                    <div className="font-medium">{item.project_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDuration(item.minutes).normal}
                      <span className="ml-1">= {formatDuration(item.minutes).industrial}h</span>
                      {item.rate_minor > 0 && (
                        <span className="ml-2">
                          @ {formatMoney(item.rate_minor, invoice.currency as any)}/hour
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">
                      {formatMoney(item.amount_minor, invoice.currency as any)}
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="border-t pt-4 flex justify-between items-center text-lg font-bold">
                <span>Total</span>
                <span>{formatMoney(invoice.total_minor, invoice.currency as any)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}