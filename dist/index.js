import "dotenv/config";
import cron from "node-cron";
import { loadConfig } from "./config.js";
import { FileStore } from "./storage.js";
import { buildServer } from "./server.js";
import { syncLatest } from "./sync.js";
import { resolveFromBackendRoot } from "./paths.js";
async function main() {
    const config = loadConfig(process.env);
    const store = new FileStore(resolveFromBackendRoot(config.DATA_DIR));
    const app = await buildServer(config, store);
    // 先启动服务器，再异步同步数据（避免阻塞启动）
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    app.log.info(`服务器已启动: http://localhost:${config.PORT}`);
    // 启动后异步检查一次（不阻塞）- 首次获取更多历史数据
    syncLatest(config, store, { limit: 10 }).catch((e) => {
        app.log.warn({ err: e }, "启动时同步失败（可忽略，稍后会自动重试/手动刷新）");
    });
    // 定时任务只检查最新几周（已有数据不会重复处理）
    cron.schedule(config.SYNC_CRON, async () => {
        try {
            await syncLatest(config, store, { limit: 8 });
            app.log.info("定时同步完成");
        }
        catch (e) {
            app.log.warn({ err: e }, "定时同步失败");
        }
    });
}
main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
});
