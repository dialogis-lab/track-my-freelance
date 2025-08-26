import { supabase } from "@/integrations/supabase/client";

interface TimeEntryRow {
  id: string;
  date: string;
  project: { id: string; name: string };
  client: { id: string; name: string };
  durationMs: number;
  rate: number | null;
  value: number;
  tags: string[];
  notes: string | null;
}

interface PageInfo {
  nextCursor?: string;
  prevCursor?: string | null;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  totalCount?: number;
}

interface TimeEntriesResponse {
  rows: TimeEntryRow[];
  pageInfo: PageInfo;
}

interface TimeEntriesParams {
  from: string;
  to: string;
  clientId?: string;
  projectId?: string;
  tag?: string;
  search?: string;
  sort?: 'started_at_desc' | 'started_at_asc';
  pageSize?: number;
  cursor?: string;
}

const encodeCursor = (startedAt: string, id: string): string => {
  return btoa(JSON.stringify({ startedAt, id }));
};

const decodeCursor = (cursor: string): { startedAt: string; id: string } => {
  try {
    return JSON.parse(atob(cursor));
  } catch {
    throw new Error('Invalid cursor');
  }
};

export const fetchTimeEntries = async (params: TimeEntriesParams): Promise<TimeEntriesResponse> => {
  const {
    from,
    to,
    clientId,
    projectId,
    tag,
    search,
    sort = 'started_at_desc',
    pageSize = 50,
    cursor
  } = params;

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
    .not('stopped_at', 'is', null);

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

  // Apply cursor pagination
  if (cursor) {
    const { startedAt, id } = decodeCursor(cursor);
    if (sort === 'started_at_desc') {
      query = query.or(`started_at.lt.${startedAt},and(started_at.eq.${startedAt},id.lt.${id})`);
    } else {
      query = query.or(`started_at.gt.${startedAt},and(started_at.eq.${startedAt},id.gt.${id})`);
    }
  }

  // Apply sorting and limit
  if (sort === 'started_at_desc') {
    query = query.order('started_at', { ascending: false }).order('id', { ascending: false });
  } else {
    query = query.order('started_at', { ascending: true }).order('id', { ascending: true });
  }

  query = query.limit(pageSize + 1);

  const { data: entries, error } = await query;

  if (error) {
    throw error;
  }

  const hasNextPage = entries.length > pageSize;
  const rows = hasNextPage ? entries.slice(0, -1) : entries;

  // Transform data
  const transformedRows: TimeEntryRow[] = rows.map(entry => {
    const startedAt = new Date(entry.started_at);
    const stoppedAt = new Date(entry.stopped_at!);
    const durationMs = stoppedAt.getTime() - startedAt.getTime();
    const hours = durationMs / (1000 * 60 * 60);
    const rate = entry.projects.rate_hour;
    const value = rate ? hours * rate : 0;

    return {
      id: entry.id,
      date: startedAt.toISOString().split('T')[0],
      project: {
        id: entry.projects.id,
        name: entry.projects.name
      },
      client: {
        id: entry.projects.clients.id,
        name: entry.projects.clients.name
      },
      durationMs,
      rate,
      value,
      tags: entry.tags || [],
      notes: entry.notes
    };
  });

  // Calculate cursors
  let nextCursor: string | undefined;
  let prevCursor: string | null = null;

  if (hasNextPage && transformedRows.length > 0) {
    const lastRow = transformedRows[transformedRows.length - 1];
    const lastEntry = rows[rows.length - 1];
    nextCursor = encodeCursor(lastEntry.started_at, lastEntry.id);
  }

  // Get total count (optional, for display purposes)
  let totalCount: number | undefined;
  try {
    let countQuery = supabase
      .from('time_entries')
      .select('*', { count: 'exact', head: true })
      .gte('started_at', from)
      .lt('started_at', to)
      .not('stopped_at', 'is', null);

    if (clientId) {
      countQuery = countQuery.eq('projects.client_id', clientId);
    }
    if (projectId) {
      countQuery = countQuery.eq('project_id', projectId);
    }
    if (tag) {
      countQuery = countQuery.contains('tags', [tag]);
    }
    if (search) {
      countQuery = countQuery.ilike('notes', `%${search}%`);
    }

    const { count } = await countQuery;
    totalCount = count || undefined;
  } catch {
    // Ignore count errors, just don't show total
  }

  return {
    rows: transformedRows,
    pageInfo: {
      nextCursor,
      prevCursor,
      hasNextPage,
      hasPrevPage: !!cursor,
      totalCount
    }
  };
};