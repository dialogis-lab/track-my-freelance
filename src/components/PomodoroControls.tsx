import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Square, Coffee, Timer, AlertCircle, Maximize2 } from 'lucide-react';
import { usePomodoro } from '@/hooks/usePomodoro';

interface Project {
  id: string;
  name: string;
  client_id: string | null;
  clients?: { name: string } | null;
}

interface PomodoroControlsProps {
  projects: Project[];
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
}

export function PomodoroControls({ projects, selectedProjectId, onProjectChange }: PomodoroControlsProps) {
  const {
    phase,
    state,
    timeRemaining,
    settings,
    todaySessions,
    currentStreak,
    startFocus,
    startBreak,
    stopPomodoro,
    pausePomodoro,
    resumePomodoro,
    formatTime,
    getIndustrialHours,
    getNextPhase,
  } = usePomodoro();

  const [showPresets, setShowPresets] = useState(false);

  const getProjectDisplay = (project: Project) => {
    if (project.clients?.name) {
      return `${project.clients.name} - ${project.name}`;
    }
    return project.name;
  };

  const handlePrimaryAction = () => {
    if (state === 'idle') {
      if (phase === 'focus') {
        startFocus(selectedProjectId);
      } else {
        startBreak();
      }
    } else if (state === 'running') {
      if (phase === 'focus') {
        pausePomodoro();
      } else {
        // Allow stopping break early
        stopPomodoro();
      }
    } else if (state === 'paused') {
      resumePomodoro();
    }
  };

  const getPrimaryButtonText = () => {
    if (state === 'idle') {
      if (phase === 'focus') {
        return `Start Focus (${settings.focusMinutes}min)`;
      } else {
        const nextPhase = getNextPhase();
        const duration = nextPhase === 'longBreak' ? settings.longBreakMinutes : settings.breakMinutes;
        return `Start ${nextPhase === 'longBreak' ? 'Long ' : ''}Break (${duration}min)`;
      }
    } else if (state === 'running') {
      return phase === 'focus' ? 'Pause Focus' : 'End Break';
    } else {
      return 'Resume';
    }
  };

  const getPrimaryButtonIcon = () => {
    if (state === 'idle') {
      return phase === 'focus' ? <Timer className="w-4 h-4" /> : <Coffee className="w-4 h-4" />;
    } else if (state === 'running') {
      return phase === 'focus' ? <Pause className="w-4 h-4" /> : <Square className="w-4 h-4" />;
    } else {
      return <Play className="w-4 h-4" />;
    }
  };

  const getPrimaryButtonVariant = () => {
    if (phase === 'focus') {
      return state === 'idle' ? 'default' : 'secondary';
    } else {
      return state === 'idle' ? 'outline' : 'destructive';
    }
  };

  const isLongRunning = timeRemaining > 0 && (
    (phase === 'focus' && (settings.focusMinutes * 60 - timeRemaining) > 8 * 60 * 60) ||
    (phase !== 'focus' && (settings.breakMinutes * 60 - timeRemaining) > 8 * 60 * 60)
  );

  return (
    <div className="space-y-6">
      {/* Timer Display */}
      <div className="flex flex-col items-center justify-center py-12">
        <div className="timer-display">
          <div className={`timer-digits ${isLongRunning ? 'warning' : ''}`}>
            {formatTime(timeRemaining)}
          </div>
        </div>
        
        {/* Subtext with phase info */}
        <div className="flex flex-col items-center space-y-1 mt-4">
          <div className="flex items-center space-x-2">
            <Badge variant={phase === 'focus' ? 'default' : 'secondary'}>
              {phase === 'focus' ? 'Focus' : phase === 'longBreak' ? 'Long Break' : 'Break'}
            </Badge>
            {state !== 'idle' && (
              <Badge variant="outline">
                {state === 'running' ? 'Active' : 'Paused'}
              </Badge>
            )}
          </div>
          {timeRemaining > 0 && (
            <div className="timer-subtext-small">
              = {getIndustrialHours(timeRemaining)}h remaining
            </div>
          )}
          {/* Streak Display */}
          {currentStreak > 0 && (
            <div className="text-sm text-muted-foreground">
              Focus streak: {currentStreak}
            </div>
          )}
        </div>
      </div>

      {/* Warning for long running timers */}
      {isLongRunning && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <p className="text-sm text-destructive font-medium">
              This session has been running for an unusually long time. Consider taking a break.
            </p>
          </div>
        </div>
      )}

      {/* Project Selection - only show during focus setup */}
      {phase === 'focus' && state === 'idle' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Project</label>
          <Select
            value={selectedProjectId}
            onValueChange={onProjectChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a project for focus session" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {getProjectDisplay(project)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Preset Duration Buttons */}
      {state === 'idle' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Quick presets</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPresets(!showPresets)}
            >
              {showPresets ? 'Hide' : 'Show'} presets
            </Button>
          </div>
          
          {showPresets && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                // Set 25/5 preset (already default)
              }}>
                25/5 min
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                // Set 50/10 preset - this would need to be handled by settings
              }}>
                50/10 min
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Primary Action Button */}
      <div className="space-y-3">
        <Button
          onClick={handlePrimaryAction}
          disabled={phase === 'focus' && state === 'idle' && !selectedProjectId}
          size="lg"
          variant={getPrimaryButtonVariant()}
          className="w-full"
        >
          {getPrimaryButtonIcon()}
          {getPrimaryButtonText()}
        </Button>

        {/* Stop Button - only show when active */}
        {state !== 'idle' && (
          <Button
            onClick={stopPomodoro}
            size="lg"
            variant="destructive"
            className="w-full"
          >
            <Square className="w-4 h-4 mr-2" />
            Stop Pomodoro
          </Button>
        )}
      </div>

      {/* Daily Stats */}
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Focus sessions today</span>
          <Badge variant="secondary">{todaySessions}</Badge>
        </div>
      </div>
    </div>
  );
}