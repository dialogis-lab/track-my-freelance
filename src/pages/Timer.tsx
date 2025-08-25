import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TimerWidget } from '@/components/TimerWidget';
import { PomodoroCard } from '@/components/PomodoroCard';
import { Timer as TimerIcon, Clock } from 'lucide-react';

export default function Timer() {
  const [activeTab, setActiveTab] = useState('stopwatch');

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">Timer</h1>
            <p className="text-muted-foreground">
              Choose between stopwatch mode for flexible time tracking or Pomodoro mode for focused work sessions.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="stopwatch">
                <Clock className="w-4 h-4 mr-2" />
                Stopwatch
              </TabsTrigger>
              <TabsTrigger value="pomodoro">
                <TimerIcon className="w-4 h-4 mr-2" />
                Pomodoro
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stopwatch" className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold mb-2">Stopwatch Timer</h2>
                <p className="text-sm text-muted-foreground">
                  Track time flexibly for any project. Start, pause, and stop as needed.
                </p>
              </div>
              <TimerWidget />
            </TabsContent>

            <TabsContent value="pomodoro" className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold mb-2">Pomodoro Timer</h2>
                <p className="text-sm text-muted-foreground">
                  Work in focused 25-minute sessions with built-in breaks. Perfect for maintaining productivity.
                </p>
              </div>
              <PomodoroCard />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}