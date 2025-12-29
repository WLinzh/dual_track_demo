import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import DemoControlPanel from '../components/DemoControlPanel'

export default function AuditPage() {
  const [events, setEvents] = useState([])
  const [stats, setStats] = useState(null)
  const [models, setModels] = useState([])
  const [viewMode, setViewMode] = useState('timeline') // 'timeline' | 'table'
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const [filters, setFilters] = useState({
    track: '',
    event_type: '',
    ollama_model: '',
    risk_level: '',
    case_id: searchParams.get('case_id') || '',
    draft_id: searchParams.get('draft_id') || ''
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadEvents()
  }, [filters])

  const loadData = async () => {
    try {
      const [statsRes, modelsRes] = await Promise.all([
        axios.get('/api/audit/stats'),
        axios.get('/api/audit/models')
      ])
      setStats(statsRes.data)
      setModels(modelsRes.data.models)
    } catch (error) {
      console.error('Load error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadEvents = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.track) params.append('track', filters.track)
      if (filters.event_type) params.append('event_type', filters.event_type)
      if (filters.ollama_model) params.append('ollama_model', filters.ollama_model)
      if (filters.risk_level) params.append('risk_level', filters.risk_level)
      if (filters.case_id) params.append('case_id', filters.case_id)
      
      const response = await axios.get(`/api/audit/events?${params}`)
      setEvents(response.data)
    } catch (error) {
      console.error('Events error:', error)
    }
  }

  // Group events by case for timeline view
  const getTimelineGroups = () => {
    const groups = {}
    events.forEach(ev => {
      const key = ev.case_id || 'system'
      if (!groups[key]) groups[key] = []
      groups[key].push(ev)
    })
    return groups
  }

  // Get event icon
  const getEventIcon = (type) => {
    const icons = {
      'input': '✉',
      'generation': '⚙',
      'retrieval': '🔍',
      'policy_trigger': '⚠',
      'safety_upgrade': '🚨',
      'sign': '✓',
      'write_back': '↪',
      'consent': '🔒',
      'transfer': '→'
    }
    return icons[type] || '●'
  }

  // Navigate to evidence in draft
  const openInDraft = (draftId, citation) => {
    navigate(`/draft/${draftId}?highlight=${citation}`)
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Loading...</div>
  }

  return (
    <div className="container">
      <DemoControlPanel />
      
      <div className="nav">
        <div className="nav-brand">Clinician Console</div>
        <div className="nav-links">
          <Link to="/" className="nav-link">Queue</Link>
          <Link to="/audit" className="nav-link">Audit</Link>
          <Link to="/performance" className="nav-link">Performance</Link>
        </div>
      </div>

      <div className="card">
        <div className="header">
          <h1>Audit Trail</h1>
          <p>Unified governance tracking across both tracks</p>
        </div>

        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.total_events}</div>
              <div className="stat-label">Total Events</div>
            </div>
            {Object.entries(stats.by_track).map(([track, count]) => (
              <div key={track} className="stat-card">
                <div className="stat-value">{count}</div>
                <div className="stat-label">{track.toUpperCase()} Track</div>
              </div>
            ))}
          </div>
        )}

        <div className="divider" />

        {/* View Mode Toggle */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 16
        }}>
          <h3 style={{ margin: 0 }}>Events</h3>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setViewMode('timeline')}
              style={{
                padding: '6px 12px',
                background: viewMode === 'timeline' ? '#475569' : '#f1f5f9',
                color: viewMode === 'timeline' ? 'white' : '#475569',
                border: 'none',
                borderRadius: '4px 0 0 4px',
                fontSize: 11,
                cursor: 'pointer'
              }}
            >
              Timeline
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '6px 12px',
                background: viewMode === 'table' ? '#475569' : '#f1f5f9',
                color: viewMode === 'table' ? 'white' : '#475569',
                border: 'none',
                borderRadius: '0 4px 4px 0',
                fontSize: 11,
                cursor: 'pointer'
              }}
            >
              Table
            </button>
          </div>
        </div>
        
        <div className="filter-bar">
          <select
            className="select"
            value={filters.track}
            onChange={(e) => setFilters({ ...filters, track: e.target.value })}
          >
            <option value="">All Tracks</option>
            <option value="public">Public</option>
            <option value="clinician">Clinician</option>
            <option value="governance">Governance</option>
          </select>

          <select
            className="select"
            value={filters.event_type}
            onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}
          >
            <option value="">All Event Types</option>
            <option value="input">Input</option>
            <option value="generation">Generation</option>
            <option value="retrieval">Retrieval</option>
            <option value="policy_trigger">Policy Trigger</option>
            <option value="safety_upgrade">Safety Upgrade</option>
            <option value="sign">Sign</option>
            <option value="write_back">Write Back</option>
          </select>

          <select
            className="select"
            value={filters.ollama_model}
            onChange={(e) => setFilters({ ...filters, ollama_model: e.target.value })}
            style={{ flex: 1 }}
          >
            <option value="">All Models (Filter by ollama_model)</option>
            {models.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>

          <select
            className="select"
            value={filters.risk_level}
            onChange={(e) => setFilters({ ...filters, risk_level: e.target.value })}
          >
            <option value="">All Risk Levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {/* Timeline View */}
        {viewMode === 'timeline' && (
          <div style={{ marginTop: 16 }}>
            {events.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>
                No events found with current filters
              </div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 30 }}>
                {/* Timeline line */}
                <div style={{
                  position: 'absolute',
                  left: 12,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: '#e2e8f0'
                }} />
                
                {events.map((event, idx) => (
                  <div 
                    key={event.id}
                    style={{ 
                      position: 'relative',
                      marginBottom: 16,
                      paddingBottom: 16,
                      borderBottom: idx < events.length - 1 ? '1px solid #f1f5f9' : 'none'
                    }}
                  >
                    {/* Timeline dot */}
                    <div style={{
                      position: 'absolute',
                      left: -22,
                      top: 4,
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: event.track === 'public' ? '#dbeafe' : event.track === 'clinician' ? '#d1fae5' : '#fef3c7',
                      border: '2px solid white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12
                    }}>
                      {getEventIcon(event.event_type)}
                    </div>
                    
                    {/* Event content */}
                    <div 
                      style={{ 
                        background: selectedEvent === event.id ? '#f8fafc' : 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        padding: 12,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                      onClick={() => setSelectedEvent(selectedEvent === event.id ? null : event.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span className="badge" style={{
                            background: event.track === 'public' ? '#dbeafe' : event.track === 'clinician' ? '#d1fae5' : '#fef3c7',
                            color: event.track === 'public' ? '#1e40af' : event.track === 'clinician' ? '#065f46' : '#92400e',
                            marginRight: 6
                          }}>
                            {event.track}
                          </span>
                          <span style={{ fontWeight: 500 }}>{event.event_type}</span>
                        </div>
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>
                          {new Date(event.created_at).toLocaleString()}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                        <span style={{ marginRight: 12 }}>
                          <strong>Model:</strong> <code style={{ fontSize: 10 }}>{event.ollama_model}</code>
                        </span>
                        {event.case_id && (
                          <span style={{ marginRight: 12 }}>
                            <strong>Case:</strong> {event.case_id}
                          </span>
                        )}
                        {event.risk_level && (
                          <span className={`badge badge-${event.risk_level}`} style={{ fontSize: 9 }}>
                            {event.risk_level}
                          </span>
                        )}
                      </div>
                      
                      {/* Expanded details */}
                      {selectedEvent === event.id && (
                        <div style={{ 
                          marginTop: 12, 
                          paddingTop: 12, 
                          borderTop: '1px solid #e2e8f0',
                          fontSize: 11
                        }}>
                          <div style={{ marginBottom: 8 }}>
                            <strong>Prompt Version:</strong> {event.prompt_version_id || 'N/A'}
                          </div>
                          {event.evidence_refs && (
                            <div style={{ marginBottom: 8 }}>
                              <strong>Evidence Refs:</strong>
                              <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                                {JSON.parse(event.evidence_refs || '[]').map((ref, i) => (
                                  <span 
                                    key={i}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openInDraft(event.draft_id || 'DEMO', ref.doc_id)
                                    }}
                                    style={{
                                      padding: '2px 6px',
                                      background: '#dbeafe',
                                      borderRadius: 3,
                                      fontSize: 9,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    [DOC:{ref.doc_id}]
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            {event.draft_id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(`/draft/${event.draft_id}`)
                                }}
                                style={{
                                  padding: '4px 8px',
                                  background: '#475569',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 3,
                                  fontSize: 10,
                                  cursor: 'pointer'
                                }}
                              >
                                Open in Draft
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                // View evidence would open a modal in real implementation
                                alert(`Event ${event.id} evidence details`)
                              }}
                              style={{
                                padding: '4px 8px',
                                background: '#f1f5f9',
                                color: '#475569',
                                border: '1px solid #e2e8f0',
                                borderRadius: 3,
                                fontSize: 10,
                                cursor: 'pointer'
                              }}
                            >
                              View Evidence
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Table View */}
        {viewMode === 'table' && (
          <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Track</th>
                <th>Event Type</th>
                <th>Ollama Model</th>
                <th>Case ID</th>
                <th>Risk Level</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {events.map(event => (
                <tr key={event.id}>
                  <td>{event.id}</td>
                  <td>
                    <span className="badge" style={{
                      background: event.track === 'public' ? '#dbeafe' : event.track === 'clinician' ? '#d1fae5' : '#fef3c7',
                      color: event.track === 'public' ? '#1e40af' : event.track === 'clinician' ? '#065f46' : '#92400e'
                    }}>
                      {event.track}
                    </span>
                  </td>
                  <td>{event.event_type}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                    {event.ollama_model}
                  </td>
                  <td>{event.case_id || '-'}</td>
                  <td>
                    {event.risk_level && (
                      <span className={`badge badge-${event.risk_level}`}>
                        {event.risk_level}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 11 }}>
                    {new Date(event.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        {viewMode === 'table' && events.length === 0 && (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>
            No events found with current filters
          </div>
        )}
      </div>
    </div>
  )
}
