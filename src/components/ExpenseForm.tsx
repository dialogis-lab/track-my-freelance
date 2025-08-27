import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, Paperclip, X } from "lucide-react";
import { upsertExpense, uploadReceipt, type Expense, type ExpenseFormData } from "@/lib/expenses";
import { CURRENCIES, type Currency } from "@/lib/currencyUtils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  clientId?: string;
  expense?: Expense;
}

export function ExpenseForm({ open, onOpenChange, projectId, clientId, expense }: ExpenseFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewAmounts, setPreviewAmounts] = useState({ net: 0, vat: 0, gross: 0 });

  const [formData, setFormData] = useState<ExpenseFormData>({
    project_id: projectId,
    client_id: clientId,
    spent_on: new Date().toISOString().split('T')[0],
    vendor: '',
    category: '',
    description: '',
    quantity: 1,
    unit_amount_cents: 0,
    currency: 'CHF' as Currency,
    vat_rate: 7.7,
    billable: true,
    reimbursable: false,
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        id: expense.id,
        project_id: expense.project_id,
        client_id: expense.client_id || undefined,
        spent_on: expense.spent_on,
        vendor: expense.vendor || '',
        category: expense.category || '',
        description: expense.description || '',
        quantity: expense.quantity,
        unit_amount_cents: expense.unit_amount_cents,
        currency: expense.currency as Currency,
        vat_rate: expense.vat_rate,
        billable: expense.billable,
        reimbursable: expense.reimbursable,
        receipt_url: expense.receipt_url || undefined,
      });
    } else {
      setFormData(prev => ({
        ...prev,
        project_id: projectId,
        client_id: clientId,
      }));
    }
  }, [expense, projectId, clientId]);

  // Calculate preview amounts when relevant fields change
  useEffect(() => {
    const net = Math.round(formData.quantity * formData.unit_amount_cents);
    const vat = Math.round(net * (formData.vat_rate / 100));
    const gross = net + vat;
    setPreviewAmounts({ net, vat, gross });
  }, [formData.quantity, formData.unit_amount_cents, formData.vat_rate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      let receiptUrl = formData.receipt_url;

      // Upload receipt if new file selected
      if (receiptFile) {
        receiptUrl = await uploadReceipt(receiptFile, formData.id || 'temp', user.id);
      }

      await upsertExpense({
        ...formData,
        receipt_url: receiptUrl,
      });

      toast({
        title: expense ? "Expense updated" : "Expense created",
        description: "The expense has been saved successfully.",
      });

      // Update onboarding state for new expenses
      if (!expense) {
        try {
          await supabase.functions.invoke('onboarding-state', {
            body: { updates: { expense_added: true } }
          });
        } catch (error) {
          console.error('Error updating onboarding state:', error);
        }
      }

      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save expense. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      project_id: projectId,
      client_id: clientId,
      spent_on: new Date().toISOString().split('T')[0],
      vendor: '',
      category: '',
      description: '',
      quantity: 1,
      unit_amount_cents: 0,
      currency: 'CHF' as Currency,
      vat_rate: 7.7,
      billable: true,
      reimbursable: false,
    });
    setReceiptFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (allowedTypes.includes(file.type)) {
        setReceiptFile(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF, JPG, or PNG file.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="spent_on">Date</Label>
              <Input
                id="spent_on"
                type="date"
                value={formData.spent_on}
                onChange={(e) => setFormData(prev => ({ ...prev, spent_on: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select 
                value={formData.currency} 
                onValueChange={(value: Currency) => setFormData(prev => ({ ...prev, currency: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(currency => (
                    <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="vendor">Vendor</Label>
              <Input
                id="vendor"
                value={formData.vendor}
                onChange={(e) => setFormData(prev => ({ ...prev, vendor: e.target.value }))}
                placeholder="e.g., Office Supplies Co."
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="e.g., Travel, Equipment"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the expense..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                step="0.001"
                min="0.001"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="unit_amount">Unit Amount ({formData.currency})</Label>
              <Input
                id="unit_amount"
                type="number" 
                step="0.01"
                min="0"
                value={formData.unit_amount_cents / 100}
                onChange={(e) => setFormData(prev => ({ ...prev, unit_amount_cents: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="vat_rate">VAT Rate (%)</Label>
              <Input
                id="vat_rate"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.vat_rate}
                onChange={(e) => setFormData(prev => ({ ...prev, vat_rate: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          {/* Amount Preview */}
          <div className="bg-muted p-3 rounded-lg text-sm">
            <div className="flex justify-between">
              <span>Net:</span>
              <span>{(previewAmounts.net / 100).toFixed(2)} {formData.currency}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT ({formData.vat_rate}%):</span>
              <span>{(previewAmounts.vat / 100).toFixed(2)} {formData.currency}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-1">
              <span>Gross:</span>
              <span>{(previewAmounts.gross / 100).toFixed(2)} {formData.currency}</span>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="billable"
                checked={formData.billable}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, billable: checked }))}
              />
              <Label htmlFor="billable">Billable</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="reimbursable"
                checked={formData.reimbursable}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, reimbursable: checked }))}
              />
              <Label htmlFor="reimbursable">Reimbursable</Label>
            </div>
          </div>

          {/* Receipt Upload */}
          <div>
            <Label>Receipt</Label>
            <div className="mt-2">
              {(receiptFile || formData.receipt_url) && (
                <div className="flex items-center space-x-2 mb-2 p-2 bg-muted rounded">
                  <Paperclip className="h-4 w-4" />
                  <span className="text-sm flex-1">
                    {receiptFile ? receiptFile.name : 'Receipt attached'}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReceiptFile(null);
                      setFormData(prev => ({ ...prev, receipt_url: undefined }));
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="hidden"
                  id="receipt-upload"
                />
                <label
                  htmlFor="receipt-upload"
                  className="flex flex-col items-center cursor-pointer"
                >
                  <Upload className="h-6 w-6 mb-2 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Upload receipt (PDF, JPG, PNG)
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : expense ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}