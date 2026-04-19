import test from "node:test";
import assert from "node:assert/strict";
import { buildApiUrl } from "./api.ts";

test("buildApiUrl 会给 API 请求附加缓存穿透版本号", () => {
  assert.equal(buildApiUrl("/api/index"), "/api/index?v=20260419-fix1");
  assert.equal(buildApiUrl("/api/series?foo=bar"), "/api/series?foo=bar&v=20260419-fix1");
});
