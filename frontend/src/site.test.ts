import test from 'node:test'
import assert from 'node:assert/strict'
import { AUTHOR_NAME, REPO_URL, SITE_TITLE } from './site.ts'

test('站点信息应指向 virus 仓库并展示作者信息', () => {
  assert.equal(SITE_TITLE, '流感监测站')
  assert.equal(REPO_URL, 'https://github.com/xvhuan/virus')
  assert.equal(AUTHOR_NAME, 'ius')
})
