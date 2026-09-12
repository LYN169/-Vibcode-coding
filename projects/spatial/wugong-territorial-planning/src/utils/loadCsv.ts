const csvCache: Record<string, string> = {};

export async function loadCsv(filename: string): Promise<string[][]> {
  let text: string;

  if (csvCache[filename]) {
    text = csvCache[filename];
  } else {
    try {
      // Static import for build-time bundling into single HTML
      const mod = await import(`@data/${filename}?raw`);
      text = mod.default ?? (mod as unknown as string);
      csvCache[filename] = text;
      console.log(`[loadCsv] OK (import): ${filename}`);
    } catch {
      // Fallback: runtime fetch
      const url = `/sc-datav/data/${filename}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`[loadCsv] FAILED: ${url} (HTTP ${res.status})`);
      text = await res.text();
      csvCache[filename] = text;
      console.log(`[loadCsv] OK (fetch): ${filename}`);
    }
  }

  const rows = parseCSV(text);
  return rows;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  const currentRow: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { currentRow.push(current.trim()); current = ""; }
      else if (ch === "\r") { /* skip */ }
      else if (ch === "\n") { currentRow.push(current.trim()); rows.push([...currentRow]); currentRow.length = 0; current = ""; }
      else { current += ch; }
    }
  }
  if (current || currentRow.length > 0) {
    currentRow.push(current.trim());
    if (currentRow.some((c) => c !== "")) rows.push([...currentRow]);
  }
  return rows;
}

export function parseScenicDetailRows(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      const val = row[i] ?? "";
      if ((h === "tags" || h === "tag") && val.startsWith("[")) {
        try { obj[h] = JSON.parse(val).join(", "); } catch { obj[h] = val; }
      } else { obj[h] = val; }
    });
    return obj;
  });
}
