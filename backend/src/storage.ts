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
}

