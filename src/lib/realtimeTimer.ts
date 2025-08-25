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
  private debug = true; // Enable debug temporarily
  private subscriptionCount: Map<string, number> = new Map();
  private callbacks: Map<string, TimerCallbacks[]> = new Map();

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
    
    // Track subscription count and callbacks
    const currentCount = this.subscriptionCount.get(channelKey) || 0;
    this.subscriptionCount.set(channelKey, currentCount + 1);
    
    const existingCallbacks = this.callbacks.get(channelKey) || [];
    existingCallbacks.push(callbacks);
    this.callbacks.set(channelKey, existingCallbacks);
    
    this.log(`Setting up subscription for ${table} (count: ${currentCount + 1})`, { userId, table });

    // Check if we already have an active channel
    const existingChannel = this.channels.get(channelKey);
    if (existingChannel) {
      this.log(`Reusing existing channel for ${table}`);
      // Trigger onSubscribed for the new callback
      callbacks.onSubscribed?.();
      
      // Return subscription that just manages the count and callbacks
      return {
        unsubscribe: () => {
          const callbacksList = this.callbacks.get(channelKey) || [];
          const filteredCallbacks = callbacksList.filter(cb => cb !== callbacks);
          this.callbacks.set(channelKey, filteredCallbacks);
          
          const count = this.subscriptionCount.get(channelKey) || 1;
          this.subscriptionCount.set(channelKey, count - 1);
          if (count <= 1) {
            this.unsubscribe(userId, table);
          }
        }
      };
    }

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
                    const fallbackPayload = { ...timerPayload, new: row };
                    // Notify all callbacks
                    const allCallbacks = this.callbacks.get(channelKey) || [];
                    allCallbacks.forEach(cb => cb.onUpdate?.(fallbackPayload));
                  }
                })
                .catch(error => {
                  this.log(`Failed to fetch fallback row:`, error);
                  // Notify all callbacks of error
                  const allCallbacks = this.callbacks.get(channelKey) || [];
                  allCallbacks.forEach(cb => cb.onError?.(error));
                });
            }
            return;
          }

          // Notify all callbacks
          const allCallbacks = this.callbacks.get(channelKey) || [];
          allCallbacks.forEach(cb => cb.onUpdate?.(timerPayload));
        }
      )
      .subscribe((status) => {
        this.log(`Subscription status for ${table}:`, status);
        
        if (status === 'SUBSCRIBED') {
          this.log(`Subscription ready for ${table}, triggering reload`);
          // Notify all callbacks
          const allCallbacks = this.callbacks.get(channelKey) || [];
          allCallbacks.forEach(cb => cb.onSubscribed?.());
        } else if (status === 'CHANNEL_ERROR') {
          this.log(`Channel error for ${table}:`, status);
          const error = new Error(`Channel error for ${table}`);
          // Notify all callbacks
          const allCallbacks = this.callbacks.get(channelKey) || [];
          allCallbacks.forEach(cb => cb.onError?.(error));
        }
      });

    this.channels.set(channelKey, channel);

    return {
      unsubscribe: () => {
        const callbacksList = this.callbacks.get(channelKey) || [];
        const filteredCallbacks = callbacksList.filter(cb => cb !== callbacks);
        this.callbacks.set(channelKey, filteredCallbacks);
        
        const count = this.subscriptionCount.get(channelKey) || 1;
        this.subscriptionCount.set(channelKey, count - 1);
        if (count <= 1) {
          this.unsubscribe(userId, table);
        }
      }
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
      this.subscriptionCount.delete(channelKey);
      this.callbacks.delete(channelKey);
    }
  }

  unsubscribeAll(): void {
    this.log('Cleaning up all subscriptions');
    this.channels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
    this.subscriptionCount.clear();
    this.callbacks.clear();
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