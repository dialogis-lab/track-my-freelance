import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Edit, Trash2, Paperclip, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listProjectExpenses, deleteExpense, getReceiptUrl, formatCurrency, type Expense } from "@/lib/expenses";
import { type Currency } from "@/lib/currencyUtils";
import { ExpenseForm } from "./ExpenseForm";

interface ExpensesListProps {
  projectId: string;
  clientId?: string;
}

export function ExpensesList({ projectId, clientId }: ExpensesListProps) {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadExpenses = async () => {
    try {
      const { data, error } = await listProjectExpenses(projectId);
      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load expenses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('expenses-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses',
          filter: `project_id=eq.${projectId}`
        },
        () => {
          loadExpenses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteExpense(id);
      toast({
        title: "Expense deleted",
        description: "The expense has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete expense",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const handleReceiptView = async (receiptUrl: string) => {
    try {
      const signedUrl = await getReceiptUrl(receiptUrl);
      window.open(signedUrl, '_blank');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load receipt",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getTotalAmount = () => {
    const totals = expenses.reduce((acc, expense) => {
      const currency = expense.currency as Currency;
      if (!acc[currency]) acc[currency] = 0;
      acc[currency] += expense.gross_amount_cents;
      return acc;
    }, {} as Record<Currency, number>);

    return Object.entries(totals).map(([currency, amount]) => 
      formatCurrency(amount, currency as Currency)
    ).join(', ');
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8">Loading expenses...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Project Expenses</h3>
          {expenses.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Total: {getTotalAmount()}
            </p>
          )}
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </Button>
      </div>

      {expenses.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No expenses recorded for this project yet.
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vendor/Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit</TableHead>
                <TableHead className="text-right">VAT</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{formatDate(expense.spent_on)}</TableCell>
                  <TableCell>
                    <div>
                      {expense.vendor && <div className="font-medium">{expense.vendor}</div>}
                      {expense.category && <div className="text-sm text-muted-foreground">{expense.category}</div>}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {expense.description || '-'}
                  </TableCell>
                  <TableCell className="text-right">{expense.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(expense.unit_amount_cents, expense.currency as Currency)}
                  </TableCell>
                  <TableCell className="text-right">{expense.vat_rate}%</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(expense.gross_amount_cents, expense.currency as Currency)}
                  </TableCell>
                  <TableCell>{expense.currency}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {expense.billable && (
                        <Badge variant="default" className="text-xs">Billable</Badge>
                      )}
                      {expense.reimbursable && (
                        <Badge variant="secondary" className="text-xs">Reimbursable</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {expense.receipt_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReceiptView(expense.receipt_url!)}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(expense)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(expense.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ExpenseForm
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditingExpense(undefined);
        }}
        projectId={projectId}
        clientId={clientId}
        expense={editingExpense}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}