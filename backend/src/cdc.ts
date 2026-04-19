import * as cheerio from "cheerio";
import { absolutizeUrl, stripHtmlToText } from "./utils.js";

export type WeeklyListItem = {
  title: string;
  publishDate: string | null; // YYYY-MM-DD
  href: string; // absolute html url
  id: string;
};

export type WeeklyDetail = {
  title: string;
  publishDate: string | null;
  pdfUrl: string | null;
  htmlText: string;
  weekText: string | null;
};

function parseIdFromUrl(url: string) {
  const m = url.match(/\/t(\d{8}_\d+)\.htm(?:l)?$/);
  if (m) return `t${m[1]}`;
  const u = new URL(url);
  const last = u.pathname.split("/").pop() ?? "";
  return last.replace(/\W+/g, "_") || `unknown_${Date.now()}`;
}

function normalizeWeekLabel(text: string | null | undefined) {
  if (!text) return null;
  const compact = text.replace(/\s+/g, "");
  const match = compact.match(/(\d{4})年?第(\d{1,2})周/);
  if (!match) return null;
  return `${match[1]} 第${Number(match[2])}周`;
}

function firstNonEmpty(values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function findFirstDate(values: Array<string | null | undefined>) {
  for (const value of values) {
    const text = value?.trim();
    if (!text) continue;
    const match = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  return null;
}

function extractLinkTitle($: cheerio.CheerioAPI, anchor: cheerio.Cheerio<any>) {
  const clone = anchor.clone();
  clone.find("span").remove();
  return clone.text().trim();
}

export async function fetchText(url: string, headers: Record<string, string>, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`请求失败 ${res.status}：${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchBytes(url: string, headers: Record<string, string>, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`请求失败 ${res.status}：${url}`);
    const ab = await res.arrayBuffer();
    return new Uint8Array(ab);
  } finally {
    clearTimeout(t);
  }
}

export function parseWeeklyList(listUrl: string, html: string): WeeklyListItem[] {
  const $ = cheerio.load(html);
  const items: WeeklyListItem[] = [];
  const seen = new Set<string>();
  const rows = $(".erji_list1 ul li, .xw_list li").toArray();

  for (const row of rows) {
    const a = $(row).find("a").first();
    const href = a.attr("href");
    if (!href) continue;

    const abs = absolutizeUrl(listUrl, href);
    if (seen.has(abs)) continue;

    const rawTitle = firstNonEmpty([extractLinkTitle($, a), a.text()]);
    const title = normalizeWeekLabel(rawTitle) ?? rawTitle;
    const publishDate = findFirstDate([
      $(row).find(".span_02").first().text(),
      a.find("span").first().text(),
      $(row).text(),
    ]);

    if (!title) continue;
    seen.add(abs);
    items.push({ title, publishDate, href: abs, id: parseIdFromUrl(abs) });
  }

  return items;
}

export function parseWeeklyDetail(detailUrl: string, html: string): WeeklyDetail {
  const $ = cheerio.load(html);
  const rawTitle = firstNonEmpty([
    $(".erji_text1 .zw_text h3").first().text(),
    $(".containerBox .left h5 a").first().text(),
    $(".containerBox .left h5").first().text(),
    $("h1").first().text(),
    $("h3").first().text(),
    $("title").text(),
    "流感周报",
  ]);
  const title = normalizeWeekLabel(rawTitle) ?? rawTitle;

  const publishDate = findFirstDate([
    $(".erji_text1 .zw_text h5").first().text(),
    $(".xqCon .fb em").first().text(),
    $(".xqCon .fb").first().text(),
    $(".xqCon").first().text(),
    html,
  ]);

  const pdfHref = firstNonEmpty(
    $(".erji_text1 .zw_text a, .wzFooter a, a")
      .toArray()
      .map((el) => $(el).attr("href"))
      .filter((href): href is string => !!href && /\.pdf(?:$|\?)/i.test(href)),
  );
  const pdfUrl = pdfHref ? absolutizeUrl(detailUrl, pdfHref) : null;

  const contentHtml = firstNonEmpty([
    $(".TRS_Editor").first().html(),
    $("#articleCon").first().html(),
    $(".content").first().html(),
    html,
  ]);
  const htmlText = stripHtmlToText(contentHtml);
  const weekText = normalizeWeekLabel(rawTitle) ?? title;
  return { title, publishDate, pdfUrl, htmlText, weekText };
}
