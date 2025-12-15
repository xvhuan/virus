import * as cheerio from "cheerio";
import { absolutizeUrl, stripHtmlToText } from "./utils.js";
function parseIdFromUrl(url) {
    const m = url.match(/\/t(\d{8}_\d+)\.htm$/);
    if (m)
        return `t${m[1]}`;
    const u = new URL(url);
    const last = u.pathname.split("/").pop() ?? "";
    return last.replace(/\W+/g, "_") || `unknown_${Date.now()}`;
}
export async function fetchText(url, headers, timeoutMs) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { headers, signal: controller.signal });
        if (!res.ok)
            throw new Error(`请求失败 ${res.status}：${url}`);
        return await res.text();
    }
    finally {
        clearTimeout(t);
    }
}
export async function fetchBytes(url, headers, timeoutMs) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { headers, signal: controller.signal });
        if (!res.ok)
            throw new Error(`请求失败 ${res.status}：${url}`);
        const ab = await res.arrayBuffer();
        return new Uint8Array(ab);
    }
    finally {
        clearTimeout(t);
    }
}
export function parseWeeklyList(listUrl, html) {
    const $ = cheerio.load(html);
    const items = [];
    $(".erji_list1 ul li").each((_, li) => {
        const a = $(li).find("a").first();
        const title = a.text().trim();
        const href = a.attr("href");
        const dateText = $(li).find(".span_02").text().trim();
        const publishDate = dateText.match(/\((\d{4}-\d{2}-\d{2})\)/)?.[1] ?? null;
        if (!title || !href)
            return;
        const abs = absolutizeUrl(listUrl, href);
        items.push({ title, publishDate, href: abs, id: parseIdFromUrl(abs) });
    });
    return items;
}
export function parseWeeklyDetail(detailUrl, html) {
    const $ = cheerio.load(html);
    const title = $(".erji_text1 .zw_text h3").first().text().trim() || $("title").text().trim() || "流感周报";
    const h5 = $(".erji_text1 .zw_text h5").first().text();
    const publishDate = h5.match(/发布时间：\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
    const pdfHref = $(".erji_text1 .zw_text a")
        .toArray()
        .map((el) => $(el).attr("href"))
        .find((h) => !!h && /\.pdf$/i.test(h ?? ""));
    const pdfUrl = pdfHref ? absolutizeUrl(detailUrl, pdfHref) : null;
    const editor = $(".TRS_Editor").first();
    const htmlText = stripHtmlToText(editor.length ? editor.html() ?? "" : html);
    const weekText = title;
    return { title, publishDate, pdfUrl, htmlText, weekText };
}
