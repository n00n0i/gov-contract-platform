import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, FileText, Users, DollarSign,
  Calendar, Download, Filter, PieChart, BarChart3,
  Activity, Clock, AlertTriangle, CheckCircle,
  Printer, RefreshCw, Building2
} from 'lucide-react'
import NavigationHeader from '../components/NavigationHeader'
import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1' })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Types ─────────────────────────────────────────────────────────────────────
interface ContractSummary {
  total_contracts: number
  active_contracts: number
  pending_approval: number
  draft: number
  completed: number
  terminated: number
  expiring_soon: number
  total_value: number
}

interface MonthlyData { month: string; month_full: string; count: number; value: number }
interface TypeItem    { type: string; label: string; count: number; value: number }
interface ExpiringItem { id: string; number: string; title: string; value: number; end_date: string; days_left: number; vendor_name?: string }
interface TopVendor   { name: string; contracts: number; value: number }

interface ReportData {
  monthly: MonthlyData[]
  type_distribution: TypeItem[]
  expiring_contracts: ExpiringItem[]
  top_vendors: TopVendor[]
  status_summary: Record<string, number>
}

interface VendorStats { total_vendors: number; active_vendors: number; blacklisted_vendors: number }

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(v)
const fmtN = (v: number) => new Intl.NumberFormat('th-TH').format(v)
const fmtM = (v: number) => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)} พันล.`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} ล.`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)} K`
  return fmtN(v)
}

const TYPE_COLORS = [
  'bg-blue-500','bg-green-500','bg-purple-500','bg-indigo-500','bg-yellow-500',
  'bg-red-500','bg-gray-500','bg-pink-500','bg-teal-500','bg-cyan-500',
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function Reports() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState('year')
  const [activeTab, setActiveTab] = useState<'overview' | 'contracts' | 'vendors' | 'financial'>('overview')

  const [summary, setSummary] = useState<ContractSummary | null>(null)
  const [report, setReport] = useState<ReportData | null>(null)
  const [vendorStats, setVendorStats] = useState<VendorStats | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryRes, reportRes, vendorRes] = await Promise.all([
        api.get('/contracts/stats/summary'),
        api.get('/contracts/stats/report'),
        api.get('/vendors/stats/summary'),
      ])
      if (summaryRes.data.success) setSummary(summaryRes.data.data)
      if (reportRes.data.success)  setReport(reportRes.data.data)
      if (vendorRes.data.success)  setVendorStats(vendorRes.data.data)
    } catch {
      setError('ไม่สามารถโหลดข้อมูลรายงานได้ กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Bar chart ────────────────────────────────────────────────────────────
  const renderBarChart = (data: MonthlyData[], valueKey: 'count' | 'value', color: string) => {
    const max = Math.max(...data.map(d => d[valueKey]), 1)
    return (
      <div className="h-52 flex items-end justify-between gap-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded
                            opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
              {valueKey === 'value' ? fmtM(d.value) : `${d.count} สัญญา`}
            </div>
            <div
              className={`w-full ${color} rounded-t transition-all hover:opacity-80`}
              style={{ height: `${Math.max((d[valueKey] / max) * 100, d[valueKey] > 0 ? 4 : 0)}%` }}
            />
            <span className="text-xs text-gray-500 truncate w-full text-center">{d.month}</span>
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        <p className="text-gray-500 text-sm">กำลังโหลดรายงาน...</p>
      </div>
    )
  }

  const monthly = report?.monthly ?? []
  const expiring = report?.expiring_contracts ?? []
  const topVendors = report?.top_vendors ?? []
  const typeDistrib = report?.type_distribution ?? []

  return (
    <div className="min-h-screen bg-slate-50">
      <NavigationHeader
        title="รายงานและสถิติ"
        subtitle="Reports & Analytics"
        breadcrumbs={[{ label: 'รายงาน' }]}
        actions={(
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 transition">
              <Printer className="w-4 h-4" />
              <span className="hidden md:inline">พิมพ์</span>
            </button>
            <button
              onClick={() => {
                const data = { summary, report, vendorStats, exported_at: new Date().toISOString() }
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `report-${new Date().toISOString().slice(0,10)}.json`; a.click()
                URL.revokeObjectURL(url)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">ดาวน์โหลด</span>
            </button>
          </div>
        )}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
            <button onClick={fetchAll} className="text-sm text-red-600 hover:underline">ลองใหม่</button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
                <option value="month">เดือนนี้</option>
                <option value="quarter">ไตรมาสนี้</option>
                <option value="year">ปีนี้</option>
              </select>
            </div>
            <button onClick={fetchAll}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition ml-auto">
              <RefreshCw className="w-4 h-4" /> รีเฟรช
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border mb-6">
          <div className="flex border-b overflow-x-auto">
            {[
              { key: 'overview', label: 'ภาพรวม', icon: PieChart },
              { key: 'contracts', label: 'สัญญา', icon: FileText },
              { key: 'vendors', label: 'ผู้รับจ้าง', icon: Users },
              { key: 'financial', label: 'การเงิน', icon: DollarSign },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}>
                <tab.icon className="w-5 h-5" /> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Overview ──────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard icon={<FileText className="w-6 h-6 text-blue-600" />}
                title="สัญญาทั้งหมด" value={fmtN(summary?.total_contracts ?? 0)} />
              <MetricCard icon={<DollarSign className="w-6 h-6 text-green-600" />}
                title="มูลค่ารวม" value={fmtM(summary?.total_value ?? 0)} />
              <MetricCard icon={<CheckCircle className="w-6 h-6 text-purple-600" />}
                title="สัญญาที่ใช้งาน" value={fmtN(summary?.active_contracts ?? 0)}
                subtitle={`จาก ${summary?.total_contracts ?? 0} สัญญา`} />
              <MetricCard icon={<Clock className="w-6 h-6 text-orange-600" />}
                title="ใกล้หมดอายุ (60 วัน)" value={fmtN(summary?.expiring_soon ?? 0)}
                highlight={(summary?.expiring_soon ?? 0) > 0} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly chart */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">จำนวนสัญญารายเดือน</h3>
                  <BarChart3 className="w-5 h-5 text-gray-400" />
                </div>
                {monthly.length > 0
                  ? renderBarChart(monthly, 'count', 'bg-blue-500')
                  : <EmptyChart />}
              </div>

              {/* Contract type distribution */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">ประเภทสัญญา</h3>
                  <PieChart className="w-5 h-5 text-gray-400" />
                </div>
                {typeDistrib.length > 0 ? (
                  <div className="space-y-3">
                    {typeDistrib.slice(0, 6).map((t, i) => {
                      const total = typeDistrib.reduce((s, x) => s + x.count, 0) || 1
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700">{t.label}</span>
                            <span className="font-medium text-gray-900">{t.count} สัญญา</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className={`${TYPE_COLORS[i % TYPE_COLORS.length]} h-2 rounded-full`}
                              style={{ width: `${(t.count / total) * 100}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : <EmptyChart />}
              </div>
            </div>

            {/* Expiring contracts */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">สัญญาใกล้หมดอายุ</h3>
                  <p className="text-sm text-gray-500">ภายใน 30 วัน</p>
                </div>
                <AlertTriangle className={`w-6 h-6 ${expiring.length > 0 ? 'text-orange-500' : 'text-gray-300'}`} />
              </div>
              {expiring.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-300" />
                  <p className="text-sm">ไม่มีสัญญาที่ใกล้หมดอายุในช่วง 30 วัน</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">เลขที่สัญญา</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">ชื่อสัญญา</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">ผู้รับจ้าง</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">มูลค่า</th>
                        <th className="text-center py-2 px-3 text-sm font-medium text-gray-700">เหลือเวลา</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiring.map(c => (
                        <tr key={c.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3 text-sm text-gray-900">{c.number}</td>
                          <td className="py-2 px-3 text-sm text-gray-700 max-w-xs truncate">{c.title}</td>
                          <td className="py-2 px-3 text-sm text-gray-500">{c.vendor_name ?? '-'}</td>
                          <td className="py-2 px-3 text-sm text-gray-900 text-right">{c.value ? fmtM(c.value) : '-'}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              c.days_left <= 7  ? 'bg-red-100 text-red-700' :
                              c.days_left <= 14 ? 'bg-orange-100 text-orange-700' :
                                                  'bg-yellow-100 text-yellow-700'
                            }`}>
                              {c.days_left} วัน
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Contracts Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'contracts' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'รออนุมัติ',  val: summary?.pending_approval ?? 0, color: 'blue',   Icon: Clock },
                { label: 'ดำเนินการ',  val: summary?.active_contracts  ?? 0, color: 'green',  Icon: Activity },
                { label: 'เสร็จสิ้น',  val: summary?.completed         ?? 0, color: 'purple', Icon: CheckCircle },
                { label: 'ยกเลิก/สิ้นสุด', val: (summary?.terminated ?? 0), color: 'red', Icon: AlertTriangle },
              ].map(({ label, val, color, Icon }) => (
                <div key={label} className="bg-white rounded-xl shadow-sm border p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">{label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{fmtN(val)}</p>
                    </div>
                    <div className={`p-3 bg-${color}-100 rounded-lg`}>
                      <Icon className={`w-6 h-6 text-${color}-600`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">ประเภทสัญญา</h3>
              {typeDistrib.length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {typeDistrib.map((item, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className={`w-10 h-10 ${TYPE_COLORS[i % TYPE_COLORS.length]} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{item.label}</p>
                        <p className="text-sm text-gray-500">{item.count} สัญญา</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-medium text-gray-900 text-sm">{fmtM(item.value)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Vendors Tab ───────────────────────────────────────────────────── */}
        {activeTab === 'vendors' && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg"><Building2 className="w-6 h-6 text-blue-600" /></div>
                  <div>
                    <p className="text-sm text-gray-500">ผู้รับจ้างทั้งหมด</p>
                    <p className="text-2xl font-bold text-gray-900">{fmtN(vendorStats?.total_vendors ?? 0)}</p>
                    <p className="text-xs text-gray-400">ราย</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-lg"><CheckCircle className="w-6 h-6 text-green-600" /></div>
                  <div>
                    <p className="text-sm text-gray-500">ใช้งานอยู่</p>
                    <p className="text-2xl font-bold text-gray-900">{fmtN(vendorStats?.active_vendors ?? 0)}</p>
                    <p className="text-xs text-gray-400">ราย</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-100 rounded-lg"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
                  <div>
                    <p className="text-sm text-gray-500">แบล็คลิสต์</p>
                    <p className="text-2xl font-bold text-gray-900">{fmtN(vendorStats?.blacklisted_vendors ?? 0)}</p>
                    <p className="text-xs text-gray-400">ราย</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top vendors */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">ผู้รับจ้างสูงสุดตามจำนวนสัญญา</h3>
              {topVendors.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">ยังไม่มีข้อมูลผู้รับจ้าง</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topVendors.map((v, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{v.name}</p>
                        <p className="text-sm text-gray-500">{v.contracts} สัญญา</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-medium text-gray-900">{fmtM(v.value)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Financial Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'financial' && (
          <div className="space-y-6">
            {/* Value summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <p className="text-sm text-gray-500 mb-1">มูลค่าสัญญารวม</p>
                <p className="text-2xl font-bold text-gray-900">{fmt(summary?.total_value ?? 0)}</p>
                <p className="text-xs text-gray-400 mt-1">{fmtN(summary?.total_contracts ?? 0)} สัญญา</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <p className="text-sm text-gray-500 mb-1">สัญญาดำเนินการอยู่</p>
                <p className="text-2xl font-bold text-gray-900">{fmtN(summary?.active_contracts ?? 0)}</p>
                <p className="text-xs text-gray-400 mt-1">รายการ</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <p className="text-sm text-gray-500 mb-1">สัญญาเสร็จสิ้น</p>
                <p className="text-2xl font-bold text-green-600">{fmtN(summary?.completed ?? 0)}</p>
                <p className="text-xs text-gray-400 mt-1">รายการ</p>
              </div>
            </div>

            {/* Monthly value chart */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">มูลค่าสัญญารายเดือน</h3>
              {monthly.length > 0
                ? renderBarChart(monthly, 'value', 'bg-green-500')
                : <EmptyChart />}
            </div>

            {/* Status breakdown */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">สรุปสถานะสัญญา</h3>
              {!summary ? <EmptyChart /> : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">สถานะ</th>
                        <th className="text-right py-2 px-4 text-sm font-medium text-gray-700">จำนวน</th>
                        <th className="py-2 px-4 w-48"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'ร่าง (Draft)',            val: summary.draft },
                        { label: 'รออนุมัติ',               val: summary.pending_approval },
                        { label: 'ดำเนินการ (Active)',       val: summary.active_contracts },
                        { label: 'เสร็จสิ้น (Completed)',   val: summary.completed },
                        { label: 'ยกเลิก (Terminated)',     val: summary.terminated },
                      ].map(({ label, val }, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-2 px-4 text-sm text-gray-700">{label}</td>
                          <td className="py-2 px-4 text-sm text-gray-900 text-right font-medium">{fmtN(val)}</td>
                          <td className="py-2 px-4">
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="bg-blue-500 h-1.5 rounded-full"
                                style={{ width: `${(val / (summary.total_contracts || 1)) * 100}%` }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-medium">
                        <td className="py-2 px-4 text-sm text-gray-900">รวม</td>
                        <td className="py-2 px-4 text-sm text-gray-900 text-right">{fmtN(summary.total_contracts)}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function MetricCard({ icon, title, value, subtitle, highlight }: {
  icon: React.ReactNode; title: string; value: string; subtitle?: string; highlight?: boolean
}) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border p-5 ${highlight ? 'border-orange-300 bg-orange-50' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className={`text-2xl font-bold ${highlight ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="p-3 bg-gray-100 rounded-lg">{icon}</div>
      </div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-52 flex flex-col items-center justify-center text-gray-300 gap-2">
      <TrendingUp className="w-10 h-10" />
      <p className="text-sm text-gray-400">ยังไม่มีข้อมูล</p>
    </div>
  )
}
