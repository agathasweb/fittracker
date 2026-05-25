const REPO = 'agathasweb/fittracker';

export type ReleaseInfo = {
  tag: string;
  name: string;
  apkUrl: string;
  htmlUrl: string;
  publishedAt: string;
};

export async function getLatestRelease(): Promise<ReleaseInfo | null> {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!r.ok) return null;
    const data = await r.json();
    const asset = (data.assets || []).find((a: any) =>
      typeof a.name === 'string' && a.name.endsWith('.apk')
    );
    if (!asset) return null;
    return {
      tag: data.tag_name,
      name: data.name ?? data.tag_name,
      apkUrl: asset.browser_download_url,
      htmlUrl: data.html_url,
      publishedAt: data.published_at,
    };
  } catch {
    return null;
  }
}

function parseSemver(v: string): [number, number, number] {
  const clean = v.replace(/^v/, '').split('-')[0];
  const parts = clean.split('.').map((p) => parseInt(p, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function isNewerVersion(latest: string, current: string): boolean {
  const [la, lb, lc] = parseSemver(latest);
  const [ca, cb, cc] = parseSemver(current);
  if (la !== ca) return la > ca;
  if (lb !== cb) return lb > cb;
  return lc > cc;
}
