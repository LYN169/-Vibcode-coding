declare const __PUBLIC_DATA__: Record<string, string> | undefined;

function getInlineData(path: string): string | undefined {
  if (typeof __PUBLIC_DATA__ !== "undefined" && __PUBLIC_DATA__) {
    return __PUBLIC_DATA__[path];
  }
  return undefined;
}

export async function loadGeoJson<T = unknown>(filename: string): Promise<T> {
  const key = "data/" + filename;
  const cached = getInlineData(key);
  if (cached !== undefined) {
    console.log(`[loadGeoJson] OK (inline): ${filename}`);
    return JSON.parse(cached) as T;
  }
  const url = `/sc-datav/data/${filename}`;
  console.log(`[loadGeoJson] loading: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[loadGeoJson] FAILED: ${url}`);
  return await res.json() as T;
}
