export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function getStorageHealthStatus(used: number, quota: number): 'healthy' | 'warning' | 'critical' {
  const ratio = used / quota;
  if (ratio < 0.7) return 'healthy';
  if (ratio < 0.9) return 'warning';
  return 'critical';
}

export const PROJECT_COLORS = [
  '#E07860', // Coral
  '#2D4A3E', // Forest
  '#00D4FF', // Cyan
  '#FFB800', // Amber
  '#9B59B6', // Purple
  '#00E5A0', // Mint
  '#E74C3C', // Red
  '#3498DB', // Blue
];
