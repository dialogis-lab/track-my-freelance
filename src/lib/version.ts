export interface VersionMeta {
  name: string;
  version: string;
  branch: string;
  commit: string;
  buildTime: string;
  buildId?: string;
  env: string;
}

export function getVersionMeta(): VersionMeta {
  // Try NEXT_PUBLIC_ first, then fall back to VITE_ for compatibility
  const version = import.meta.env.NEXT_PUBLIC_APP_VERSION || import.meta.env.VITE_APP_VERSION || 'dev-local';
  const fullSha = import.meta.env.NEXT_PUBLIC_GIT_SHA || import.meta.env.VITE_GIT_SHA || 'dev-commit-' + Date.now().toString(36);
  const shortSha = fullSha.substring(0, 8);
  
  return {
    name: 'TimeHatch',
    version: shortSha,
    branch: import.meta.env.NEXT_PUBLIC_GIT_BRANCH || import.meta.env.VITE_GIT_BRANCH || 'local',
    commit: fullSha,
    buildTime: import.meta.env.NEXT_PUBLIC_BUILD_TIME || import.meta.env.VITE_BUILD_TIME || new Date().toISOString(),
    buildId: import.meta.env.NEXT_PUBLIC_BUILD_ID || import.meta.env.VITE_BUILD_ID,
    env: import.meta.env.NEXT_PUBLIC_APP_ENV || import.meta.env.VITE_APP_ENV || (import.meta.env.MODE === 'development' ? 'development' : 'production')
  };
}

export function formatVersionDisplay(): string {
  const meta = getVersionMeta();
  const date = new Date(meta.buildTime);
  // Format as YYYY-MM-DD HH:mm UTC
  const formattedDate = date.toISOString().replace('T', ' ').substring(0, 16);
  return `v${meta.version} · ${formattedDate} UTC`;
}