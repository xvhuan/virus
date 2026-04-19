import test from "node:test";
import assert from "node:assert/strict";
import { buildServer } from "./server.js";
import type { AppConfig } from "./config.js";
import type { IndexFile, ReportRecord } from "./storage.js";

const config: AppConfig = {
  PORT: 8787,
  DATA_DIR: "./data",
  LIST_URL: "https://example.com/list",
  SYNC_CRON: "0 8 * * *",
  HTTP_USER_AGENT: "test-agent",
  HTTP_REFERER: "https://example.com",
  LLM_TIMEOUT_MS: 60_000,
};

function makeStore() {
  const index: IndexFile = {
    lastSyncAt: "2026-04-16T10:02:54.396Z",
    reports: [
      {
        id: "t20260416_1835083",
        title: "2026 第15周",
        publishDate: "2026-04-16",
        htmlUrl: "https://example.com/report",
        pdfUrl: "https://example.com/report.pdf",
        updatedAt: "2026-04-16T10:02:54.396Z",
      },
    ],
  };

  const report: ReportRecord = {
    id: "t20260416_1835083",
    title: "2026 第15周",
    weekText: "2026 第15周",
    publishDate: "2026-04-16",
    htmlUrl: "https://example.com/report",
    pdfUrl: "https://example.com/report.pdf",
    htmlText: "html",
    pdfText: "pdf",
    ai: { metrics: { week: 15 } },
    aiRaw: "{}",
    contentHash: "hash",
    createdAt: "2026-04-16T08:03:55.327Z",
    updatedAt: "2026-04-16T10:02:54.396Z",
  };

  return {
    async readIndex() {
      return index;
    },
    async getReport(id: string) {
      return id === report.id ? report : null;
    },
  };
}

test("API 响应应该禁用缓存，避免旧索引被 CDN 卡住", async () => {
  const app = await buildServer(config, makeStore() as any);

  try {
    const indexRes = await app.inject({ method: "GET", url: "/api/index" });
    const seriesRes = await app.inject({ method: "GET", url: "/api/series" });

    assert.equal(indexRes.statusCode, 200);
    assert.equal(seriesRes.statusCode, 200);
    assert.equal(indexRes.headers["cache-control"], "no-store");
    assert.equal(seriesRes.headers["cache-control"], "no-store");
  } finally {
    await app.close();
  }
});
