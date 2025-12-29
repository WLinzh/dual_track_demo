import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import DemoControlPanel from '../components/DemoControlPanel'

export default function PerformancePage() {
  const [summary, setSummary] = useState(null)
  const [models, setModels] = useState([])
  const [phases, setPhases] = useState([])
  const [runs, setRuns] = useState([])
  const [errors, setErrors] = useState([])
  const [availableModels, setAvailableModels] = useState([])
  const [selectedRun, setSelectedRun] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const [filters, setFilters] = useState({
    range: '24h',
    track: '',
    phase: '',
    model: ''
  })

  useEffect(() => {
    loadData()
  }, [filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('range', filters.range)
      if (filters.track) params.append('track', filters.track)
      if (filters.phase) params.append('phase', filters.phase)
      if (filters.model) params.append('model', filters.model)
      
      const [summaryRes, modelsRes, phasesRes, runsRes, errorsRes, availableRes] = await Promise.all([
        axios.get(`/api/monitor/performance/summary?${params}`),
        axios.get(`/api/monitor/performance/models?${params}`),
        axios.get(`/api/monitor/performance/phases?${params}`),
        axios.get(`/api/monitor/performance/runs?${params}&limit=20`),
        axios.get(`/api/monitor/performance/errors?${params}`),
        axios.get('/api/monitor/performance/available-models')
      ])
      
      setSummary(summaryRes.data)
      setModels(modelsRes.data)
      setPhases(phasesRes.data)
      setRuns(runsRes.data)
      setErrors(errorsRes.data)
      setAvailableModels(availableRes.data)
    } catch (error) {
      console.error('Load error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRunDetail = async (runId) => {
    try {
      const res = await axios.get(`/api/monitor/performance/runs/${runId}`)
      setSelectedRun(res.data)
    } catch (error) {
      console.error('Run detail error:', error)
    }
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Loading...</div>
  }

  return (
    <div className="container">
      <DemoControlPanel />
      
      <div className="nav">
        <div className="nav-brand">Performance Monitor</div>
        <div className="nav-links">
          <Link to="/" className="nav-link">Queue</Link>
          <Link to="/audit" className="nav-link">Audit</Link>
          <Link to="/performance" className="nav-link" style={{ fontWeight: 600 }}>Performance</Link>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(5, 1fr)', 
          gap: 12, 
          marginBottom: 16 
        }}>
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: 14,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: summary.success_rate >= 95 ? '#059669' : '#d97706' }}>
              {summary.success_rate}%
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Success Rate</div>
          </div>
          
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: 14,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#475569' }}>
              {summary.p50_total_ms || 'N/A'}<span style={{ fontSize: 12 }}>ms</span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>p50 Latency</div>
          </div>
          
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: 14,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#475569' }}>
              {summary.p95_total_ms || 'N/A'}<span style={{ fontSize: 12 }}>ms</span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>p95 Latency</div>
          </div>
          
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: 14,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0369a1' }}>
              {summary.p50_tokens_per_sec || 'N/A'}<span style={{ fontSize: 12 }}>t/s</span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>p50 Tokens/s</div>
          </div>
          
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: 14,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: summary.cold_start_rate > 20 ? '#dc2626' : '#64748b' }}>
              {summary.cold_start_rate}%
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Cold Start Rate</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        marginBottom: 16,
        background: 'white',
        padding: 12,
        borderRadius: 6,
        border: '1px solid #e2e8f0'
      }}>
        <select
          value={filters.range}
          onChange={(e) => setFilters({ ...filters, range: e.target.value })}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 12 }}
        >
          <option value="1h">Last 1 hour</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
        </select>
        
        <select
          value={filters.track}
          onChange={(e) => setFilters({ ...filters, track: e.target.value })}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 12 }}
        >
          <option value="">All Tracks</option>
          <option value="public">Public</option>
          <option value="clinician">Clinician</option>
        </select>
        
        <select
          value={filters.phase}
          onChange={(e) => setFilters({ ...filters, phase: e.target.value })}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 12 }}
        >
          <option value="">All Phases</option>
          <option value="0">Public Capsule (0)</option>
          <option value="1">Plan (1)</option>
          <option value="2">Draft (2)</option>
        </select>
        
        <select
          value={filters.model}
          onChange={(e) => setFilters({ ...filters, model: e.target.value })}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 12, flex: 1 }}
        >
          <option value="">All Models</option>
          {availableModels.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        
        <button
          onClick={loadData}
          style={{
            padding: '6px 12px',
            background: '#475569',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            fontSize: 12,
            cursor: 'pointer'
          }}
        >
          Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Model Comparison */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #e2e8f0', 
          borderRadius: 6, 
          padding: 16 
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Model Comparison</h3>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Model</th>
                <th style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>p95 (ms)</th>
                <th style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>p95 t/s</th>
                <th style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Success</th>
                <th style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {models.map(m => (
                <tr key={m.ollama_model} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 10 }}>{m.ollama_model}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{m.p95_ms || 'N/A'}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{m.p95_tps || 'N/A'}</td>
                  <td style={{ padding: 8, textAlign: 'right', color: m.success_rate >= 95 ? '#059669' : '#d97706' }}>
                    {m.success_rate}%
                  </td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{m.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phase Comparison */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #e2e8f0', 
          borderRadius: 6, 
          padding: 16 
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Phase Comparison</h3>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Phase</th>
                <th style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>p95 (ms)</th>
                <th style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>p95 t/s</th>
                <th style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Avg Snippets</th>
                <th style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {phases.map(p => (
                <tr key={p.phase} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 8 }}>{p.phase_name}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{p.p95_ms || 'N/A'}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{p.p95_tps || 'N/A'}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{p.avg_snippet_chars || 'N/A'}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Error Distribution */}
      {errors.length > 0 && (
        <div style={{ 
          background: '#fef2f2', 
          border: '1px solid #fecaca', 
          borderRadius: 6, 
          padding: 14,
          marginBottom: 16
        }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 12, color: '#dc2626' }}>Error Distribution</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            {errors.map(e => (
              <div key={e.error_code} style={{ 
                background: 'white', 
                padding: '6px 10px', 
                borderRadius: 4, 
                fontSize: 11 
              }}>
                <strong>{e.error_code}</strong>: {e.count}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Runs */}
      <div style={{ 
        background: 'white', 
        border: '1px solid #e2e8f0', 
        borderRadius: 6, 
        padding: 16 
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Recent Runs</h3>
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Time</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Track</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Phase</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Model</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Latency</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>t/s</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>Status</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map(r => (
              <tr 
                key={r.run_id} 
                style={{ 
                  borderBottom: '1px solid #f1f5f9',
                  background: !r.success ? '#fef2f2' : 'transparent'
                }}
              >
                <td style={{ padding: 8, fontSize: 10 }}>{new Date(r.created_at).toLocaleString()}</td>
                <td style={{ padding: 8 }}>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: 3,
                    fontSize: 10,
                    background: r.track === 'public' ? '#dbeafe' : '#d1fae5',
                    color: r.track === 'public' ? '#1e40af' : '#065f46'
                  }}>{r.track}</span>
                </td>
                <td style={{ padding: 8 }}>{r.phase_name}</td>
                <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 10 }}>{r.ollama_model}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{r.latency_ms}ms</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{r.tokens_per_sec || 'N/A'}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>
                  {r.success ? (
                    <span style={{ color: '#059669' }}>✓</span>
                  ) : (
                    <span style={{ color: '#dc2626', fontSize: 10 }}>{r.error_code}</span>
                  )}
                </td>
                <td style={{ padding: 8, textAlign: 'center' }}>
                  <button
                    onClick={() => loadRunDetail(r.run_id)}
                    style={{
                      padding: '3px 8px',
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: 3,
                      fontSize: 10,
                      cursor: 'pointer'
                    }}
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Run Detail Drawer */}
      {selectedRun && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 400,
          height: '100vh',
          background: 'white',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
          zIndex: 1000,
          overflow: 'auto'
        }}>
          <div style={{ 
            padding: 16, 
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            background: 'white'
          }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>Run Details</h3>
            <button
              onClick={() => setSelectedRun(null)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 18,
                cursor: 'pointer'
              }}
            >
              ×
            </button>
          </div>
          
          <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Run ID</div>
              <div style={{ fontFamily: 'monospace', fontSize: 11 }}>{selectedRun.run_id}</div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Track</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{selectedRun.track}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Phase</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{selectedRun.phase_name}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Model</div>
                <div style={{ fontSize: 11, fontFamily: 'monospace' }}>{selectedRun.ollama_model}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Status</div>
                <div style={{ 
                  fontSize: 12, 
                  fontWeight: 500, 
                  color: selectedRun.success ? '#059669' : '#dc2626' 
                }}>
                  {selectedRun.success ? 'Success' : selectedRun.error_code}
                </div>
              </div>
            </div>
            
            <div style={{ 
              background: '#f8fafc', 
              borderRadius: 6, 
              padding: 12,
              marginBottom: 16
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Timing Breakdown</div>
              <div style={{ fontSize: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Total Latency:</span>
                  <span style={{ fontWeight: 600 }}>{selectedRun.latency_ms}ms</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Load Duration:</span>
                  <span>{selectedRun.load_ms || 'N/A'}ms</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Prompt Eval:</span>
                  <span>{selectedRun.prompt_eval_ms || 'N/A'}ms ({selectedRun.prompt_eval_count || 'N/A'} tokens)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Eval:</span>
                  <span>{selectedRun.eval_ms || 'N/A'}ms ({selectedRun.eval_count || 'N/A'} tokens)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 4, marginTop: 4 }}>
                  <span style={{ fontWeight: 600 }}>Tokens/sec:</span>
                  <span style={{ fontWeight: 600, color: '#0369a1' }}>{selectedRun.tokens_per_sec || 'N/A'}</span>
                </div>
              </div>
            </div>
            
            <div style={{ 
              background: '#f8fafc', 
              borderRadius: 6, 
              padding: 12,
              marginBottom: 16
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Context Stats</div>
              <div style={{ fontSize: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Input chars:</span>
                  <span>{selectedRun.ctx_chars_in || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Output chars:</span>
                  <span>{selectedRun.ctx_chars_out || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Evidence count:</span>
                  <span>{selectedRun.evidence_count || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Snippet chars:</span>
                  <span>{selectedRun.snippet_chars_total || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Retry count:</span>
                  <span>{selectedRun.retry_count}</span>
                </div>
              </div>
            </div>
            
            {selectedRun.error_message && (
              <div style={{ 
                background: '#fef2f2', 
                border: '1px solid #fecaca',
                borderRadius: 6, 
                padding: 12,
                marginBottom: 16
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>Error</div>
                <div style={{ fontSize: 11, color: '#7f1d1d' }}>{selectedRun.error_message}</div>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedRun.correlation_id && (
                <Link
                  to={`/audit?correlation_id=${selectedRun.correlation_id}`}
                  style={{
                    padding: '8px 12px',
                    background: '#475569',
                    color: 'white',
                    borderRadius: 4,
                    fontSize: 11,
                    textDecoration: 'none'
                  }}
                >
                  View Audit Trail
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
