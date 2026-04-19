import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWeeklyDetail, parseWeeklyList } from './cdc.js';

const NEW_LIST_HTML = `
<div class="erjiRightBox">
  <ul class="xw_list">
    <li>
      <dl>
        <dd>
          <a href="./202604/t20260416_1835095.html" target="_blank">
            2026年第15周第904期中国流感监测周报
            <span>2026-04-16 </span>
          </a>
          <p class="zy">摘要</p>
        </dd>
      </dl>
    </li>
  </ul>
</div>`;

const NEW_DETAIL_HTML = `
<div class="containerBox clearfix">
  <div class="left fl">
    <h5><a>2026年第15周第904期中国流感监测周报</a></h5>
    <div class="xqCon clearfix">
      <span class="fb">时间：<em>2026-04-16</em></span>
    </div>
    <div class="content" id="articleCon">
      <p>中国流感流行情况概要（截至2026年4月12日）</p>
    </div>
    <div class="wzFooter clearfix">
      <ul class="fl">
        <li><a href="./P020260416786755852879.pdf">2026年第15周第904期中国流感监测周报.pdf</a></li>
      </ul>
    </div>
  </div>
</div>`;

const LEGACY_LIST_HTML = `
<div class="erji_list1">
  <ul>
    <li>
      <a href="./202604/t20260416_1835083.htm">2026年第15周流感监测周报</a>
      <span class="span_02">(2026-04-16)</span>
    </li>
  </ul>
</div>`;

test('parseWeeklyList 兼容中国疾控中心新周报列表结构', () => {
  const items = parseWeeklyList('https://www.chinacdc.cn/jksj/jksj04_14249/', NEW_LIST_HTML);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    id: 't20260416_1835095',
    title: '2026 第15周',
    publishDate: '2026-04-16',
    href: 'https://www.chinacdc.cn/jksj/jksj04_14249/202604/t20260416_1835095.html',
  });
});

test('parseWeeklyDetail 兼容中国疾控中心新周报详情结构', () => {
  const detail = parseWeeklyDetail(
    'https://www.chinacdc.cn/jksj/jksj04_14249/202604/t20260416_1835095.html',
    NEW_DETAIL_HTML,
  );

  assert.equal(detail.title, '2026 第15周');
  assert.equal(detail.publishDate, '2026-04-16');
  assert.equal(detail.pdfUrl, 'https://www.chinacdc.cn/jksj/jksj04_14249/202604/P020260416786755852879.pdf');
  assert.match(detail.htmlText, /截至2026年4月12日/);
  assert.equal(detail.weekText, '2026 第15周');
});

test('parseWeeklyList 保持兼容旧国家流感中心列表结构', () => {
  const items = parseWeeklyList('https://ivdc.chinacdc.cn/cnic/zyzx/lgzb/', LEGACY_LIST_HTML);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    id: 't20260416_1835083',
    title: '2026 第15周',
    publishDate: '2026-04-16',
    href: 'https://ivdc.chinacdc.cn/cnic/zyzx/lgzb/202604/t20260416_1835083.htm',
  });
});
