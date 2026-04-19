import fs from "node:fs/promises";
import path from "node:path";

export type ReportRecord = {
  id: string;
  title: string;
  weekText: string | null;
  publishDate: string | null;
  htmlUrl: string;
  pdfUrl: string | null;
  htmlText: string | null;
  pdfText: string | null;
  ai: unknown | null;
  aiRaw: string | null;
  contentHash: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IndexFile = {
  lastSyncAt: string | null;
  reports: Array<Pick<ReportRecord, "id" | "title" | "publishDate" | "htmlUrl" | "pdfUrl" | "updatedAt">>;
};

function nowIso() {
  return new Date().toISOString();
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function atomicWriteJson(filePath: string, data: unknown) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, filePath);
}

function toIndexReport(report: ReportRecord) {
  return {
    id: report.id,
    title: report.title,
    publishDate: report.publishDate,
    htmlUrl: report.htmlUrl,
    pdfUrl: report.pdfUrl,
    updatedAt: report.updatedAt,
  };
}

function compareValueDesc(a: string | null | undefined, b: string | null | undefined) {
  return (b ?? "").localeCompare(a ?? "");
}

export function compareReportTime(a: Pick<ReportRecord, "id" | "publishDate" | "updatedAt">, b: Pick<ReportRecord, "id" | "publishDate" | "updatedAt">) {
  return (
    compareValueDesc(a.publishDate, b.publishDate) ||
    compareValueDesc(a.updatedAt, b.updatedAt) ||
    compareValueDesc(a.id, b.id)
  );
}

function normalizeTs(value: string | null | undefined) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function pickLastSyncAt(current: string | null, latestReportUpdatedAt: string | null) {
  const currentMs = normalizeTs(current);
  const latestMs = normalizeTs(latestReportUpdatedAt);
  if (currentMs === null) return latestReportUpdatedAt;
  if (latestMs === null) return current;
  return latestMs > currentMs ? latestReportUpdatedAt : current;
}

function sameIndex(a: IndexFile, b: IndexFile) {
  if (a.lastSyncAt !== b.lastSyncAt) return false;
  if (a.reports.length !== b.reports.length) return false;
  return a.reports.every((report, idx) => JSON.stringify(report) === JSON.stringify(b.reports[idx]));
}

function toReportGroupKey(report: Pick<ReportRecord, "title" | "weekText" | "publishDate">) {
  const key = report.weekText?.trim() || report.title?.trim();
  return key || `${report.publishDate ?? ""}`;
}

export function selectIndexReports(reports: ReportRecord[], maxReports = reports.length) {
  const sorted = [...reports].sort(compareReportTime);
  const picked: ReportRecord[] = [];
  const seen = new Set<string>();

  for (const report of sorted) {
    const key = toReportGroupKey(report);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(report);
    if (picked.length >= maxReports) break;
  }

  return picked;
}

export class FileStore {
  private indexPath: string;
  private reportsDir: string;
  private pdfDir: string;

  constructor(private dataDir: string) {
    this.indexPath = path.join(this.dataDir, "reports", "index.json");
    this.reportsDir = path.join(this.dataDir, "reports");
    this.pdfDir = path.join(this.dataDir, "pdfs");
  }

  getPdfPath(id: string) {
    return path.join(this.pdfDir, `${id}.pdf`);
  }

  async readIndex(): Promise<IndexFile> {
    const current = await this.readStoredIndex();
    const repaired = await this.rebuildIndexFromReports(current);
    if (repaired && !sameIndex(current, repaired)) {
      await this.writeIndex(repaired);
      return repaired;
    }
    if (repaired) return repaired;

    return current;
  }

  private async readStoredIndex(): Promise<IndexFile> {
    try {
      const raw = await fs.readFile(this.indexPath, "utf-8");
      return JSON.parse(raw) as IndexFile;
    } catch {
      return { lastSyncAt: null, reports: [] };
    }
  }

  async writeIndex(index: IndexFile) {
    await atomicWriteJson(this.indexPath, index);
  }

  async getReport(id: string): Promise<ReportRecord | null> {
    const p = path.join(this.reportsDir, `${id}.json`);
    try {
      const raw = await fs.readFile(p, "utf-8");
      return JSON.parse(raw) as ReportRecord;
    } catch {
      return null;
    }
  }

  async putReport(record: Omit<ReportRecord, "createdAt" | "updatedAt"> & Partial<Pick<ReportRecord, "createdAt" | "updatedAt">>) {
    const p = path.join(this.reportsDir, `${record.id}.json`);
    const existing = await this.getReport(record.id);
    const createdAt = existing?.createdAt ?? record.createdAt ?? nowIso();
    const updatedAt = record.updatedAt ?? nowIso();
    const merged: ReportRecord = {
      id: record.id,
      title: record.title,
      weekText: record.weekText ?? null,
      publishDate: record.publishDate ?? null,
      htmlUrl: record.htmlUrl,
      pdfUrl: record.pdfUrl ?? null,
      htmlText: record.htmlText ?? null,
      pdfText: record.pdfText ?? null,
      ai: record.ai ?? null,
      aiRaw: record.aiRaw ?? null,
      contentHash: record.contentHash ?? null,
      createdAt,
      updatedAt,
    };
    await atomicWriteJson(p, merged);
    return merged;
  }

  async writePdf(id: string, bytes: Uint8Array) {
    await ensureDir(this.pdfDir);
    const p = this.getPdfPath(id);
    await fs.writeFile(p, bytes);
    return p;
  }

  private async rebuildIndexFromReports(current: IndexFile): Promise<IndexFile | null> {
    let files: string[];
    try {
      files = await fs.readdir(this.reportsDir);
    } catch {
      return null;
    }

    const reportIds = files
      .filter((file) => file.endsWith(".json") && file !== "index.json")
      .map((file) => file.slice(0, -".json".length));

    if (reportIds.length === 0) return current;

    const reports = (
      await Promise.all(
        reportIds.map(async (id) => {
          return await this.getReport(id);
        }),
      )
    ).filter((report): report is ReportRecord => !!report);

    const maxReports = current.reports.length > 0 ? current.reports.length : reports.length;
    const pickedReports = selectIndexReports(reports, maxReports);
    const latestReportUpdatedAt = pickedReports[0]?.updatedAt ?? null;

    return {
      lastSyncAt: pickLastSyncAt(current.lastSyncAt, latestReportUpdatedAt),
      reports: pickedReports.map(toIndexReport),
    };
  }
}
