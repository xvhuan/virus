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

test("/api/series 在 AI 指标缺失时应回退解析历史周报指标", async () => {
  const index: IndexFile = {
    lastSyncAt: "2026-04-19T15:18:07.655Z",
    reports: [
      {
        id: "t20260326_315961",
        title: "2026 第12周",
        publishDate: "2026-03-26",
        htmlUrl: "https://example.com/r12",
        pdfUrl: "https://example.com/r12.pdf",
        updatedAt: "2026-04-19T15:06:03.278Z",
      },
    ],
  };

  const report: ReportRecord = {
    id: "t20260326_315961",
    title: "2026 第12周",
    weekText: "2026 第12周",
    publishDate: "2026-03-26",
    htmlUrl: "https://example.com/r12",
    pdfUrl: "https://example.com/r12.pdf",
    htmlText: "中国流感流行情况概要（截至2026年3月23日） 2026年第12周（2026年3月18日－2026年3月24日），南方省份哨点医院报告的ILI%为3.4%，北方省份哨点医院报告的ILI%为3.2%。",
    pdfText:
      "阳性数(%) 900(10.0%)700(14.0%)1600(12.0%) A(H1N1)pdm09 20(10.0%) 10(5.0%) 30(15.0%) A(H3N2) 40(20.0%) 30(15.0%) 70(35.0%) Victoria 840(100.0%)660(100.0%)1500(100.0%)",
    ai: null,
    aiRaw: "AI 总结失败：This operation was aborted",
    contentHash: "hash-r12",
    createdAt: "2026-03-26T08:00:00.000Z",
    updatedAt: "2026-04-19T15:06:03.278Z",
  };

  const store = {
    async readIndex() {
      return index;
    },
    async getReport(id: string) {
      return id === report.id ? report : null;
    },
  };

  const app = await buildServer(config, store as any);
  try {
    const res = await app.inject({ method: "GET", url: "/api/series" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.length, 1);
    assert.deepEqual(body[0], {
      id: "t20260326_315961",
      publishDate: "2026-03-26",
      ili_percent_south: 3.4,
      ili_percent_north: 3.2,
      ili_percent_national: null,
      positivity_overall: 12,
      positivity_a_h1n1: 1.9,
      positivity_a_h3n2: 4.4,
      positivity_b_victoria: 93.8,
    });
  } finally {
    await app.close();
  }
});
