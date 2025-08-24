import { TimerSkinPicker } from '@/components/settings/TimerSkinPicker';
import { useTimerSkin } from '@/hooks/useTimerSkin';

export function SettingsTimerStyle() {
  const { timerSkin, setTimerSkin } = useTimerSkin();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Timer Style</h2>
        <p className="text-muted-foreground">
          Customize how your timer display looks and feels
        </p>
      </div>
      
      <TimerSkinPicker 
        currentSkin={timerSkin}
        onSkinChange={setTimerSkin}
      />
    </div>
  );
}