import { supabase } from '@/integrations/supabase/client';

export interface TrendDataPoint {
  bucket: string; // ISO start of bucket
  hours: number;
  value: number;
}

export interface TrendResponse {
  series: TrendDataPoint[];
  totals: { hours: number; value: number };
  prevTotals?: { hours: number; value: number };
}

export interface TrendParams {
  from: string;
  to: string;
  clientId?: string;
  projectId?: string;
  bucket?: 'day' | 'week' | 'month';
  metric?: 'hours' | 'value';
  tz?: string;
  skipPrevTotals?: boolean;
}

// Simple in-memory cache with TTL
interface CacheEntry {
  data: TrendResponse;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 1000; // 60 seconds

function getCacheKey(params: TrendParams): string {
  // Create a clean params object to avoid serialization issues with undefined
  const cleanParams = {
    from: params.from,
    to: params.to,
    clientId: params.clientId || null,
    projectId: params.projectId || null,
    bucket: params.bucket,
    metric: params.metric,
    tz: params.tz,
  };
  return JSON.stringify(cleanParams);
}

function getFromCache(key: string): TrendResponse | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: TrendResponse): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export async function fetchTrendData(params: TrendParams): Promise<TrendResponse> {
  const cacheKey = getCacheKey(params);
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  const { from, to, clientId, projectId, bucket = 'week' } = params;
  
  try {
    console.log('Fetching trend data with params:', params);
    
    // Build the query using Supabase client
    let query = supabase
      .from('time_entries')
      .select(`
        started_at,
        stopped_at,
        projects:project_id (
          rate_hour,
          client_id
        )
      `)
      .gte('started_at', from)
      .lt('started_at', to)
      .not('stopped_at', 'is', null);

    // Apply filters
    if (projectId) {
      query = query.eq('project_id', projectId);
    } else if (clientId) {
      // Get projects for this client first
      const { data: clientProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('client_id', clientId);
      
      if (clientProjects && clientProjects.length > 0) {
        const projectIds = clientProjects.map(p => p.id);
        query = query.in('project_id', projectIds);
      } else {
        // No projects for this client, return empty data
        console.log('No projects found for client:', clientId);
        return {
          series: [],
          totals: { hours: 0, value: 0 },
        };
      }
    }

    const { data: timeEntries, error } = await query;

    if (error) {
      console.error('Trend query error:', error);
      throw new Error('Failed to fetch trend data');
    }

    console.log('Time entries found:', timeEntries?.length || 0);

    // Process the data client-side
    const bucketMap = new Map<string, { hours: number; value: number }>();
    let totalHours = 0;
    let totalValue = 0;

    (timeEntries || []).forEach((entry: any) => {
      if (!entry.stopped_at || !entry.started_at) return;

      const start = new Date(entry.started_at);
      const end = new Date(entry.stopped_at);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const rate = entry.projects?.rate_hour || 0;
      const value = hours * rate;

      // Get bucket start time
      const bucketStart = getBucketStart(start, bucket);
      const bucketKey = bucketStart.toISOString();

      const existing = bucketMap.get(bucketKey) || { hours: 0, value: 0 };
      bucketMap.set(bucketKey, {
        hours: existing.hours + hours,
        value: existing.value + value,
      });

      totalHours += hours;
      totalValue += value;
    });

    // Convert map to series array
    const series: TrendDataPoint[] = Array.from(bucketMap.entries()).map(([bucket, data]) => ({
      bucket,
      hours: data.hours,
      value: data.value,
    }));

    // Fill missing buckets with zeros
    const filledSeries = fillMissingBuckets(series, from, to, bucket, 'UTC');
    
    const result: TrendResponse = {
      series: filledSeries,
      totals: { hours: totalHours, value: totalValue },
    };

    // Calculate previous period totals for comparison (only for sparklines)
    if (params.from && params.to && !params.skipPrevTotals) {
      try {
        result.prevTotals = await calculatePrevTotals(params);
      } catch (error) {
        console.warn('Failed to calculate previous totals:', error);
      }
    }

    console.log('Trend data result:', result);
    setCache(cacheKey, result);
    return result;

  } catch (error) {
    console.error('Error fetching trend data:', error);
    // Return empty data structure on error
    return {
      series: [],
      totals: { hours: 0, value: 0 },
    };
  }
}

async function calculatePrevTotals(params: TrendParams): Promise<{ hours: number; value: number } | undefined> {
  const fromDate = new Date(params.from);
  const toDate = new Date(params.to);
  const duration = toDate.getTime() - fromDate.getTime();
  
  const prevFrom = new Date(fromDate.getTime() - duration);
  const prevTo = new Date(fromDate);
  
  const prevParams: TrendParams = {
    ...params,
    from: prevFrom.toISOString(),
    to: prevTo.toISOString(),
    skipPrevTotals: true, // Prevent infinite recursion
  };
  
  const prevData = await fetchTrendData(prevParams);
  return prevData.totals;
}

function fillMissingBuckets(
  series: TrendDataPoint[],
  from: string,
  to: string,
  bucket: 'day' | 'week' | 'month',
  tz: string
): TrendDataPoint[] {
  const result: TrendDataPoint[] = [];
  const existing = new Map(series.map(s => [s.bucket, s]));
  
  const start = new Date(from);
  const end = new Date(to);
  let current = new Date(start);
  
  while (current < end) {
    const bucketStart = getBucketStart(current, bucket);
    const bucketKey = bucketStart.toISOString();
    
    if (existing.has(bucketKey)) {
      result.push(existing.get(bucketKey)!);
    } else {
      result.push({
        bucket: bucketKey,
        hours: 0,
        value: 0,
      });
    }
    
    // Move to next bucket
    switch (bucket) {
      case 'day':
        current.setDate(current.getDate() + 1);
        break;
      case 'week':
        current.setDate(current.getDate() + 7);
        break;
      case 'month':
        current.setMonth(current.getMonth() + 1);
        break;
    }
  }
  
  return result;
}

function getBucketStart(date: Date, bucket: 'day' | 'week' | 'month'): Date {
  const result = new Date(date);
  
  switch (bucket) {
    case 'day':
      result.setHours(0, 0, 0, 0);
      break;
    case 'week':
      result.setDate(result.getDate() - result.getDay());
      result.setHours(0, 0, 0, 0);
      break;
    case 'month':
      result.setDate(1);
      result.setHours(0, 0, 0, 0);
      break;
  }
  
  return result;
}