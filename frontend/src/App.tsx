import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import ReactECharts from 'echarts-for-react'
import { Activity, Calendar, Shield, AlertTriangle, ExternalLink, FileText, TrendingUp, ClipboardList, Clock, Pill, Microscope, MapPin, Syringe, Github } from 'lucide-react'
import './App.css'
import { buildApiUrl } from './api'
import { AUTHOR_NAME, REPO_URL, SITE_TITLE } from './site'

type IndexItem = {
  id: string
  title: string
  publishDate: string | null
  updatedAt: string
}

type ReportRecord = {
  id: string
  title: string
  publishDate: string | null
  htmlUrl: string
  pdfUrl: string | null
  ai: any | null
  updatedAt: string
}

type SeriesRow = {
  id: string
  publishDate: string | null
  ili_percent_national: number | null
  ili_percent_south: number | null
  ili_percent_north: number | null
  positivity_overall: number | null
  positivity_a_h1n1: number | null
  positivity_a_h3n2: number | null
  positivity_b_victoria: number | null
}

function fmt(v: any) {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

function fmtBeijingTime(v: string | null | undefined) {
  if (!v) return '—'
  try {
    const d = new Date(v)
    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
  } catch {
    return v
  }
}


function App() {
  const [index, setIndex] = useState<{ lastSyncAt: string | null; reports: IndexItem[] } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [report, setReport] = useState<ReportRecord | null>(null)
  const [series, setSeries] = useState<SeriesRow[]>([])
  const [loading, setLoading] = useState(false)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const idx = await fetch(buildApiUrl('/api/index')).then((r) => r.json())
      setIndex(idx)
      const latestId = idx?.reports?.[0]?.id ?? null
      setSelectedId((prev) => prev ?? latestId)
      const rows = await fetch(buildApiUrl('/api/series')).then((r) => r.json())
      setSeries(rows)
    } finally {
      setLoading(false)
    }
  }

  async function loadReport(id: string) {
    const r = await fetch(buildApiUrl(`/api/reports/${encodeURIComponent(id)}`)).then((rr) => rr.json())
    setReport(r)
  }

  useEffect(() => {
    void loadAll()
    const t = window.setInterval(() => void loadAll(), 5 * 60_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!selectedId) return
    void loadReport(selectedId)
  }, [selectedId])

  const latestAi = report?.ai ?? null
  const metrics = latestAi?.metrics ?? null
  const situation = latestAi?.situation_now ?? null
  const trends = latestAi?.trends ?? null
  const summaryMd: string = latestAi?.summary_md ?? '暂无数据'
  const antigenicity = latestAi?.antigenicity ?? null
  const drugResistance = latestAi?.drug_resistance ?? null

  const x = useMemo(() => {
    return series.map((r) => (r.publishDate ? r.publishDate : r.id))
  }, [series])

  const isMobile = windowWidth < 600

  const chartOption = useMemo(() => {
    const line = (name: string, arr: Array<number | null>) => ({
      name, type: 'line', smooth: true, showSymbol: false,
      data: arr.map((v) => (v === null ? null : v)),
    })
    return {
      tooltip: { trigger: 'axis', confine: true },
      legend: {
        bottom: 0,
        left: 'center',
        textStyle: { color: '#374151', fontSize: isMobile ? 10 : 12 },
        itemGap: isMobile ? 8 : 16,
        itemWidth: isMobile ? 16 : 25,
        type: isMobile ? 'scroll' : 'plain',
      },
      grid: { left: isMobile ? 40 : 50, right: 15, top: 15, bottom: isMobile ? 60 : 50, containLabel: false },
      xAxis: {
        type: 'category',
        data: x,
        axisLabel: { color: '#6b7280', fontSize: isMobile ? 9 : 10, rotate: isMobile ? 45 : 0, interval: 'auto' },
        axisLine: { lineStyle: { color: '#e5e7eb' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#6b7280', fontSize: isMobile ? 10 : 12 },
        splitLine: { lineStyle: { color: '#f3f4f6' } },
        axisLine: { show: false },
      },
      series: [
        line('总阳性率', series.map((r) => r.positivity_overall)),
        line('甲型H1N1占比', series.map((r) => r.positivity_a_h1n1)),
        line('甲型H3N2占比', series.map((r) => r.positivity_a_h3n2)),
        line('乙型Victoria占比', series.map((r) => r.positivity_b_victoria)),
      ],
      color: ['#6366f1', '#f59e0b', '#10b981', '#ec4899'],
    }
  }, [series, x, isMobile])

  const iliOption = useMemo(() => {
    return {
      tooltip: { trigger: 'axis', confine: true },
      legend: {
        bottom: 0,
        left: 'center',
        textStyle: { color: '#374151', fontSize: isMobile ? 10 : 12 },
        itemGap: isMobile ? 8 : 16,
        itemWidth: isMobile ? 16 : 25,
        type: isMobile ? 'scroll' : 'plain',
      },
      grid: { left: isMobile ? 40 : 50, right: 15, top: 15, bottom: isMobile ? 60 : 50, containLabel: false },
      xAxis: {
        type: 'category',
        data: x,
        axisLabel: { color: '#6b7280', fontSize: isMobile ? 9 : 10, rotate: isMobile ? 45 : 0, interval: 'auto' },
        axisLine: { lineStyle: { color: '#e5e7eb' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#6b7280', fontSize: isMobile ? 10 : 12 },
        splitLine: { lineStyle: { color: '#f3f4f6' } },
        axisLine: { show: false },
      },
      series: [
        { name: '南方', type: 'line', smooth: true, showSymbol: false, data: series.map((r) => r.ili_percent_south) },
        { name: '北方', type: 'line', smooth: true, showSymbol: false, data: series.map((r) => r.ili_percent_north) },
        { name: '全国', type: 'line', smooth: true, showSymbol: false, data: series.map((r) => r.ili_percent_national) },
      ],
      color: ['#f97316', '#3b82f6', '#8b5cf6'],
    }
  }, [series, x, isMobile])


  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <div className="header-left">
            <div className="logo"><Activity size={24} /></div>
            <div className="title">
              <h1>{SITE_TITLE}</h1>
              <div className="sub">
                <Clock size={12} />
                <span>{loading ? '加载中…' : `同步于 ${fmtBeijingTime(index?.lastSyncAt)}`}</span>
                <span className="divider">·</span>
                <span>数据来源：国家流感中心周报</span>
              </div>
            </div>
          </div>
          <div className="header-right">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="repo-link"
              aria-label="访问 GitHub 仓库"
              title="访问 GitHub 仓库"
            >
              <Github size={18} />
            </a>
            <div className="author-text">作者: {AUTHOR_NAME}</div>
          </div>
        </header>

        <div className="grid">
          <div className="panel">
            <div className="panel-header">
              <h2><Activity size={18} /> 当前态势</h2>
            </div>
            <div className="kpis">
              <div className="kpi blue">
                <div className="kpi-icon"><Calendar size={20} /></div>
                <div className="kpi-content">
                  <div className="label">监测周次</div>
                  <div className="value">{fmt(metrics?.year)} 年第 {fmt(metrics?.week)} 周</div>
                  <div className="hint">发布：{fmt(metrics?.publish_date ?? report?.publishDate)}</div>
                </div>
              </div>
              <div className="kpi green">
                <div className="kpi-icon"><Shield size={20} /></div>
                <div className="kpi-content">
                  <div className="label">数据截至</div>
                  <div className="value">{fmt(metrics?.as_of_date)}</div>
                </div>
              </div>
              <div className="kpi orange">
                <div className="kpi-icon"><AlertTriangle size={20} /></div>
                <div className="kpi-content">
                  <div className="label">暴发疫情</div>
                  <div className="value">{fmt(situation?.outbreaks_reported)} 起</div>
                </div>
              </div>
            </div>

            {latestAi?.risk_level && (() => {
              const raw = latestAi.risk_level as string
              const level = raw.includes('极高') ? '极高' : raw.includes('高') ? '高' : raw.includes('中') ? '中' : '低'
              const display = level === '低' ? '🟢 低风险' : level === '中' ? '🟡 中风险' : level === '高' ? '🟠 高风险' : '🔴 极高风险'
              return (
                <div className={`risk-banner risk-${level}`}>
                  <div className="risk-level">
                    <span className="risk-label">当前感染风险</span>
                    <span className="risk-value">{display}</span>
                  </div>
                  {latestAi.risk_advice && <div className="risk-advice">{latestAi.risk_advice}</div>}
                </div>
              )
            })()}

            <div className="links">
              {report?.htmlUrl && (
                <a href={report.htmlUrl} target="_blank" rel="noreferrer" className="link-btn">
                  <ExternalLink size={14} /> 官方网页
                </a>
              )}
              {report?.pdfUrl && (
                <a href={`/pdfs/${report.id}.pdf`} target="_blank" rel="noreferrer" className="link-btn">
                  <FileText size={14} /> 查看 PDF
                </a>
              )}
            </div>

            <div className="summary-section">
              <h3>本周概要</h3>
              <div className="md"><ReactMarkdown>{summaryMd}</ReactMarkdown></div>
              {Array.isArray(latestAi?.highlights) && latestAi.highlights.length > 0 && (
                <div className="highlights">
                  <h4>要点速览</h4>
                  <ul>
                    {latestAi.highlights.slice(0, 5).map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

          </div>

          <div className="panel">
            <div className="panel-header">
              <h2><ClipboardList size={18} /> 历史周报</h2>
            </div>
            <div className="list">
              {(index?.reports ?? []).map((r) => (
                <div
                  key={r.id}
                  className={`item ${r.id === selectedId ? 'active' : ''}`}
                  onClick={() => setSelectedId(r.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="item-main">
                    <div className="item-title">{r.title}</div>
                    <div className="item-meta">发布：{fmt(r.publishDate)}</div>
                  </div>

                </div>
              ))}
              {!index?.reports?.length && !loading && (
                <div className="empty-state">暂无数据，等待后台同步</div>
              )}
            </div>
          </div>
        </div>

        {/* 病毒学监测：独立panel */}
        {(situation?.dominant_strains?.length > 0 || antigenicity || drugResistance) && (
          <div className="panel virology-panel">
            <div className="panel-header">
              <h2><Microscope size={18} /> 病毒学监测</h2>
            </div>
            <div className="virology-grid">
              {/* 优势毒株 */}
              {situation?.dominant_strains?.length > 0 && (
                <div className="virology-card">
                  <div className="virology-label"><MapPin size={14} /> 优势毒株</div>
                  <div className="strain-tags">
                    {situation.dominant_strains.map((s: string, i: number) => (
                      <span key={i} className="strain-tag">{s}</span>
                    ))}
                  </div>
                  {trends?.north_vs_south && (
                    <div className="virology-note">{trends.north_vs_south}</div>
                  )}
                </div>
              )}
              {/* 疫苗匹配度 */}
              {antigenicity && (
                <div className="virology-card">
                  <div className="virology-label"><Syringe size={14} /> 疫苗匹配度</div>
                  <div className="match-list">
                    {antigenicity.h1n1_match && <div className="match-row"><span>H1N1</span><span className="match-val">{antigenicity.h1n1_match}</span></div>}
                    {antigenicity.h3n2_match && <div className="match-row"><span>H3N2</span><span className="match-val">{antigenicity.h3n2_match}</span></div>}
                    {antigenicity.b_victoria_match && <div className="match-row"><span>B/Vic</span><span className="match-val">{antigenicity.b_victoria_match}</span></div>}
                  </div>
                  {antigenicity.summary && <div className="virology-note">{antigenicity.summary}</div>}
                </div>
              )}
              {/* 耐药性 */}
              {drugResistance && (
                <div className="virology-card">
                  <div className="virology-label"><Pill size={14} /> 药物敏感性</div>
                  <div className="match-list">
                    {drugResistance.neuraminidase_inhibitors && <div className="match-row"><span>奥司他韦等</span><span className="match-val green">{drugResistance.neuraminidase_inhibitors}</span></div>}
                    {drugResistance.polymerase_inhibitors && <div className="match-row"><span>玛巴洛沙韦</span><span className="match-val green">{drugResistance.polymerase_inhibitors}</span></div>}
                  </div>
                  {drugResistance.summary && <div className="virology-note">{drugResistance.summary}</div>}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="panel chart-panel">
          <div className="panel-header">
            <h2><TrendingUp size={18} /> 趋势分析</h2>
          </div>
          <div className="charts-grid">
            <div className="chart-box">
              <h3>阳性率与病毒亚型分布</h3>
              <p className="chart-desc">总阳性率=检测阳性/总检测数；亚型占比=该亚型/阳性总数</p>
              <ReactECharts style={{ height: '300px' }} option={chartOption} notMerge />
            </div>
            <div className="chart-box">
              <h3>流感样病例就诊比例 (ILI%)</h3>
              <p className="chart-desc">门急诊中流感样病例占比，反映就诊压力</p>
              <ReactECharts style={{ height: '300px' }} option={iliOption} notMerge />
            </div>
          </div>
        </div>

        <div className="panel drug-panel">
          <div className="panel-header">
            <h2><Pill size={18} /> 防护与用药建议</h2>
          </div>
          <div className="drug-grid">
            <div className="drug-section">
              <h3>一般建议</h3>
              <ul>
                <li>出现发热、咳嗽等症状时注意休息，多饮水</li>
                <li>保持室内空气流通，勤洗手</li>
                <li>高风险人群（老人、儿童、孕妇、慢性病患者）症状加重应及时就医</li>
                <li>流感高发期避免前往人群密集场所，必要时佩戴口罩</li>
              </ul>
            </div>
            <div className="drug-section">
              <h3>抗病毒药物（需遵医嘱）</h3>
              <ul>
                <li><strong>神经氨酸酶抑制剂</strong>：奥司他韦（达菲）、扎那米韦、帕拉米韦</li>
                <li><strong>聚合酶抑制剂</strong>：玛巴洛沙韦（速福达）</li>
                <li>发病 48 小时内使用效果最佳</li>
              </ul>
            </div>
          </div>
          <div className="drug-disclaimer">
            ⚠️ 以上信息仅供参考，不构成医疗建议或处方。如需用药请咨询医生或药师。
          </div>
        </div>

        <footer className="footer">
          <p>数据来源：中国国家流感中心 · 仅供参考，不构成医疗建议</p>
        </footer>
      </div>
    </div>
  )
}

export default App
