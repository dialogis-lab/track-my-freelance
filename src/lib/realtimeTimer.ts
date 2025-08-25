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
  private debug = true;
  private subscriptionCount: Map<string, number> = new Map();
  private callbacks: Map<string, TimerCallbacks[]> = new Map();

  private log(message: string, ...args: any[]) {
    if (this.debug) {
      console.log(`[RealtimeTimer] ${message}`, ...args);
    }
  }

  private getChannelKey(userId: string, table: TimerTable): string {
    return `${table}_${userId}`;
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
    
    this.log(`Setting up subscription for ${table} (count: ${currentCount + 1})`);

    // Check if we already have an active channel
    if (this.channels.has(channelKey)) {
      this.log(`Reusing existing channel for ${table}`);
      // Trigger onSubscribed for the new callback immediately
      setTimeout(() => callbacks.onSubscribed?.(), 10);
      
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

    // Create a simpler channel subscription
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
          this.log(`Event received for ${table}:`, payload.eventType, payload.new?.id || payload.old?.id);
          
          const timerPayload: TimerPayload = {
            eventType: payload.eventType,
            new: payload.new || undefined,
            old: payload.old || undefined,
            table
          };

          // Notify all callbacks immediately
          const allCallbacks = this.callbacks.get(channelKey) || [];
          allCallbacks.forEach(cb => {
            try {
              cb.onUpdate?.(timerPayload);
            } catch (error) {
              this.log(`Error in callback for ${table}:`, error);
              cb.onError?.(error);
            }
          });
        }
      )
      .subscribe((status, err) => {
        this.log(`Subscription status for ${table}:`, status, err);
        
        if (status === 'SUBSCRIBED') {
          this.log(`Subscription ready for ${table}`);
          
          // Notify all callbacks
          const allCallbacks = this.callbacks.get(channelKey) || [];
          allCallbacks.forEach(cb => {
            try {
              cb.onSubscribed?.();
            } catch (error) {
              this.log(`Error in onSubscribed callback for ${table}:`, error);
              cb.onError?.(error);
            }
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          this.log(`Channel error for ${table}:`, status, err);
          const error = new Error(`Channel error for ${table}: ${status}`);
          
          // Notify all callbacks
          const allCallbacks = this.callbacks.get(channelKey) || [];
          allCallbacks.forEach(cb => cb.onError?.(error));
          
          // Clean up the failed connection
          this.channels.delete(channelKey);
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