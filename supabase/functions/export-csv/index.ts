import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExportRequest {
  startDate: string;
  endDate: string;
  clientId?: string;
  projectId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const { startDate, endDate, clientId, projectId }: ExportRequest = await req.json();

    // Build query
    let query = supabase
      .from('time_entries')
      .select(`
        id, started_at, stopped_at, notes,
        projects:project_id (
          name, rate_hour,
          clients:client_id (name)
        )
      `)
      .eq('user_id', user.id)
      .gte('started_at', `${startDate}T00:00:00.000Z`)
      .lte('started_at', `${endDate}T23:59:59.999Z`)
      .not('stopped_at', 'is', null)
      .order('started_at', { ascending: false });

    if (clientId) {
      query = query.eq('projects.client_id', clientId);
    }
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: entries, error } = await query;

    if (error) {
      throw error;
    }

    // Generate CSV
    const headers = [
      'Date', 
      'Project', 
      'Client', 
      'Start Time', 
      'End Time', 
      'Duration (Hours)', 
      'Rate', 
      'Value', 
      'Notes'
    ];

    const rows = entries?.map(entry => {
      const start = new Date(entry.started_at);
      const end = new Date(entry.stopped_at!);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const rate = entry.projects?.rate_hour || 0;
      const value = hours * rate;

      return [
        start.toLocaleDateString(),
        entry.projects?.name || '',
        entry.projects?.clients?.name || 'No Client',
        start.toLocaleTimeString(),
        end.toLocaleTimeString(),
        hours.toFixed(2),
        rate.toFixed(2),
        value.toFixed(2),
        entry.notes || '',
      ];
    }) || [];

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="time-report-${startDate}-to-${endDate}.csv"`,
        ...corsHeaders,
      },
    });

  } catch (error) {
    console.error('Error in export-csv function:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);