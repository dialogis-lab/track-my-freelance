/**
 * Formats time duration with dual display options
 * @param minutes - Duration in minutes
 * @param showDecimal - Whether to append decimal hours in parentheses
 * @returns Formatted time string
 * 
 * @example
 * formatTime(90) // "1h 30m"
 * formatTime(90, true) // "1h 30m (1.50h)"
 * formatTime(105) // "1h 45m"
 * formatTime(105, true) // "1h 45m (1.75h)"
 */
export function formatTime(minutes: number, showDecimal?: boolean): string {
  if (minutes === 0) {
    return showDecimal ? "0m (0.00h)" : "0m";
  }

  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  
  let timeString = "";
  
  if (hours > 0) {
    timeString += `${hours}h`;
    if (remainingMinutes > 0) {
      timeString += ` ${remainingMinutes}m`;
    }
  } else {
    timeString = `${remainingMinutes}m`;
  }
  
  if (showDecimal) {
    const decimalHours = (totalMinutes / 60).toFixed(2);
    timeString += ` (${decimalHours}h)`;
  }
  
  return timeString;
}

/**
 * Converts hours to minutes
 * @param hours - Duration in hours (decimal)
 * @returns Duration in minutes
 */
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

/**
 * Converts minutes to decimal hours
 * @param minutes - Duration in minutes
 * @returns Duration in decimal hours
 */
export function minutesToHours(minutes: number): number {
  return minutes / 60;
}

/**
 * Calculates duration between two dates in minutes
 * @param startDate - Start date/time
 * @param endDate - End date/time (optional, defaults to now)
 * @returns Duration in minutes
 */
export function calculateDurationMinutes(startDate: Date, endDate?: Date): number {
  const end = endDate || new Date();
  const diffMs = end.getTime() - startDate.getTime();
  return Math.round(diffMs / (1000 * 60));
}

/**
 * Formats time for CSV export
 * @param minutes - Duration in minutes
 * @returns Object with both hm and decimal formats
 */
export function formatTimeForCSV(minutes: number): { duration_hm: string; duration_decimal: string } {
  return {
    duration_hm: formatTime(minutes, false),
    duration_decimal: `${(minutes / 60).toFixed(2)}h`
  };
}