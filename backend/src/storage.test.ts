import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FileStore, type IndexFile, type ReportRecord } from "./storage.js";

async function makeTempStore() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "virus-storage-test-"));
  const dataDir = path.join(root, "data");
  await fs.mkdir(path.join(dataDir, "reports"), { recursive: true });
  return { root, dataDir, store: new FileStore(dataDir) };
}

async function writeReport(dataDir: string, report: ReportRecord) {
  await fs.writeFile(
    path.join(dataDir, "reports", `${report.id}.json`),
    JSON.stringify(report, null, 2),
    "utf-8",
  );
}

async function writeIndex(dataDir: string, index: IndexFile) {
  await fs.writeFile(
    path.join(dataDir, "reports", "index.json"),
    JSON.stringify(index, null, 2),
    "utf-8",
  );
}

test("readIndex 会在 report 文件比 index 更新时自动修复索引", async () => {
  const { root, dataDir, store } = await makeTempStore();

  try {
    const oldReport: ReportRecord = {
      id: "t20260313_315442",
      title: "2026 第10周",
      weekText: "2026 第10周",
      publishDate: "2026-03-12",
      htmlUrl: "https://example.com/old",
      pdfUrl: "https://example.com/old.pdf",
      htmlText: "old",
      pdfText: "old",
      ai: null,
      aiRaw: null,
      contentHash: "old",
      createdAt: "2026-03-13T04:00:50.589Z",
      updatedAt: "2026-03-13T04:00:50.589Z",
    };

    const newReport: ReportRecord = {
      id: "t20260416_1835083",
      title: "2026 第15周",
      weekText: "2026 第15周",
      publishDate: "2026-04-16",
      htmlUrl: "https://example.com/new",
      pdfUrl: "https://example.com/new.pdf",
      htmlText: "new",
      pdfText: "new",
      ai: { metrics: { week: 15 } },
      aiRaw: "{}",
      contentHash: "new",
      createdAt: "2026-04-16T08:03:55.327Z",
      updatedAt: "2026-04-16T10:02:54.396Z",
    };

    await writeReport(dataDir, oldReport);
    await writeReport(dataDir, newReport);
    await writeIndex(dataDir, {
      lastSyncAt: "2026-03-19T07:00:03.553Z",
      reports: [
        {
          id: oldReport.id,
          title: oldReport.title,
          publishDate: oldReport.publishDate,
          htmlUrl: oldReport.htmlUrl,
          pdfUrl: oldReport.pdfUrl,
          updatedAt: oldReport.updatedAt,
        },
      ],
    });

    const index = await store.readIndex();

    assert.equal(index.reports[0]?.id, newReport.id);
    assert.equal(index.reports.length, 1);
    assert.equal(index.lastSyncAt, newReport.updatedAt);

    const persisted = JSON.parse(
      await fs.readFile(path.join(dataDir, "reports", "index.json"), "utf-8"),
    ) as IndexFile;
    assert.equal(persisted.reports[0]?.id, newReport.id);
    assert.equal(persisted.lastSyncAt, newReport.updatedAt);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
