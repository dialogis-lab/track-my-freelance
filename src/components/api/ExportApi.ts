import { supabase } from '@/integrations/supabase/client';

interface ExportParams {
  startDate: string;
  endDate: string;
  clientId?: string;
  projectId?: string;
}

export const exportToCSV = async (params: ExportParams): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('No active session');
  }

  const response = await supabase.functions.invoke('export-csv', {
    body: params,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  // Create download link
  const blob = new Blob([response.data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `time-report-${params.startDate}-to-${params.endDate}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};