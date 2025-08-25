import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTimerSkin } from '@/hooks/useTimerSkin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  client_id: string | null;
  clients?: { name: string } | null;
}

interface ActiveEntry {
  id: string;
  project_id: string;
  started_at: string;
  notes: string;
  projects?: Project | null;
}

export default function StandardFocus() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { timerSkin } = useTimerSkin();
  
  const [activeEntry, setActiveEntry] = useState<ActiveEntry | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Load active entry
  useEffect(() => {
    if (user) {
      loadActiveEntry();
    }
  }, [user]);

  // Real-time subscription for timer updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('standard-focus-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Standard focus update received:', payload);
          // Reload active entry when any timer change occurs
          loadActiveEntry();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (activeEntry) {
      interval = setInterval(() => {
        const startTime = new Date(activeEntry.started_at).getTime();
        const now = new Date().getTime();
        setElapsedTime(Math.floor((now - startTime) / 1000));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeEntry]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        navigate('/dashboard');
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

  // Redirect if no active timer
  useEffect(() => {
    if (!activeEntry && user) {
      navigate('/dashboard');
    }
  }, [activeEntry, navigate, user]);

  const loadActiveEntry = async () => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          id, project_id, started_at, notes,
          projects:project_id (
            id, name, client_id,
            clients:client_id (name)
          )
        `)
        .is('stopped_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setActiveEntry(data);
      } else {
        // No active entry found, redirect to dashboard
        setActiveEntry(null);
        if (!error || error.code === 'PGRST116') {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      console.error('Error loading active entry:', error);
      navigate('/dashboard');
    }
  };

  const formatTimeDisplay = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProjectDisplay = (project: Project) => {
    if (project.clients?.name) {
      return `${project.clients.name} - ${project.name}`;
    }
    return project.name;
  };

  const getIndustrialHours = (seconds: number) => {
    return (seconds / 3600).toFixed(2);
  };

  // Show warning if timer has been running for more than 8 hours
  const isLongRunning = elapsedTime > 8 * 60 * 60;

  if (!activeEntry) {
    return null; // Will redirect to dashboard
  }

  return (
    <div className={`min-h-screen flex flex-col timer-skin-${timerSkin}`} 
         style={{
           background: 'linear-gradient(135deg, hsl(var(--primary) / 0.05), hsl(var(--primary) / 0.1))'
         }}>
      
      {/* Header */}
      <div className="flex justify-between items-center p-4 sm:p-6">
        <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
          <Badge variant="default" className="text-xs sm:text-sm shrink-0">
            Standard Timer
          </Badge>
          {activeEntry.projects && (
            <span className="text-xs sm:text-sm text-muted-foreground truncate">
              {getProjectDisplay(activeEntry.projects)}
            </span>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/dashboard')}
          className="hover:bg-background/20 shrink-0 ml-2"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>
      </div>

      {/* Main Timer Display */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-8 px-4 sm:px-6">
        
        {/* Large Timer */}
        <div className="timer-display" style={{ 
          padding: 'clamp(1.5rem, 5vw, 3rem) clamp(2rem, 8vw, 4rem)',
          background: 'var(--timer-bg)',
          boxShadow: 'var(--timer-shadow)',
          borderRadius: 'clamp(0.5rem, 2vw, 1rem)',
          minWidth: 'min(90vw, 400px)',
          textAlign: 'center',
        }}>
          <div className={`timer-digits ${timerSkin === 'gradient' ? 'gradient' : ''} ${isLongRunning ? 'warning' : ''}`}
               style={{ 
                 fontSize: 'clamp(2rem, 10vw, 8rem)',
                 fontWeight: 'var(--timer-weight)',
                 color: isLongRunning ? '#dc2626' : 'var(--timer-fg)',
                 lineHeight: '1.1',
               }}>
            {formatTimeDisplay(elapsedTime)}
          </div>
        </div>

        {/* Timer Info */}
        <div className="text-center space-y-2">
          {elapsedTime > 0 && (
            <div className="text-sm text-muted-foreground">
              = {getIndustrialHours(elapsedTime)}h elapsed
            </div>
          )}
          
          {activeEntry.notes && (
            <div className="text-sm text-muted-foreground max-w-md px-4">
              "{activeEntry.notes}"
            </div>
          )}
        </div>

        {/* Status */}
        <Badge variant="outline" className="text-base px-4 py-2">
          ⏱️ Running
        </Badge>

        {/* Long Running Warning */}
        {isLongRunning && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 max-w-md">
            <p className="text-sm text-destructive text-center font-medium">
              ⚠️ Timer has been running for more than 8 hours. Consider stopping and reviewing your entry.
            </p>
          </div>
        )}
      </div>

      {/* Footer Instructions */}
      <div className="p-4 sm:p-6 text-center">
        <p className="text-xs sm:text-sm text-muted-foreground">
          Press <kbd className="px-2 py-1 bg-muted rounded text-xs">Escape</kbd> to return to dashboard
        </p>
      </div>
    </div>
  );
}