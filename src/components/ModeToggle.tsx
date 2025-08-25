import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Timer, Clock } from 'lucide-react';

export type TimerMode = 'stopwatch' | 'pomodoro';

interface ModeToggleProps {
  mode: TimerMode;
  onModeChange: (mode: TimerMode) => void;
  size?: 'sm' | 'default';
  disabled?: boolean;
}

export function ModeToggle({ mode, onModeChange, size = 'default', disabled = false }: ModeToggleProps) {
  const buttonSize = size === 'sm' ? 'sm' : 'default';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <div className="flex rounded-md border overflow-hidden">
      <Button
        variant={mode === 'stopwatch' ? 'default' : 'ghost'}
        size={buttonSize}
        onClick={() => onModeChange('stopwatch')}
        disabled={disabled}
        className="rounded-none border-none"
      >
        <Clock className={iconSize} />
        {size !== 'sm' && <span className="ml-2">Stopwatch</span>}
      </Button>
      <Button
        variant={mode === 'pomodoro' ? 'default' : 'ghost'}
        size={buttonSize}
        onClick={() => onModeChange('pomodoro')}
        disabled={disabled}
        className="rounded-none border-none border-l"
      >
        <Timer className={iconSize} />
        {size !== 'sm' && <span className="ml-2">Pomodoro</span>}
      </Button>
    </div>
  );
}