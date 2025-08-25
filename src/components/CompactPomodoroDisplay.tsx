import { Badge } from '@/components/ui/badge';
import { Circle } from 'lucide-react';

interface CompactPomodoroDisplayProps {
  phase: string;
  timeRemaining: number;
  currentStreak: number;
  longBreakEvery: number;
  formatTime: (seconds: number) => string;
}

export function CompactPomodoroDisplay({ 
  phase, 
  timeRemaining, 
  currentStreak, 
  longBreakEvery,
  formatTime 
}: CompactPomodoroDisplayProps) {
  const getPhaseLabel = () => {
    switch (phase) {
      case 'focus':
        return 'Focus';
      case 'longBreak':
        return 'Long Break';
      case 'break':
        return 'Break';
      default:
        return 'Ready';
    }
  };

  const getPhaseVariant = () => {
    switch (phase) {
      case 'focus':
        return 'default';
      case 'longBreak':
        return 'secondary';
      case 'break':
        return 'outline';
      default:
        return 'outline';
    }
  };

  // Generate cycle dots (max 8 for display)
  const renderCycleDots = () => {
    const maxDots = Math.min(longBreakEvery, 8);
    const currentCycle = currentStreak % longBreakEvery;
    
    return (
      <div className="flex items-center space-x-1">
        {Array.from({ length: maxDots }, (_, i) => (
          <Circle
            key={i}
            className={`w-2 h-2 ${
              i < currentCycle 
                ? 'fill-primary text-primary' 
                : 'text-muted-foreground'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Badge variant={getPhaseVariant()}>
          {getPhaseLabel()}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {formatTime(timeRemaining)}
        </span>
      </div>
      
      {longBreakEvery > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Cycle progress
          </span>
          {renderCycleDots()}
        </div>
      )}
      
      {currentStreak > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          Streak: {currentStreak}
        </div>
      )}
    </div>
  );
}