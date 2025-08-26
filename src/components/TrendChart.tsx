import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Download } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDuration } from '@/lib/timeUtils';
import fetchTrendData, { TrendResponse } from '@/api/reports/trend';
import { useToast } from '@/hooks/use-toast';

interface TrendChartProps {
  startDate: string;
  endDate: string;
  clientFilter: string;
  projectFilter: string;
  tagFilter: string;
}

type MetricType = 'hours' | 'value';
type BucketType = 'day' | 'week' | 'month';

export function TrendChart({ startDate, endDate, clientFilter, projectFilter, tagFilter }: TrendChartProps) {
  const [data, setData] = useState<TrendResponse | null>(null);
  const [metric, setMetric] = useState<MetricType>('hours');
  const [bucket, setBucket] = useState<BucketType>('week');
  const [cumulative, setCumulative] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTrendData();
  }, [startDate, endDate, clientFilter, projectFilter, tagFilter, metric, bucket]);

  const loadTrendData = async () => {
    setLoading(true);
    try {
      const trendData = await fetchTrendData({
        from: `${startDate}T00:00:00.000Z`,
        to: `${endDate}T23:59:59.999Z`,
        clientId: clientFilter !== 'all' ? clientFilter : undefined,
        projectId: projectFilter !== 'all' ? projectFilter : undefined,
        bucket,
        metric,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      setData(trendData);
    } catch (error) {
      console.error('Error loading trend data:', error);
      toast({
        title: "Error loading trend data",
        description: "Failed to load trend chart data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: number, type: MetricType) => {
    if (type === 'hours') {
      return formatDuration(Math.round(value * 60)).normal;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatAxisValue = (value: number) => {
    if (metric === 'hours') {
      const hours = Math.floor(value);
      const minutes = Math.round((value - hours) * 60);
      return hours > 0 ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}` : `${minutes}m`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatTooltipValue = (value: number) => {
    if (metric === 'hours') {
      return formatDuration(Math.round(value * 60)).normal;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    switch (bucket) {
      case 'day':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'week':
        return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      case 'month':
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      default:
        return date.toLocaleDateString();
    }
  };

  const prepareChartData = () => {
    if (!data) return [];
    
    let chartData = data.series.map(point => ({
      bucket: point.bucket,
      date: formatDate(point.bucket),
      value: point[metric],
    }));

    // Apply cumulative transformation if enabled
    if (cumulative) {
      let runningTotal = 0;
      chartData = chartData.map(point => ({
        ...point,
        value: runningTotal += point.value,
      }));
    }

    return chartData;
  };

  const exportTrendCSV = () => {
    if (!data) return;

    const chartData = prepareChartData();
    const headers = ['Date', bucket.charAt(0).toUpperCase() + bucket.slice(1), metric === 'hours' ? 'Hours' : 'Value'];
    const rows = chartData.map(point => [
      point.date,
      point.bucket,
      metric === 'hours' ? formatDuration(Math.round(point.value * 60)).industrial : point.value.toFixed(2)
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trend-report-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Trend data exported",
      description: "CSV file has been downloaded successfully.",
    });
  };

  const chartData = prepareChartData();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Trend over time</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={exportTrendCSV}
            disabled={!data || loading}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Metric:</Label>
            <Select value={metric} onValueChange={(value: MetricType) => setMetric(value)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="value">Value</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm">Bucket:</Label>
            <Select value={bucket} onValueChange={(value: BucketType) => setBucket(value)}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="cumulative"
              checked={cumulative}
              onCheckedChange={setCumulative}
            />
            <Label htmlFor="cumulative" className="text-sm">
              Cumulative
            </Label>
          </div>
        </div>

        {/* Chart */}
        <div className="h-80">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-muted-foreground">Loading trend data...</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity={0.4} />
                    <stop offset="33%" stopColor="rgb(20 184 166)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="rgb(34 197 94)" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatAxisValue}
                  label={{ 
                    value: metric === 'hours' ? 'Hours' : 'Value', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' }
                  }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
                          <p className="font-medium">{label}</p>
                          <p className="text-sm text-muted-foreground">
                            {metric === 'hours' ? 'Hours' : 'Value'}: {formatTooltipValue(payload[0].value as number)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="rgb(59 130 246)"
                  strokeWidth={2}
                  fill="url(#trendAreaGradient)"
                  dot={{ fill: 'rgb(59 130 246)', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: 'rgb(59 130 246)', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Summary Stats */}
        {data && (
          <div className="flex items-center justify-center gap-8 mt-4 pt-4 border-t border-border">
            <div className="text-center">
              <div className="text-lg font-bold">{formatValue(data.totals[metric], metric)}</div>
              <div className="text-xs text-muted-foreground">Total {metric}</div>
            </div>
            {chartData.length > 0 && (
              <div className="text-center">
                <div className="text-lg font-bold">
                  {formatValue(chartData.reduce((sum, point) => sum + point.value, 0) / chartData.length, metric)}
                </div>
                <div className="text-xs text-muted-foreground">Average per {bucket}</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}