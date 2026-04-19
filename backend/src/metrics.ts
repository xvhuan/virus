import type { ReportRecord } from "./storage.js";

export type ReportMetrics = {
  year: number | null;
  week: number | null;
  publish_date: string | null;
  as_of_date: string | null;
  ili_percent_national: number | null;
  ili_percent_south: number | null;
  ili_percent_north: number | null;
  positivity_overall: number | null;
  positivity_a_h1n1: number | null;
  positivity_a_h3n2: number | null;
  positivity_b_victoria: number | null;
  positivity_b_yamagata: number | null;
};

function round1(value: number | null) {
  if (value === null || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}

function extractDateText(text: string) {
  const match = text.match(/截至\s*(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function extractWeekParts(title: string | null | undefined) {
  const match = title?.match(/(\d{4})\s*第(\d{1,2})周/);
  if (!match) return { year: null, week: null };
  return { year: Number(match[1]), week: Number(match[2]) };
}

function extractNumber(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function extractTableTotals(text: string, labelPattern: string) {
  const re = new RegExp(
    `${labelPattern}[\\s\\S]{0,80}?(\\d+)\\([\\d.]+%\\)[\\s\\S]{0,40}?(\\d+)\\([\\d.]+%\\)[\\s\\S]{0,40}?(\\d+)\\([\\d.]+%\\)`,
    "i",
  );
  const match = text.match(re);
  if (!match) return null;
  return {
    south: Number(match[1]),
    north: Number(match[2]),
    total: Number(match[3]),
  };
}

function normalizeSourceText(report: Pick<ReportRecord, "pdfText" | "htmlText">) {
  return `${report.pdfText ?? ""}\n${report.htmlText ?? ""}`.replace(/\s+/g, " ").trim();
}

export function extractMetricsFromReport(report: Pick<ReportRecord, "title" | "publishDate" | "pdfText" | "htmlText">) {
  const text = normalizeSourceText(report);
  if (!text) return null;

  const { year, week } = extractWeekParts(report.title);
  const asOfDate = extractDateText(text);
  const iliSouth = extractNumber(text, /南方省份[^。；]{0,120}?ILI%为(\d+(?:\.\d+)?)%/i);
  const iliNorth = extractNumber(text, /北方省份[^。；]{0,120}?ILI%为(\d+(?:\.\d+)?)%/i);

  const positivityTotals = extractTableTotals(text, String.raw`阳性数\(%\)`);
  const h1Totals = extractTableTotals(text, String.raw`A\(H1N1\)pdm09`);
  const h3Totals = extractTableTotals(text, String.raw`A\(H3N2\)`);
  const victoriaTotals = extractTableTotals(text, String.raw`Victoria`);

  const positiveTotal = positivityTotals?.total ?? null;
  const positivityOverall = positivityTotals ? round1(extractNumber(text, /阳性数\(%\)[\s\S]{0,120}?\d+\([\d.]+%\)[\s\S]{0,40}?\d+\([\d.]+%\)[\s\S]{0,40}?\d+\(([\d.]+)%\)/i)) : null;

  const positivityAH1N1 = positiveTotal && h1Totals ? round1((h1Totals.total / positiveTotal) * 100) : null;
  const positivityAH3N2 = positiveTotal && h3Totals ? round1((h3Totals.total / positiveTotal) * 100) : null;
  const positivityBVictoria = positiveTotal && victoriaTotals ? round1((victoriaTotals.total / positiveTotal) * 100) : null;

  const hasAny = [iliSouth, iliNorth, positivityOverall, positivityAH1N1, positivityAH3N2, positivityBVictoria].some(
    (value) => value !== null,
  );
  if (!hasAny) return null;

  return {
    year,
    week,
    publish_date: report.publishDate ?? null,
    as_of_date: asOfDate,
    ili_percent_national: null,
    ili_percent_south: iliSouth,
    ili_percent_north: iliNorth,
    positivity_overall: positivityOverall,
    positivity_a_h1n1: positivityAH1N1,
    positivity_a_h3n2: positivityAH3N2,
    positivity_b_victoria: positivityBVictoria,
    positivity_b_yamagata: null,
  } satisfies ReportMetrics;
}
