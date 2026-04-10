'use client'
import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Database, Play, AlertTriangle } from 'lucide-react'

const EXAMPLE_QUERIES = [
  { label: 'All items', query: 'SELECT item_code, description, uom, is_active FROM item_master ORDER BY item_code LIMIT 50' },
  { label: 'Stock overview', query: 'SELECT im.item_code, im.description, lm.location_code, s.quantity, s.reserved_qty FROM stock s JOIN item_master im ON s.item_id = im.id JOIN location_master lm ON s.location_id = lm.id WHERE s.quantity > 0 ORDER BY im.item_code LIMIT 50' },
  { label: 'Recent GRs', query: 'SELECT gr_number, gr_date, status, total_lines FROM goods_receipt_header ORDER BY created_at DESC LIMIT 20' },
  { label: 'Recent SOs', query: 'SELECT so_number, so_date, status, priority, total_lines FROM sales_order_header ORDER BY created_at DESC LIMIT 20' },
]

export default function SqlQueryPage() {
  const { isSuperUser, hasPermission } = useAuth()
  const [sql, setSql] = useState('SELECT * FROM item_master LIMIT 10')
  const [result, setResult] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [duration, setDuration] = useState<number | null>(null)

  const canUse = isSuperUser || hasPermission('sql-query', 'view')

  const run = async () => {
    const trimmed = sql.trim().toLowerCase()
    if (!trimmed.startsWith('select')) {
      setError('Only SELECT queries are allowed')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    setDuration(null)

    const res = await fetch('/api/sql-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Query failed')
      return
    }
    setResult(data.data || [])
    setDuration(data.duration)
  }

  if (!canUse) return <div className="text-center py-12 text-slate-500">Access denied</div>

  const columns = result && result.length > 0 ? Object.keys(result[0]) : []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Database className="h-6 w-6 text-blue-600" /> SQL Query Tool</h1>
        <p className="text-sm text-slate-500">Run SELECT queries against the WMS database</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-slate-500">Examples:</span>
        {EXAMPLE_QUERIES.map(q => (
          <Button key={q.label} variant="outline" size="sm" onClick={() => setSql(q.query)} className="text-xs">{q.label}</Button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Only SELECT queries allowed
            </CardTitle>
            <Button onClick={run} disabled={loading} size="sm">
              <Play className="h-3 w-3 mr-2" />{loading ? 'Running...' : 'Run Query'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <textarea
            value={sql}
            onChange={e => setSql(e.target.value)}
            className="w-full h-32 font-mono text-sm border rounded-md p-3 bg-slate-50 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter SELECT query..."
            onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') run() }}
          />
          <p className="text-xs text-slate-400 mt-1">Ctrl+Enter to run</p>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-600 text-sm font-mono">{error}</p>
          </CardContent>
        </Card>
      )}

      {result !== null && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Results</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{result.length} rows</Badge>
                {duration !== null && <Badge variant="outline" className="text-xs">{duration}ms</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {result.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">Query returned 0 rows</p>
            ) : (
              <div className="overflow-auto max-h-[50vh] border rounded-md">
                <table className="text-xs w-full">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      {columns.map(col => (
                        <th key={col} className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap border-b">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        {columns.map(col => (
                          <td key={col} className="px-3 py-1.5 border-b text-slate-700 whitespace-nowrap font-mono">
                            {row[col] === null ? <span className="text-slate-400 italic">null</span> : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
export const dynamic = 'force-dynamic'
