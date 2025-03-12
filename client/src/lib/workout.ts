import { format, isValid, parseISO } from "date-fns";

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);

  return parts.join(" ");
}

export function formatDate(date: Date | string): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) {
      console.error('Invalid date:', date);
      return 'Invalid date';
    }
    return format(dateObj, "MMM d, yyyy h:mm a");
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}