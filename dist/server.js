import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import fs from "node:fs/promises";
import path from "node:path";
import { syncLatest } from "./sync.js";
import { resolveFromBackendRoot } from "./paths.js";
export async function buildServer(config, store) {
    const app = Fastify({ logger: true });
    await app.register(cors, { origin: true });
    // 静态提供已下载的 PDF
    await app.register(fastifyStatic, {
        root: path.join(resolveFromBackendRoot(config.DATA_DIR), "pdfs"),
        prefix: "/pdfs/",
        decorateReply: false,
    });
    // 生产环境：托管前端静态文件（构建后在 backend/public 目录）
    const frontendDist = resolveFromBackendRoot("public");
    try {
        const stat = await fs.stat(frontendDist);
        if (stat.isDirectory()) {
            await app.register(fastifyStatic, {
                root: frontendDist,
                prefix: "/",
                decorateReply: true,
            });
            app.setNotFoundHandler(async (req, reply) => {
                if (req.url.startsWith("/api/") || req.url === "/api" || req.url.startsWith("/pdfs/")) {
                    return reply.code(404).send({ error: "Not Found" });
                }
                return reply.sendFile("index.html");
            });
        }
    }
    catch {
        // ignore
    }
    app.get("/api/health", async () => ({ ok: true }));
    // 返回索引（只返回前端需要的字段）
    app.get("/api/index", async () => {
        const index = await store.readIndex();
        return {
            lastSyncAt: index.lastSyncAt,
            reports: index.reports.map((r) => ({
                id: r.id,
                title: r.title,
                publishDate: r.publishDate,
                updatedAt: r.updatedAt,
            })),
        };
    });
    // 返回单个报告详情（只返回前端需要的字段）
    app.get("/api/reports/:id", async (req, reply) => {
        const report = await store.getReport(req.params.id);
        if (!report)
            return reply.code(404).send({ error: "报告不存在" });
        // 只返回前端需要的字段，不返回 htmlText、pdfText、aiRaw 等大字段
        return {
            id: report.id,
            title: report.title,
            publishDate: report.publishDate,
            htmlUrl: report.htmlUrl,
            pdfUrl: report.pdfUrl,
            ai: report.ai,
            updatedAt: report.updatedAt,
        };
    });
    app.post("/api/sync", async () => {
        return await syncLatest(config, store, { limit: 20 });
    });
    // 返回图表数据（只返回绘图需要的字段）
    app.get("/api/series", async () => {
        const index = await store.readIndex();
        const reports = await Promise.all(index.reports.map((r) => store.getReport(r.id)));
        return reports
            .filter((r) => !!r)
            .map((r) => {
            const m = r.ai?.metrics;
            return {
                id: r.id,
                publishDate: r.publishDate,
                ili_percent_south: m?.ili_percent_south ?? null,
                ili_percent_north: m?.ili_percent_north ?? null,
                ili_percent_national: m?.ili_percent_national ?? null,
                positivity_overall: m?.positivity_overall ?? null,
                positivity_a_h1n1: m?.positivity_a_h1n1 ?? null,
                positivity_a_h3n2: m?.positivity_a_h3n2 ?? null,
                positivity_b_victoria: m?.positivity_b_victoria ?? null,
            };
        })
            .sort((a, b) => (a.publishDate ?? "").localeCompare(b.publishDate ?? ""));
    });
    return app;
}
