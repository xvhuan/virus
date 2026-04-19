import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf-8')
}

test('首页 HTML 标题和 favicon 不能退回默认 frontend/vite', () => {
  const sourceHtml = read('index.html')
  const builtHtml = read('../backend/public/index.html')

  for (const html of [sourceHtml, builtHtml]) {
    assert.match(html, /<title>流感监测站<\/title>/)
    assert.doesNotMatch(html, /<title>frontend<\/title>/)
    assert.doesNotMatch(html, /href="\/vite\.svg"/)
  }
})
