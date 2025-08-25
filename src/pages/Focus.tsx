import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePomodoro } from '@/hooks/usePomodoro';
import { useTimerSkin } from '@/hooks/useTimerSkin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Play, Pause, Square } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  client_id: string | null;
  clients?: { name: string } | null;
}

export default function Focus() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { timerSkin } = useTimerSkin();
  const {
    isEnabled,
    phase,
    state,
    timeRemaining,
    currentSession,
    currentStreak,
    formatTime,
    getIndustrialHours,
  } = usePomodoro();

  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  // Load current project if there's an active session
  useEffect(() => {
    const loadCurrentProject = async () => {
      if (user && state !== 'idle') {
        try {
          const { data, error } = await supabase
            .from('time_entries')
            .select(`
              project_id,
              projects:project_id (
                id, name, client_id,
                clients:client_id (name)
              )
            `)
            .is('stopped_at', null)
            .order('started_at', { ascending: false })
            .limit(1)
            .single();

          if (!error && data?.projects) {
            setCurrentProject(data.projects as Project);
          }
        } catch (error) {
          console.error('Error loading current project:', error);
        }
      }
    };

    loadCurrentProject();
  }, [user, state]);

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

  // Redirect if not in Pomodoro mode
  useEffect(() => {
    if (!isEnabled) {
      navigate('/dashboard');
    }
  }, [isEnabled, navigate]);

  const getProjectDisplay = (project: Project) => {
    if (project.clients?.name) {
      return `${project.clients.name} - ${project.name}`;
    }
    return project.name;
  };

  const getPhaseDisplay = () => {
    switch (phase) {
      case 'focus':
        return 'Focus Session';
      case 'break':
        return 'Short Break';
      case 'longBreak':
        return 'Long Break';
      default:
        return 'Focus Session';
    }
  };

  const isLongRunning = timeRemaining > 0 && timeRemaining > 8 * 60 * 60;

  return (
    <div className={`min-h-screen flex flex-col timer-skin-${timerSkin}`} 
         style={{
           background: phase === 'focus' 
             ? 'linear-gradient(135deg, hsl(var(--primary) / 0.05), hsl(var(--primary) / 0.1))'
             : 'linear-gradient(135deg, hsl(var(--muted) / 0.5), hsl(var(--muted) / 0.8))'
         }}>
      
      {/* Header */}
      <div className="flex justify-between items-center p-4 sm:p-6">
        <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
          <Badge variant={phase === 'focus' ? 'default' : 'secondary'} className="text-xs sm:text-sm shrink-0">
            {getPhaseDisplay()}
          </Badge>
          {currentProject && (
            <span className="text-xs sm:text-sm text-muted-foreground truncate">
              {getProjectDisplay(currentProject)}
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
            {formatTime(timeRemaining)}
          </div>
        </div>

        {/* Session Info */}
        <div className="text-center space-y-2">
          {phase === 'focus' && currentProject && (
            <div className="text-lg font-medium text-foreground">
              Session #{currentSession + 1}
            </div>
          )}
          
          {timeRemaining > 0 && (
            <div className="text-sm text-muted-foreground">
              = {getIndustrialHours(timeRemaining)}h remaining
            </div>
          )}
          
          {/* Streak Display */}
          {currentStreak > 0 && (
            <div className="flex items-center justify-center space-x-2 mt-4">
              <div className="flex items-center space-x-1">
                {[...Array(Math.min(currentStreak, 10))].map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary"
                  />
                ))}
                {currentStreak > 10 && (
                  <span className="text-sm text-primary font-medium ml-2">
                    +{currentStreak - 10}
                  </span>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                Focus streak: {currentStreak}
              </span>
            </div>
          )}
        </div>

        {/* Status */}
        {state !== 'idle' && (
          <Badge variant="outline" className="text-base px-4 py-2">
            {state === 'running' ? '⏱️ Active' : '⏸️ Paused'}
          </Badge>
        )}

        {/* Long Running Warning */}
        {isLongRunning && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 max-w-md">
            <p className="text-sm text-destructive text-center font-medium">
              ⚠️ This session has been running for an unusually long time. Consider taking a break.
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