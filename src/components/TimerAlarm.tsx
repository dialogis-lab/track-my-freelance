import { useEffect, useRef } from 'react';

interface TimerAlarmProps {
  onAlarmTriggered?: () => void;
}

export function TimerAlarm({ onAlarmTriggered }: TimerAlarmProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const playAlarmSound = () => {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Create a pleasant notification sound
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      if (onAlarmTriggered) {
        onAlarmTriggered();
      }
    } catch (error) {
      console.error('Error playing alarm sound:', error);
    }
  };

  // Expose the playAlarmSound function globally so other components can trigger it
  useEffect(() => {
    (window as any).playTimerAlarm = playAlarmSound;
    
    return () => {
      delete (window as any).playTimerAlarm;
    };
  }, []);

  return (
    <div className="hidden">
      {/* Optional HTML audio element as fallback */}
      <audio
        ref={audioRef}
        preload="auto"
        className="hidden"
      >
        {/* We're using Web Audio API instead, but this could be used as fallback */}
      </audio>
    </div>
  );
}