import fs from "node:fs/promises";
import path from "node:path";
function nowIso() {
    return new Date().toISOString();
}
async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}
async function atomicWriteJson(filePath, data) {
    const dir = path.dirname(filePath);
    await ensureDir(dir);
    const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tmp, filePath);
}
export class FileStore {
    dataDir;
    indexPath;
    reportsDir;
    pdfDir;
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.indexPath = path.join(this.dataDir, "reports", "index.json");
        this.reportsDir = path.join(this.dataDir, "reports");
        this.pdfDir = path.join(this.dataDir, "pdfs");
    }
    getPdfPath(id) {
        return path.join(this.pdfDir, `${id}.pdf`);
    }
    async readIndex() {
        try {
            const raw = await fs.readFile(this.indexPath, "utf-8");
            return JSON.parse(raw);
        }
        catch {
            return { lastSyncAt: null, reports: [] };
        }
    }
    async writeIndex(index) {
        await atomicWriteJson(this.indexPath, index);
    }
    async getReport(id) {
        const p = path.join(this.reportsDir, `${id}.json`);
        try {
            const raw = await fs.readFile(p, "utf-8");
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    async putReport(record) {
        const p = path.join(this.reportsDir, `${record.id}.json`);
        const existing = await this.getReport(record.id);
        const createdAt = existing?.createdAt ?? record.createdAt ?? nowIso();
        const updatedAt = record.updatedAt ?? nowIso();
        const merged = {
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
    async writePdf(id, bytes) {
        await ensureDir(this.pdfDir);
        const p = this.getPdfPath(id);
        await fs.writeFile(p, bytes);
        return p;
    }
}
