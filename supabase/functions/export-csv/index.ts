import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Import time utility functions
const formatTime = (minutes: number, showDecimal?: boolean): string => {
  if (minutes === 0) {
    return showDecimal ? "0m (0.00h)" : "0m";
  }

  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  
  let timeString = "";
  
  if (hours > 0) {
    timeString += `${hours}h`;
    if (remainingMinutes > 0) {
      timeString += ` ${remainingMinutes}m`;
    }
  } else {
    timeString = `${remainingMinutes}m`;
  }
  
  if (showDecimal) {
    const decimalHours = (totalMinutes / 60).toFixed(2);
    timeString += ` (${decimalHours}h)`;
  }
  
  return timeString;
};

const calculateDurationMinutes = (startDate: Date, endDate?: Date): number => {
  const end = endDate || new Date();
  const diffMs = end.getTime() - startDate.getTime();
  return Math.round(diffMs / (1000 * 60));
};

// Add formatDuration function for dual time format display
const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const normal = h > 0 ? `${h}h ${m}m` : `${m}m`;
  const industrial = (minutes / 60).toFixed(2); // e.g. 1.75
  return { normal, industrial };
};

const formatTimeForCSV = (minutes: number): { duration_hm: string; duration_decimal: string } => {
  const duration = formatDuration(minutes);
  return {
    duration_hm: duration.normal,
    duration_decimal: `${duration.industrial}h`
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TimeEntry {
  id: string;
  started_at: string;
  stopped_at: string | null;
  notes: string | null;
  projects: {
    name: string;
    clients?: {
      name: string;
    } | null;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get user from auth header
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Parse query parameters
    const url = new URL(req.url);
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');

    if (!fromDate || !toDate) {
      throw new Error('from and to date parameters are required');
    }

    console.log(`Generating CSV export for user ${user.id} from ${fromDate} to ${toDate}`);

    // Fetch time entries for the date range
    const { data: entries, error } = await supabase
      .from('time_entries')
      .select(`
        id,
        started_at,
        stopped_at,
        notes,
        projects:project_id (
          name,
          clients:client_id (name)
        )
      `)
      .eq('user_id', user.id)
      .gte('started_at', fromDate)
      .lte('started_at', toDate)
      .order('started_at', { ascending: true });

    if (error) {
      throw error;
    }

    // Generate CSV content with dual time format
    const csvRows = ['Date,Client,Project,Start Time,End Time,Duration (H:M),Duration (Decimal Hours),Notes'];
    
    entries?.forEach((entry: TimeEntry) => {
      const startDate = new Date(entry.started_at);
      const endDate = entry.stopped_at ? new Date(entry.stopped_at) : null;
      
      const date = startDate.toLocaleDateString();
      const client = entry.projects?.clients?.name || 'No Client';
      const project = entry.projects?.name || 'Unknown Project';
      const startTime = startDate.toLocaleTimeString();
      const endTime = endDate ? endDate.toLocaleTimeString() : 'Running';
      
      const minutes = endDate ? calculateDurationMinutes(startDate, endDate) : 0;
      const timeFormat = formatTimeForCSV(minutes);
      const notes = entry.notes || '';

      // Escape CSV values
      const escapeCsv = (value: string) => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      csvRows.push([
        escapeCsv(date),
        escapeCsv(client),
        escapeCsv(project),
        escapeCsv(startTime),
        escapeCsv(endTime),
        timeFormat.duration_hm,
        timeFormat.duration_decimal,
        escapeCsv(notes)
      ].join(','));
    });

    const csvContent = csvRows.join('\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="time-entries-${fromDate}-${toDate}.csv"`,
      },
    });

  } catch (error: any) {
    console.error('Error in export-csv function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);