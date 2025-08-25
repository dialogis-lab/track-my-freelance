import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type TimerTable = 'time_entries' | 'pomodoro_sessions';

interface RealtimeTimerSubscription {
  unsubscribe: () => void;
}

interface TimerPayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: Record<string, any>;
  old?: Record<string, any>;
  table: string;
}

interface TimerCallbacks {
  onUpdate?: (payload: TimerPayload) => void;
  onSubscribed?: () => void;
  onError?: (error: any) => void;
}

class RealtimeTimerManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private debug = process.env.NODE_ENV === 'development' && globalThis.localStorage?.getItem('TIMER_DEBUG') === '1';

  private log(message: string, ...args: any[]) {
    if (this.debug) {
      console.log(`[RealtimeTimer] ${message}`, ...args);
    }
  }

  private getChannelKey(userId: string, table: TimerTable): string {
    return `timer:${table}:${userId}`;
  }

  subscribe(
    userId: string,
    table: TimerTable,
    callbacks: TimerCallbacks
  ): RealtimeTimerSubscription {
    const channelKey = this.getChannelKey(userId, table);
    
    // Clean up existing channel if any
    this.unsubscribe(userId, table);

    this.log(`Setting up subscription for ${table}`, { userId, table });

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `user_id=eq.${userId}`
        },
        (payload: any) => {
          this.log(`Event received for ${table}:`, payload.eventType, payload);
          
          const timerPayload: TimerPayload = {
            eventType: payload.eventType,
            new: payload.new || undefined,
            old: payload.old || undefined,
            table
          };

          // Validate payload has required data
          if (payload.eventType !== 'DELETE' && (!payload.new || typeof payload.new !== 'object')) {
            this.log(`Invalid payload for ${table} - missing 'new' data:`, payload);
            // Fallback: try to fetch the row by ID if we have it
            if (payload.new?.id) {
              this.fetchRowById(table, payload.new.id, userId)
                .then(row => {
                  if (row) {
                    callbacks.onUpdate?.({ ...timerPayload, new: row });
                  }
                })
                .catch(error => {
                  this.log(`Failed to fetch fallback row:`, error);
                  callbacks.onError?.(error);
                });
            }
            return;
          }

          callbacks.onUpdate?.(timerPayload);
        }
      )
      .subscribe((status) => {
        this.log(`Subscription status for ${table}:`, status);
        
        if (status === 'SUBSCRIBED') {
          this.log(`Subscription ready for ${table}, triggering reload`);
          callbacks.onSubscribed?.();
        } else if (status === 'CHANNEL_ERROR') {
          this.log(`Channel error for ${table}:`, status);
          callbacks.onError?.(new Error(`Channel error for ${table}`));
        }
      });

    this.channels.set(channelKey, channel);

    return {
      unsubscribe: () => this.unsubscribe(userId, table)
    };
  }

  private async fetchRowById(table: TimerTable, id: string, userId: string): Promise<Record<string, any> | null> {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      this.log(`Error fetching row from ${table}:`, error);
      return null;
    }
  }

  unsubscribe(userId: string, table: TimerTable): void {
    const channelKey = this.getChannelKey(userId, table);
    const channel = this.channels.get(channelKey);
    
    if (channel) {
      this.log(`Cleaning up subscription for ${table}`, { userId, table });
      supabase.removeChannel(channel);
      this.channels.delete(channelKey);
    }
  }

  unsubscribeAll(): void {
    this.log('Cleaning up all subscriptions');
    this.channels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
  }
}

// Export singleton instance
export const realtimeTimer = new RealtimeTimerManager();

// Helper functions for common operations
export const subscribeToTimeEntries = (
  userId: string,
  callbacks: TimerCallbacks
): RealtimeTimerSubscription => {
  return realtimeTimer.subscribe(userId, 'time_entries', callbacks);
};

export const subscribeToPomodoroSessions = (
  userId: string,
  callbacks: TimerCallbacks
): RealtimeTimerSubscription => {
  return realtimeTimer.subscribe(userId, 'pomodoro_sessions', callbacks);
};

// Type exports
export type { RealtimeTimerSubscription, TimerPayload, TimerCallbacks };