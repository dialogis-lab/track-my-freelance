import { getVersionMeta } from '@/lib/version';

export async function GET() {
  const versionMeta = getVersionMeta();
  
  return new Response(JSON.stringify(versionMeta), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}