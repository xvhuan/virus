import { fetchBytes, fetchText, parseWeeklyDetail, parseWeeklyList } from "./cdc.js";
import { extractPdfText } from "./pdf.js";
import { summarizeWeeklyReport } from "./llm.js";
import { sha256Hex } from "./utils.js";
export async function syncLatest(config, store, opts) {
    const limit = opts?.limit ?? 12;
    const llmConfigured = !!(config.LLM_BASE_URL && config.LLM_API_KEY && config.LLM_MODEL);
    const headers = {
        "user-agent": config.HTTP_USER_AGENT,
        "accept-language": "zh-CN,zh;q=0.9",
        referer: config.HTTP_REFERER,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };
    const listHtml = await fetchText(config.LIST_URL, headers, 30_000);
    const list = parseWeeklyList(config.LIST_URL, listHtml).slice(0, limit);
    // 并行处理，提高同步速度（限制并发数避免被封）
    const CONCURRENCY = 5;
    let updated = 0;
    const processItem = async (item) => {
        const existing = await store.getReport(item.id);
        const detailHtml = await fetchText(item.href, headers, 30_000);
        const detail = parseWeeklyDetail(item.href, detailHtml);
        const htmlHash = sha256Hex(detail.htmlText);
        const contentHash = sha256Hex(`${detail.title}\n${detail.publishDate}\n${detail.pdfUrl ?? ""}\n${htmlHash}`);
        const shouldUpdate = !existing || existing.contentHash !== contentHash;
        const needsAi = llmConfigured &&
            (!!shouldUpdate || existing?.ai === null || (existing?.aiRaw ?? "").startsWith("AI 总结失败"));
        if (!shouldUpdate && !needsAi)
            return false;
        let pdfText = existing?.pdfText ?? "";
        const needPdf = !!detail.pdfUrl && (existing?.pdfUrl !== detail.pdfUrl || !existing?.pdfText);
        if (detail.pdfUrl && needPdf) {
            const pdfBytes = await fetchBytes(detail.pdfUrl, headers, 60_000);
            await store.writePdf(item.id, pdfBytes);
            pdfText = await extractPdfText(pdfBytes);
        }
        let ai = null;
        let aiRaw = null;
        if (needsAi) {
            try {
                const r = await summarizeWeeklyReport(config, { htmlText: detail.htmlText, pdfText });
                ai = r.parsed;
                aiRaw = r.rawText;
            }
            catch (e) {
                ai = null;
                aiRaw = `AI 总结失败：${e?.message ?? String(e)}`;
            }
        }
        else {
            ai = existing?.ai ?? null;
            aiRaw = existing?.aiRaw ?? null;
        }
        await store.putReport({
            id: item.id,
            title: detail.title,
            weekText: detail.weekText,
            publishDate: detail.publishDate ?? item.publishDate,
            htmlUrl: item.href,
            pdfUrl: detail.pdfUrl,
            htmlText: detail.htmlText,
            pdfText,
            ai,
            aiRaw,
            contentHash,
        });
        return true;
    };
    // 分批并行处理
    for (let i = 0; i < list.length; i += CONCURRENCY) {
        const batch = list.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(processItem));
        updated += results.filter(Boolean).length;
    }
    const index = await store.readIndex();
    const all = await Promise.all(list.map(async (it) => {
        const r = await store.getReport(it.id);
        return r;
    }));
    const reports = all
        .filter((r) => !!r)
        .sort((a, b) => (b.publishDate ?? b.updatedAt).localeCompare(a.publishDate ?? a.updatedAt))
        .map((r) => ({
        id: r.id,
        title: r.title,
        publishDate: r.publishDate,
        htmlUrl: r.htmlUrl,
        pdfUrl: r.pdfUrl,
        updatedAt: r.updatedAt,
    }));
    const newIndex = { ...index, lastSyncAt: new Date().toISOString(), reports };
    await store.writeIndex(newIndex);
    return { checked: list.length, updated, latestId: reports[0]?.id ?? null };
}
