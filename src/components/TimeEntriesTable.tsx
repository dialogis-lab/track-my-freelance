import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { fetchTimeEntries } from "@/api/reports/time-entries";
import { exportTimeEntriesCSV } from "@/api/reports/time-entries/export";
import { useToast } from "@/hooks/use-toast";

interface TimeEntry {
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

interface TimeEntriesTableProps {
  startDate: string;
  endDate: string;
  clientFilter: string;
  projectFilter: string;
  tagFilter: string;
  searchFilter: string;
}

const formatDuration = (durationMs: number) => {
  const minutes = Math.floor(durationMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return {
    normal: `${hours}h ${mins}m`,
    industrial: (minutes / 60).toFixed(2)
  };
};

export const TimeEntriesTable: React.FC<TimeEntriesTableProps> = ({
  startDate,
  endDate,
  clientFilter,
  projectFilter,
  tagFilter,
  searchFilter
}) => {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo>({
    hasNextPage: false,
    hasPrevPage: false
  });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(undefined);
  const { toast } = useToast();

  const loadEntries = async (cursor?: string, resetCursor = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const params = {
        from: `${startDate}T00:00:00.000Z`,
        to: `${endDate}T23:59:59.999Z`,
        clientId: clientFilter === 'all' ? undefined : clientFilter,
        projectId: projectFilter === 'all' ? undefined : projectFilter,
        tag: tagFilter === 'all' ? undefined : tagFilter,
        search: searchFilter || undefined,
        sort: 'started_at_desc' as const,
        pageSize,
        cursor: resetCursor ? undefined : cursor
      };

      const result = await fetchTimeEntries(params);
      setEntries(result.rows);
      setPageInfo(result.pageInfo);
      
      if (resetCursor) {
        setCurrentCursor(undefined);
      } else {
        setCurrentCursor(cursor);
      }
    } catch (error) {
      console.error('Error loading time entries:', error);
      toast({
        title: "Error",
        description: "Failed to load time entries. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Load entries when filters or page size change
  useEffect(() => {
    loadEntries(undefined, true);
  }, [startDate, endDate, clientFilter, projectFilter, tagFilter, searchFilter, pageSize]);

  const handleNextPage = () => {
    if (pageInfo.nextCursor) {
      loadEntries(pageInfo.nextCursor);
    }
  };

  const handlePrevPage = () => {
    // For prev page, we need to implement reverse pagination
    // For now, just reset to first page when going back
    loadEntries(undefined, true);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {
        from: `${startDate}T00:00:00.000Z`,
        to: `${endDate}T23:59:59.999Z`,
        clientId: clientFilter === 'all' ? undefined : clientFilter,
        projectId: projectFilter === 'all' ? undefined : projectFilter,
        tag: tagFilter === 'all' ? undefined : tagFilter,
        search: searchFilter || undefined
      };

      const csvContent = await exportTimeEntriesCSV(params);
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `time-entries-${startDate}-to-${endDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export completed",
        description: `CSV file has been downloaded${pageInfo.totalCount ? ` with ${pageInfo.totalCount} entries` : ''}.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "Failed to export time entries. Please try again.",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  const startIndex = 1; // We don't track exact start index with keyset pagination
  const endIndex = entries.length;
  const displayTotal = pageInfo.totalCount ? ` of ${pageInfo.totalCount}` : '';

  return (
    <div className="rounded-xl border bg-card shadow-sm p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Time Entries</h3>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleExport}
            disabled={exporting || entries.length === 0}
            variant="outline"
            size="sm"
            className="h-9 px-3"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-[calc(56px+1px)] bg-card z-10">
            <tr className="border-b">
              <th className="text-left p-3 font-semibold">Date</th>
              <th className="text-left p-3 font-semibold">Project</th>
              <th className="text-left p-3 font-semibold">Client</th>
              <th className="text-right p-3 font-semibold">Duration</th>
              <th className="text-right p-3 font-semibold">Rate</th>
              <th className="text-right p-3 font-semibold">Value</th>
              <th className="text-left p-3 font-semibold">Tags</th>
              <th className="text-left p-3 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Loading entries...
                  </div>
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  No time entries found for the selected criteria
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const duration = formatDuration(entry.durationMs);
                return (
                  <tr key={entry.id} className="border-b min-h-[44px] hover:bg-muted/40 transition-colors">
                    <td className="p-3">{new Date(entry.date).toLocaleDateString()}</td>
                    <td className="p-3 font-medium">{entry.project.name}</td>
                    <td className="p-3 text-muted-foreground">{entry.client.name}</td>
                    <td className="p-3 text-right">
                      <div className="font-mono">
                        <div className="font-bold">{duration.normal}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          = {duration.industrial}h
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {entry.rate ? `$${entry.rate.toFixed(2)}/h` : '-'}
                    </td>
                    <td className="p-3 text-right tabular-nums font-semibold">
                      ${entry.value.toFixed(2)}
                    </td>
                    <td className="p-3">
                      {entry.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {entry.tags.map((tag, index) => (
                            <span key={index} className="bg-primary/10 text-primary px-2 py-1 rounded text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 max-w-xs truncate" title={entry.notes || undefined}>
                      {entry.notes || <span className="text-muted-foreground">-</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger className="h-9 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {entries.length > 0 ? (
              `${startIndex}–${endIndex}${displayTotal}`
            ) : (
              '0 entries'
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrevPage}
            disabled={!pageInfo.hasPrevPage || loading}
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleNextPage}
            disabled={!pageInfo.hasNextPage || loading}
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};