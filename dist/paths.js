import path from "node:path";
import { fileURLToPath } from "node:url";
export const backendRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function resolveFromBackendRoot(p) {
    return path.resolve(backendRootDir, p);
}
