import "dotenv/config";
import { loadConfig } from "../config.js";
import { FileStore } from "../storage.js";
import { syncLatest } from "../sync.js";
import { resolveFromBackendRoot } from "../paths.js";
async function main() {
    const config = loadConfig(process.env);
    const store = new FileStore(resolveFromBackendRoot(config.DATA_DIR));
    const r = await syncLatest(config, store, { limit: 8 });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(r, null, 2));
}
main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
});
