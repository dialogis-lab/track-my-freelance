import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTimerSkin } from '@/hooks/useTimerSkin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Play, Pause, Square } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  client_id: string | null;
  clients?: { name: string } | null;
}

export default function Focus() {
  const navigate = useNavigate();

  // Since Pomodoro is removed, redirect to dashboard
  useEffect(() => {
    navigate('/dashboard');
  }, [navigate]);

  return null;
}