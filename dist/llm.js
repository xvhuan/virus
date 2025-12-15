import fs from "node:fs/promises";
import { resolveFromBackendRoot } from "./paths.js";
function mustGet(name, v) {
    if (!v)
        throw new Error(`缺少环境变量 ${name}，无法调用大模型`);
    return v;
}
function normalizeModelName(input) {
    const raw = input.trim();
    const key = raw.toLowerCase().replace(/[_\s]+/g, "-");
    // DeepSeek OpenAI 兼容常用模型名兼容
    if (key === "deepseek-chat" || key === "deepseekchat" || key === "deepseek-chat-v3" || key === "deepseek-v3") {
        return "deepseek-chat";
    }
    if (key === "deepseek-reasoner" || key === "deepseekreasoner" || key === "deepseek-r1") {
        return "deepseek-reasoner";
    }
    return raw;
}
function buildPrompt(template, vars) {
    let out = template;
    for (const [k, v] of Object.entries(vars)) {
        out = out.replaceAll(`{{${k}}}`, v);
    }
    return out;
}
export async function summarizeWeeklyReport(config, input) {
    const baseUrl = mustGet("LLM_BASE_URL", config.LLM_BASE_URL);
    const apiKey = mustGet("LLM_API_KEY", config.LLM_API_KEY);
    const model = normalizeModelName(mustGet("LLM_MODEL", config.LLM_MODEL));
    const promptPath = resolveFromBackendRoot("prompts/flu_weekly_summary.zh.md");
    const promptTpl = await fs.readFile(promptPath, "utf-8");
    const userPrompt = buildPrompt(promptTpl, {
        OFFICIAL_HTML_TEXT: input.htmlText.slice(0, 120_000),
        OFFICIAL_PDF_TEXT: input.pdfText.slice(0, 120_000),
    });
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), config.LLM_TIMEOUT_MS);
    try {
        const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
        const endpoint1 = new URL("chat/completions", base).toString();
        const endpoint2 = new URL("v1/chat/completions", base).toString();
        const doFetch = async (endpoint) => fetch(endpoint, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                temperature: 0.2,
                messages: [
                    { role: "system", content: "你是严谨的中文数据分析助手。" },
                    { role: "user", content: userPrompt },
                ],
            }),
            signal: controller.signal,
        });
        let res = await doFetch(endpoint1);
        // 兼容：有些 OpenAI 兼容网关要求 /v1 前缀
        if (res.status === 404)
            res = await doFetch(endpoint2);
        const bodyText = await res.text();
        if (!res.ok) {
            if (res.status === 400 && bodyText.includes("Model Not Exist")) {
                throw new Error(`大模型接口错误 400：Model Not Exist（请检查 LLM_MODEL）。DeepSeek 通常用 deepseek-chat 或 deepseek-reasoner；当前=${model}`);
            }
            throw new Error(`大模型接口错误 ${res.status}：${bodyText}`);
        }
        const json = JSON.parse(bodyText);
        const text = json?.choices?.[0]?.message?.content ??
            json?.choices?.[0]?.text ??
            "";
        const rawText = (text ?? "").trim();
        let parsed = null;
        try {
            parsed = JSON.parse(rawText);
        }
        catch {
            // 尝试从混入文本的回答中截取 JSON
            const start = rawText.indexOf("{");
            const end = rawText.lastIndexOf("}");
            if (start >= 0 && end > start) {
                try {
                    parsed = JSON.parse(rawText.slice(start, end + 1));
                }
                catch {
                    parsed = null;
                }
            }
            else {
                parsed = null;
            }
        }
        return { parsed, rawText };
    }
    finally {
        clearTimeout(t);
    }
}
