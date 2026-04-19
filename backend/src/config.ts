import { z } from "zod";

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  DATA_DIR: z.string().default("./data"),
  LIST_URL: z.string().url().default("https://www.chinacdc.cn/jksj/jksj04_14249/"),
  SYNC_CRON: z.string().default("0 8 * * *"),
  HTTP_USER_AGENT: z
    .string()
    .default(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ),
  HTTP_REFERER: z.string().default("https://www.chinacdc.cn/"),
  LLM_BASE_URL: z.string().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`配置解析失败：\n${msg}`);
  }
  return parsed.data;
}

