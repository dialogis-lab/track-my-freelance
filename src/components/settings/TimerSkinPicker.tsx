import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Check } from 'lucide-react';

export type TimerSkin = 'classic' | 'minimal' | 'digital' | 'gradient';

const TIMER_SKINS: Array<{
  id: TimerSkin;
  name: string;
  description: string;
}> = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Bold monospace on light background'
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Thin monospace, subtle and calm'
  },
  {
    id: 'digital',
    name: 'Digital',
    description: 'Dark panel with soft LED look'
  },
  {
    id: 'gradient',
    name: 'Gradient',
    description: 'Brand blue/green gradient text'
  }
];

interface TimerSkinPickerProps {
  currentSkin: TimerSkin;
  onSkinChange: (skin: TimerSkin) => void;
}

export function TimerSkinPicker({ currentSkin, onSkinChange }: TimerSkinPickerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSkinSelect = async (skin: TimerSkin) => {
    setLoading(true);
    
    try {
      if (user) {
        // Update profile in database
        const { error } = await supabase
          .from('profiles')
          .update({ timer_skin: skin })
          .eq('id', user.id);

        if (error) throw error;
      } else {
        // Store in localStorage for non-authenticated users
        localStorage.setItem('th_timer_skin', skin);
      }

      onSkinChange(skin);
      
      toast({
        title: "Timer style updated",
        description: `Switched to ${TIMER_SKINS.find(s => s.id === skin)?.name} style.`,
      });
    } catch (error) {
      console.error('Error updating timer skin:', error);
      toast({
        title: "Error updating timer style",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Timer Style</h3>
        <p className="text-sm text-muted-foreground">
          Choose how your timer display looks
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TIMER_SKINS.map((skin) => (
          <Card
            key={skin.id}
            className={`cursor-pointer transition-colors hover:bg-muted/50 ${
              currentSkin === skin.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => handleSkinSelect(skin.id)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium">{skin.name}</h4>
                    {currentSkin === skin.id && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {skin.description}
                  </p>
                </div>
              </div>
              
              {/* Preview */}
              <div className="mt-4">
                <div 
                  className={`timer-skin-${skin.id} inline-block`}
                  style={{
                    borderRadius: '0.5rem',
                    padding: '0.75rem 1rem',
                    boxShadow: 'var(--timer-shadow)',
                    backgroundColor: 'var(--timer-bg)',
                  }}
                >
                  <div 
                    className={`timer-digits ${skin.id === 'gradient' ? 'gradient' : ''}`}
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontWeight: 'var(--timer-weight)',
                      fontSize: '1.5rem',
                      color: skin.id === 'gradient' ? 'transparent' : 'var(--timer-fg)',
                      background: skin.id === 'gradient' ? 'linear-gradient(to right, #3b82f6, #10b981)' : undefined,
                      backgroundClip: skin.id === 'gradient' ? 'text' : undefined,
                      WebkitBackgroundClip: skin.id === 'gradient' ? 'text' : undefined,
                      WebkitTextFillColor: skin.id === 'gradient' ? 'transparent' : undefined,
                    }}
                  >
                    01:23:45
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {loading && (
        <p className="text-sm text-muted-foreground">Updating timer style...</p>
      )}
    </div>
  );
}