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
  const version = import.meta.env.VITE_APP_VERSION || 'dev-local';
  const fullSha = import.meta.env.VITE_GIT_SHA || 'unknown';
  const shortSha = fullSha.substring(0, 8);
  
  return {
    name: 'TimeHatch',
    version: shortSha,
    branch: import.meta.env.VITE_GIT_BRANCH || 'main',
    commit: fullSha,
    buildTime: import.meta.env.VITE_BUILD_TIME || new Date().toISOString(),
    buildId: import.meta.env.VITE_BUILD_ID,
    env: import.meta.env.VITE_APP_ENV || 'development'
  };
}

export function formatVersionDisplay(): string {
  const meta = getVersionMeta();
  const date = new Date(meta.buildTime);
  const formattedDate = date.toISOString().replace('T', ' ').substring(0, 16);
  return `v${meta.version} · ${formattedDate} UTC`;
}