import crypto from "node:crypto";
export function sha256Hex(input) {
    const h = crypto.createHash("sha256");
    h.update(input);
    return h.digest("hex");
}
export function absolutizeUrl(base, href) {
    return new URL(href, base).toString();
}
export function stripHtmlToText(html) {
    const withoutScripts = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ");
    const text = withoutScripts
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<\/?p[^>]*>/gi, "\n")
        .replace(/<\/?div[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+\n/g, "\n")
        .replace(/\n\s+/g, "\n")
        .replace(/[ \\t\\f\\r]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    return text;
}
