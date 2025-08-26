import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Eye, Download, Receipt, Filter, X, Calendar as CalendarIcon, DollarSign, ChevronDown, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatMoney, fromMinor } from '@/lib/currencyUtils';
import { format } from 'date-fns';
import type { Invoice } from '@/types/invoice';

interface InvoiceWithClient extends Invoice {
  client_name: string;
}

export default function Invoices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [allClients, setAllClients] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    if (user) {
      loadInvoices();
      loadAllClients();
    }
  }, [user]);

  const loadInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          clients!inner (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const invoicesWithClients: InvoiceWithClient[] = data?.map(invoice => ({
        ...invoice,
        status: invoice.status as 'draft' | 'sent' | 'paid',
        client_name: (invoice.clients as any).name,
      })) || [];

      setInvoices(invoicesWithClients);
    } catch (error: any) {
      toast({
        title: "Error loading invoices",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAllClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('archived', false)
        .order('name');

      if (error) {
        throw error;
      }

      setAllClients(data || []);
    } catch (error: any) {
      console.error('Error loading clients:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: 'secondary',
      sent: 'default',
      paid: 'default',
    } as const;

    const colors = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      paid: 'bg-green-100 text-green-700',
    };

    return (
      <Badge variant={variants[status as keyof typeof variants]} className={colors[status as keyof typeof colors]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (invoice.number && invoice.number.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    const matchesClient = clientFilter === 'all' || invoice.client_name === clientFilter;
    
    const invoiceDate = new Date(invoice.issue_date);
    const matchesDateFrom = !dateFrom || invoiceDate >= dateFrom;
    const matchesDateTo = !dateTo || invoiceDate <= dateTo;
    
    const invoiceAmount = fromMinor(invoice.total_minor, invoice.currency as any);
    const matchesMinAmount = !minAmount || invoiceAmount >= parseFloat(minAmount);
    const matchesMaxAmount = !maxAmount || invoiceAmount <= parseFloat(maxAmount);
    
    return matchesSearch && matchesStatus && matchesClient && matchesDateFrom && matchesDateTo && matchesMinAmount && matchesMaxAmount;
  });

  const deleteInvoice = async (invoice: InvoiceWithClient) => {
    try {
      // Check if invoice has any invoice items
      const { data: invoiceItems } = await supabase
        .from('invoice_items')
        .select('id')
        .eq('invoice_id', invoice.id);

      if (invoiceItems && invoiceItems.length > 0) {
        // Delete invoice items first
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', invoice.id);

        if (itemsError) {
          toast({
            title: "Error deleting invoice",
            description: itemsError.message,
            variant: "destructive",
          });
          return;
        }
      }

      // Delete the invoice
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);

      if (error) {
        toast({
          title: "Error deleting invoice",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Invoice deleted",
          description: "Invoice has been permanently deleted.",
        });
        loadInvoices();
      }
    } catch (error: any) {
      toast({
        title: "Error deleting invoice",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setClientFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setMinAmount('');
    setMaxAmount('');
  };

  const downloadPDF = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`https://ollbuhgghkporvzmrzau.supabase.co/functions/v1/generate-invoice-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ invoiceId }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      
      const { pdfBase64 } = await response.json();
      const blob = new Blob([Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0))], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      toast({
        title: "Error downloading PDF",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Invoices</h1>
            <p className="text-sm text-muted-foreground">Manage your invoices and billing</p>
          </div>
          
          <Button onClick={() => navigate('/invoices/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New Invoice
          </Button>
        </div>

        {/* Filters */}
        <div className="rounded-xl border bg-card shadow-sm p-4 sm:p-5">
          <div className="space-y-4">
            {/* Basic Filters */}
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search by client name or invoice number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48 h-9">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center gap-2 h-9"
              >
                <Filter className="w-4 h-4" />
                Advanced
                <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
              </Button>

              {(searchTerm || statusFilter !== 'all' || clientFilter !== 'all' || dateFrom || dateTo || minAmount || maxAmount) && (
                <Button variant="ghost" onClick={clearFilters} className="flex items-center gap-2 h-9">
                  <X className="w-4 h-4" />
                  Clear
                </Button>
              )}
            </div>

            {/* Advanced Filters */}
            <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
              <CollapsibleContent className="space-y-4 pt-4 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Client Filter */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Client</label>
                    <Select value={clientFilter} onValueChange={setClientFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All clients" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Clients</SelectItem>
                        {allClients.map(client => (
                          <SelectItem key={client.id} value={client.name}>{client.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date From */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Date From</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal h-9">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Date To */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Date To</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal h-9">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateTo ? format(dateTo, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateTo}
                          onSelect={setDateTo}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Amount Range */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Amount Range</label>
                    <div className="space-y-2">
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          placeholder="Min amount"
                          value={minAmount}
                          onChange={(e) => setMinAmount(e.target.value)}
                          type="number"
                          className="pl-10 h-9"
                        />
                      </div>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          placeholder="Max amount"
                          value={maxAmount}
                          onChange={(e) => setMaxAmount(e.target.value)}
                          type="number"
                          className="pl-10 h-9"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* Invoices List */}
        {filteredInvoices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No invoices found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? "No invoices match your search criteria."
                  : "Create your first invoice to get started."
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Button onClick={() => navigate('/invoices/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Invoice
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map((invoice) => (
              <Card key={invoice.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                      <div>
                        <p className="font-medium">{invoice.number || 'Draft'}</p>
                        <p className="text-sm text-muted-foreground">{invoice.client_name}</p>
                      </div>
                      
                      <div className="text-sm">
                        <p>Issue Date</p>
                        <p className="text-muted-foreground">
                          {new Date(invoice.issue_date).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div>
                        {getStatusBadge(invoice.status)}
                      </div>
                      
                      <div className="text-right">
                        <p className="font-medium">
                          {formatMoney(invoice.total_minor, invoice.currency as any)}
                        </p>
                      </div>
                      
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/invoices/${invoice.id}`);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        
                        {invoice.number && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadPDF(invoice.id, invoice.number!);
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to permanently delete invoice "{invoice.number || 'Draft'}" for {invoice.client_name}? 
                                This action cannot be undone and will also delete all associated invoice items.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteInvoice(invoice)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}