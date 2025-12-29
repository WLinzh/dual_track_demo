import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import DemoControlPanel from '../components/DemoControlPanel'

export default function QueuePage() {
  const [queue, setQueue] = useState([])
  const [templates, setTemplates] = useState([])
  const [selectedCase, setSelectedCase] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [queueRes, templatesRes] = await Promise.all([
        axios.get('/api/clinician/queue'),
        axios.get('/api/clinician/templates')
      ])
      setQueue(queueRes.data)
      setTemplates(templatesRes.data)
    } catch (error) {
      console.error('Load error:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateDraft = async () => {
    if (!selectedCase || !selectedTemplate) return

    setGenerating(true)
    try {
      const response = await axios.post('/api/clinician/draft/generate', {
        case_id: selectedCase.case_id,
        template_type: selectedTemplate.template_type,
        context: {
          chief_complaint: 'Patient assessment required',
          case_number: selectedCase.case_number
        }
      })
      
      navigate(`/draft/${response.data.draft_id}`)
    } catch (error) {
      console.error('Generation error:', error)
      alert('Failed to generate draft')
    } finally {
      setGenerating(false)
    }
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

      <div className="dual-panel">
        <div className="panel">
          <div className="panel-header">Case Queue ({queue.length})</div>
          {queue.map(item => (
            <div
              key={item.case_id}
              className={`queue-item ${selectedCase?.case_id === item.case_id ? 'selected' : ''}`}
              onClick={() => setSelectedCase(item)}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {item.case_number}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                Origin: {item.origin_track} | {item.has_capsule ? '✓ Has Capsule' : 'No Capsule'}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                {new Date(item.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-header">Generate Clinical Draft</div>
          
          {selectedCase ? (
            <>
              <div className="alert alert-info">
                <strong>Selected Case:</strong> {selectedCase.case_number}
              </div>

              <h3 style={{ marginTop: 24, marginBottom: 12 }}>Select Template:</h3>
              <div className="template-grid">
                {templates.map(tmpl => (
                  <div
                    key={tmpl.template_type}
                    className={`template-card ${selectedTemplate?.template_type === tmpl.template_type ? 'selected' : ''}`}
                    onClick={() => setSelectedTemplate(tmpl)}
                  >
                    <div style={{ fontSize: 24, marginBottom: 8 }}>
                      {tmpl.template_type === 'handover' && '🔄'}
                      {tmpl.template_type === 'discharge' && '🚪'}
                      {tmpl.template_type === 'progress' && '📝'}
                      {tmpl.template_type === 'follow_up' && '📅'}
                    </div>
                    <div style={{ fontWeight: 600 }}>{tmpl.display_name}</div>
                  </div>
                ))}
              </div>

              {selectedTemplate && (
                <div style={{ marginTop: 24 }}>
                  <div className="alert alert-success">
                    <strong>Template Selected:</strong> {selectedTemplate.display_name}
                    
                    {/* Input Scope */}
                    <div style={{ marginTop: 12, fontSize: 12 }}>
                      <strong>Input Scope:</strong> {selectedTemplate.input_scope?.join(', ')}
                    </div>
                    
                    {/* Processing Steps */}
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      <strong>Steps:</strong> {selectedTemplate.steps.join(' → ')}
                    </div>
                    
                    {/* Output Schema */}
                    {selectedTemplate.output_schema && (
                      <div style={{ marginTop: 8, fontSize: 12 }}>
                        <strong>Output:</strong> {Object.keys(selectedTemplate.output_schema).join(', ')}
                      </div>
                    )}
                    
                    {/* Human Confirmation Points */}
                    {selectedTemplate.human_confirmation_points?.length > 0 && (
                      <div style={{ marginTop: 12, padding: 8, background: '#fef3c7', borderRadius: 4 }}>
                        <strong>✅ Human Confirmation Points:</strong>
                        <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                          {selectedTemplate.human_confirmation_points.map((point, idx) => (
                            <li key={idx}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <button
                    className="button button-primary"
                    onClick={generateDraft}
                    disabled={generating}
                    style={{ width: '100%', marginTop: 16 }}
                  >
                    {generating ? 'Generating with RAG...' : '🤖 Generate Draft with Evidence Citations'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#6b7280', padding: 60 }}>
              Select a case from the queue to begin
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
