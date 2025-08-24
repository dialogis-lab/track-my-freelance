import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { DollarSign } from 'lucide-react';
import { Currency, CURRENCIES, formatMoney, toMinor } from '@/lib/currencyUtils';

export function SettingsCurrency() {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('USD');
  const { toast } = useToast();

  useEffect(() => {
    loadCurrency();
  }, []);

  const loadCurrency = () => {
    const stored = localStorage.getItem('timehatch-currency');
    if (stored && CURRENCIES.includes(stored as Currency)) {
      setSelectedCurrency(stored as Currency);
    }
  };

  const saveCurrency = (currency: Currency) => {
    setSelectedCurrency(currency);
    localStorage.setItem('timehatch-currency', currency);
    toast({
      title: "Currency updated",
      description: `Currency has been changed to ${currency}`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <DollarSign className="w-5 h-5" />
          <CardTitle>Currency Settings</CardTitle>
        </div>
        <CardDescription>
          Choose your preferred currency for reports and invoicing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Preferred Currency</Label>
          <Select
            value={selectedCurrency}
            onValueChange={(value: Currency) => saveCurrency(value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency} - {formatMoney(toMinor(100, currency), currency)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm text-muted-foreground">
            <DollarSign className="w-4 h-4 inline mr-2" />
            Example: {formatMoney(toMinor(85.50, selectedCurrency), selectedCurrency)} for 1.5 hours at {formatMoney(toMinor(57, selectedCurrency), selectedCurrency)}/hour
          </p>
        </div>
      </CardContent>
    </Card>
  );
}