interface TimerDebugInfoProps {
  dashboardTimers: any;
  unifiedTimer?: any;
}

export function TimerDebugInfo({ dashboardTimers, unifiedTimer }: TimerDebugInfoProps) {
  if (process.env.NEXT_PUBLIC_TIMER_DEBUG !== '1') {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-gray-100 rounded text-xs space-y-2">
      <div className="font-bold">Timer Debug Info</div>
      <div>Dashboard Mode: {dashboardTimers.selectedMode || 'N/A'}</div>
      <div>Unified Mode: {unifiedTimer?.mode || 'N/A'}</div>
      <div>Stopwatch Running: {dashboardTimers.isStopwatchRunning ? 'YES' : 'NO'}</div>
      <div>Pomodoro Running: {dashboardTimers.isPomodoroRunning ? 'YES' : 'NO'}</div>
      <div>Stopwatch Display: {Math.floor(dashboardTimers.getStopwatchDisplayTime() / 1000)}s</div>
      <div>Pomodoro Display: {Math.floor(dashboardTimers.getPomodoroDisplayTime() / 1000)}s</div>
      <div>Server Offset: {dashboardTimers.serverOffsetMs}ms</div>
      <div>Loading: {dashboardTimers.loading ? 'YES' : 'NO'}</div>
      {dashboardTimers.stopwatch && (
        <div>SW Session: {dashboardTimers.stopwatch.id} @ {new Date(dashboardTimers.stopwatch.started_at).toLocaleTimeString()}</div>
      )}
      {dashboardTimers.pomodoro && (
        <div>PO Session: {dashboardTimers.pomodoro.id} @ {new Date(dashboardTimers.pomodoro.started_at).toLocaleTimeString()}</div>
      )}
    </div>
  );
}