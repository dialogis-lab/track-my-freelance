import { supabase } from "@/integrations/supabase/client";

interface ExportParams {
  from: string;
  to: string;
  clientId?: string;
  projectId?: string;
  tag?: string;
  search?: string;
}

const formatTimeForCSV = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return {
    duration_hm: `${hours}:${mins.toString().padStart(2, '0')}`,
    duration_decimal: (minutes / 60).toFixed(2)
  };
};

export const exportTimeEntriesCSV = async (params: ExportParams): Promise<string> => {
  const { from, to, clientId, projectId, tag, search } = params;

  let query = supabase
    .from('time_entries')
    .select(`
      id,
      started_at,
      stopped_at,
      notes,
      tags,
      projects!inner(
        id,
        name,
        rate_hour,
        clients!inner(
          id,
          name
        )
      )
    `)
    .gte('started_at', from)
    .lt('started_at', to)
    .not('stopped_at', 'is', null)
    .order('started_at', { ascending: false });

  // Apply filters
  if (clientId) {
    query = query.eq('projects.client_id', clientId);
  }

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  if (tag) {
    query = query.contains('tags', [tag]);
  }

  if (search) {
    query = query.ilike('notes', `%${search}%`);
  }

  const { data: entries, error } = await query;

  if (error) {
    throw error;
  }

  const headers = [
    'Date',
    'Project', 
    'Client',
    'Start Time',
    'End Time', 
    'Duration (H:M)',
    'Duration (Decimal Hours)',
    'Rate',
    'Value',
    'Tags',
    'Notes'
  ];

  const rows = entries.map(entry => {
    const start = new Date(entry.started_at);
    const end = new Date(entry.stopped_at!);
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / (1000 * 60));
    const hours = minutes / 60;
    const rate = entry.projects.rate_hour || 0;
    const value = hours * rate;
    const timeFormat = formatTimeForCSV(minutes);

    return [
      start.toLocaleDateString(),
      entry.projects.name,
      entry.projects.clients.name,
      start.toLocaleTimeString(),
      end.toLocaleTimeString(),
      timeFormat.duration_hm,
      timeFormat.duration_decimal,
      rate.toFixed(2),
      value.toFixed(2),
      (entry.tags || []).join(', '),
      entry.notes || ''
    ];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  return csvContent;
};