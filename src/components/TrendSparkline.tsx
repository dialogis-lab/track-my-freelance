import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { formatDuration } from '@/lib/timeUtils';
import fetchTrendData, { TrendResponse } from '@/api/reports/trend';
import { useNavigate } from 'react-router-dom';

interface TrendSparklineProps {
  clientId: string;
  className?: string;
}

type MetricType = 'hours' | 'value';

export function TrendSparkline({ clientId, className }: TrendSparklineProps) {
  const [data, setData] = useState<TrendResponse | null>(null);
  const [metric, setMetric] = useState<MetricType>('hours');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadTrendData();
  }, [clientId, metric]);

  const loadTrendData = async () => {
    setLoading(true);
    try {
      // Get last 12 weeks
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - (12 * 7)); // 12 weeks back

      const trendData = await fetchTrendData({
        from: from.toISOString(),
        to: to.toISOString(),
        clientId,
        bucket: 'week',
        metric,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      setData(trendData);
    } catch (error) {
      console.error('Error loading trend data:', error);
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

  const calculateChangePercent = (): { percent: number; isPositive: boolean } => {
    if (!data?.prevTotals) return { percent: 0, isPositive: true };
    
    const current = data.totals[metric];
    const previous = data.prevTotals[metric];
    
    if (previous === 0) return { percent: 0, isPositive: true };
    
    const percent = ((current - previous) / previous) * 100;
    return { percent: Math.abs(percent), isPositive: percent >= 0 };
  };

  const handleViewInReports = () => {
    navigate(`/reports?client=${clientId}`);
  };

  if (loading) {
    return (
      <Card className={`animate-pulse ${className}`}>
        <CardHeader className="pb-3">
          <div className="h-4 bg-muted rounded w-24"></div>
        </CardHeader>
        <CardContent>
          <div className="h-16 bg-muted rounded mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-20"></div>
            <div className="h-3 bg-muted rounded w-16"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const changeData = calculateChangePercent();
  const chartData = data?.series.map(point => ({
    bucket: point.bucket,
    value: point[metric],
  })) || [];

  return (
    <Card className={`w-80 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Trend (last 12 weeks)
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={metric === 'hours' ? 'default' : 'outline'}
              size="sm"
              className="text-xs px-2 py-1 h-6"
              onClick={() => setMetric('hours')}
            >
              Hours
            </Button>
            <Button
              variant={metric === 'value' ? 'default' : 'outline'}
              size="sm"
              className="text-xs px-2 py-1 h-6"
              onClick={() => setMetric('value')}
            >
              Value
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Sparkline Chart */}
        <div className="h-16 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="rgb(20 184 166)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="rgb(34 197 94)" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="rgb(59 130 246)"
                strokeWidth={2}
                fill="url(#trendGradient)"
                dot={false}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* KPI Row */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold">
                {formatValue(data?.totals[metric] || 0, metric)}
              </div>
              <div className="text-xs text-muted-foreground">
                Total {metric}
              </div>
            </div>
            {data?.prevTotals && (
              <div className="flex items-center gap-1 text-sm">
                {changeData.isPositive ? (
                  <TrendingUp className="w-3 h-3 text-green-500" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-500" />
                )}
                <span className={changeData.isPositive ? 'text-green-500' : 'text-red-500'}>
                  {changeData.percent.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs h-7 text-muted-foreground hover:text-foreground"
            onClick={handleViewInReports}
          >
            <BarChart3 className="w-3 h-3 mr-1" />
            View in Reports
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}