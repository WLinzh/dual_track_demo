import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import DemoControlPanel from '../components/DemoControlPanel'

export default function DraftEditorPage() {
  const { draftId } = useParams()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(null)
  const [editedContent, setEditedContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [signing, setSigning] = useState(false)
  const [writingBack, setWritingBack] = useState(false)
  const [policyError, setPolicyError] = useState(null)
  const [showQualityNotification, setShowQualityNotification] = useState(true)
  const [autoSaveStatus, setAutoSaveStatus] = useState(null) // 'saving', 'saved', null
  const [workflowStep, setWorkflowStep] = useState(0)
  const [showCitationSidebar, setShowCitationSidebar] = useState(true)
  const [highlightedCitation, setHighlightedCitation] = useState(null)
  const [showDiffView, setShowDiffView] = useState(false)
  const editorRef = useRef(null)
  const autoSaveTimer = useRef(null)

  // Workflow steps
  const workflowSteps = [
    { id: 'plan', label: 'Plan', status: 'done' },
    { id: 'retrieve', label: 'Retrieve', status: 'done' },
    { id: 'draft', label: 'Draft', status: 'done' },
    { id: 'review', label: 'Review/Edit', status: 'running' },
    { id: 'sign', label: 'Sign', status: 'pending' },
    { id: 'writeback', label: 'Write-back', status: 'pending' }
  ]

  useEffect(() => {
    loadDraft()
  }, [draftId])

  // Auto-save effect
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    if (draft && editedContent !== draft.content) {
      autoSaveTimer.current = setTimeout(() => {
        autoSaveDraft()
      }, 2000)
    }
    return () => clearTimeout(autoSaveTimer.current)
  }, [editedContent])

  // Update workflow step based on draft status
  useEffect(() => {
    if (draft) {
      if (draft.status === 'written_back') setWorkflowStep(5)
      else if (draft.status === 'signed') setWorkflowStep(4)
      else setWorkflowStep(3)
    }
  }, [draft])

  const loadDraft = async () => {
    try {
      const response = await axios.get(`/api/clinician/drafts/${draftId}`)
      setDraft(response.data)
      setEditedContent(response.data.content)
    } catch (error) {
      console.error('Load error:', error)
    } finally {
      setLoading(false)
    }
  }

  const autoSaveDraft = async () => {
    setAutoSaveStatus('saving')
    try {
      await axios.put('/api/clinician/draft/edit', {
        draft_id: draftId,
        edited_content: editedContent,
        clinician_notes: 'Auto-save'
      })
      setAutoSaveStatus('saved')
      setTimeout(() => setAutoSaveStatus(null), 2000)
    } catch (error) {
      setAutoSaveStatus(null)
    }
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      await axios.put('/api/clinician/draft/edit', {
        draft_id: draftId,
        edited_content: editedContent,
        clinician_notes: 'Manual edit'
      })
      await loadDraft()
      alert('Draft saved')
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const signDraft = async () => {
    setSigning(true)
    setPolicyError(null)
    try {
      await axios.post('/api/clinician/draft/sign', {
        draft_id: draftId,
        clinician_id: 'DR001'
      })
      await loadDraft()
      alert('Draft signed successfully')
    } catch (error) {
      console.error('Sign error:', error)
      if (error.response?.status === 400 && error.response?.data?.error === 'PolicyBlocked') {
        setPolicyError(error.response.data)
      } else {
        alert('Failed to sign draft')
      }
    } finally {
      setSigning(false)
    }
  }

  const writeBack = async () => {
    setWritingBack(true)
    try {
      await axios.post('/api/clinician/draft/write-back', {
        draft_id: draftId
      })
      setWorkflowStep(5)
      alert('Draft written back successfully!')
      navigate('/')
    } catch (error) {
      console.error('Write-back error:', error)
      alert(error.response?.data?.reason || 'Failed to write back')
    } finally {
      setWritingBack(false)
    }
  }

  // Calculate citation coverage
  const getCitationCoverage = () => {
    const citations = editedContent.match(/\[DOC:[^\]]+\]/g) || []
    const uniqueCitations = [...new Set(citations)]
    const required = evidence.length || 4
    return {
      count: uniqueCitations.length,
      required,
      citations: uniqueCitations,
      complete: uniqueCitations.length >= Math.min(required, 4)
    }
  }

  // Scroll to citation in editor
  const scrollToCitation = (citationId) => {
    setHighlightedCitation(citationId)
    const editorEl = editorRef.current
    if (editorEl) {
      const text = editorEl.value
      const index = text.indexOf(citationId)
      if (index >= 0) {
        editorEl.focus()
        editorEl.setSelectionRange(index, index + citationId.length)
      }
    }
    setTimeout(() => setHighlightedCitation(null), 2000)
  }

  // Insert citation placeholder
  const insertCitationPlaceholder = (docId) => {
    const citation = `[DOC:${docId}]`
    const editorEl = editorRef.current
    if (editorEl) {
      const start = editorEl.selectionStart
      const newContent = editedContent.slice(0, start) + ` ${citation} ` + editedContent.slice(start)
      setEditedContent(newContent)
    }
  }

  // Re-run retrieval action
  const reRunRetrieval = async () => {
    alert('Demo: Re-running retrieval with +2 documents...')
    // In real implementation, this would call the API
  }

  // Regenerate section
  const regenerateSection = () => {
    alert('Demo: Regenerating section S2 with required refs...')
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Loading...</div>
  }

  if (!draft) {
    return <div className="container"><div className="card">Draft not found</div></div>
  }

  const evidence = draft.evidence_refs ? JSON.parse(draft.evidence_refs) : []
  const pendingTasks = draft.pending_tasks ? JSON.parse(draft.pending_tasks) : []
  const riskPoints = draft.risk_points ? JSON.parse(draft.risk_points) : []
  const coverage = getCitationCoverage()

  // Calculate record scope timestamps
  const createdAt = draft.created_at || new Date().toISOString()
  const updatedAt = draft.updated_at || createdAt

  // Get step status
  const getStepStatus = (idx) => {
    if (idx < workflowStep) return 'done'
    if (idx === workflowStep) return 'running'
    if (policyError && idx === 4) return 'blocked'
    return 'pending'
  }

  return (
    <div className="container">
      <DemoControlPanel />
      
      <div className="nav">
        <div className="nav-brand">Clinician Console</div>
        <div className="nav-links">
          <Link to="/" className="nav-link">← Queue</Link>
          <Link to="/audit" className="nav-link">Audit</Link>
          <Link to="/performance" className="nav-link">Performance</Link>
        </div>
      </div>

      {/* Workflow Stepper */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        padding: '12px 16px',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        overflowX: 'auto'
      }}>
        {workflowSteps.map((step, idx) => {
          const status = getStepStatus(idx)
          const colors = {
            done: { bg: '#059669', text: 'white' },
            running: { bg: '#3b82f6', text: 'white' },
            blocked: { bg: '#dc2626', text: 'white' },
            failed: { bg: '#dc2626', text: 'white' },
            pending: { bg: '#e2e8f0', text: '#64748b' }
          }
          return (
            <React.Fragment key={step.id}>
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: 70,
                  cursor: 'pointer'
                }}
                title={`${step.label}: ${status}`}
              >
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: colors[status].bg,
                  color: colors[status].text,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600
                }}>
                  {status === 'done' ? '✓' : status === 'blocked' ? '!' : status === 'running' ? '●' : idx + 1}
                </div>
                <div style={{ fontSize: 10, marginTop: 4, fontWeight: 500 }}>{step.label}</div>
                <div style={{ 
                  fontSize: 9, 
                  color: status === 'blocked' ? '#dc2626' : '#94a3b8',
                  textTransform: 'uppercase'
                }}>
                  {status}
                </div>
              </div>
              {idx < workflowSteps.length - 1 && (
                <div style={{ 
                  height: 2, 
                  width: 20, 
                  background: idx < workflowStep ? '#059669' : '#e2e8f0',
                  marginTop: -12
                }} />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* GOVERNANCE: Fairness/Quality Notification (Demo Toggle) */}
      {showQualityNotification && (
        <div className="governance-banner caution" style={{ marginBottom: 12 }}>
          <div>
            <strong>AI Quality Notice:</strong> Generated by <code style={{ background: 'rgba(0,0,0,0.1)', padding: '1px 4px', borderRadius: 2 }}>{draft.ollama_model}</code>. 
            Clinical review required before any decisions.
          </div>
          <button 
            onClick={() => setShowQualityNotification(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', fontSize: 14 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Demo toggle for quality notification */}
      <div style={{ marginBottom: 10, fontSize: 10, color: '#94a3b8' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={showQualityNotification} 
            onChange={(e) => setShowQualityNotification(e.target.checked)}
          />
          Show Fairness/Quality Notification (Demo)
        </label>
      </div>

      <div className="dual-panel">
        {/* Left Panel: Work Assistant Console */}
        <div className="panel">
          {/* Work Assistant Header */}
          <div style={{ 
            background: '#0f172a', 
            color: 'white', 
            padding: 10, 
            borderRadius: 5, 
            marginBottom: 12,
            fontSize: 11
          }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Work Assistant</div>
            <div style={{ color: '#94a3b8' }}>Clinical document generation</div>
          </div>

          {/* Why This Draft */}
          <details open style={{ marginBottom: 12 }}>
            <summary style={{ 
              fontSize: 11, 
              fontWeight: 600, 
              cursor: 'pointer',
              padding: '6px 0',
              color: '#475569'
            }}>
              Why this draft?
            </summary>
            <div style={{ 
              fontSize: 11, 
              color: '#64748b', 
              padding: 10, 
              background: '#f8fafc', 
              borderRadius: 4,
              marginTop: 6
            }}>
              Template: {draft.template_type}<br/>
              Case: {draft.case_id}<br/>
              Generated based on intake capsule and clinical guidelines.
            </div>
          </details>

          {/* Evidence Used */}
          <details open style={{ marginBottom: 12 }}>
            <summary style={{ 
              fontSize: 11, 
              fontWeight: 600, 
              cursor: 'pointer',
              padding: '6px 0',
              color: '#475569'
            }}>
              What evidence was used? ({evidence.length} docs)
            </summary>
            <div style={{ marginTop: 6 }}>
              {evidence.map((ev, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    padding: 8, 
                    background: highlightedCitation === `[DOC:${ev.doc_id}]` ? '#dbeafe' : '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 4,
                    marginBottom: 6,
                    fontSize: 11,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onClick={() => scrollToCitation(`[DOC:${ev.doc_id}]`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="citation-tag" style={{ fontSize: 10 }}>[DOC:{ev.doc_id}]</span>
                    <span style={{ fontSize: 9, color: '#64748b' }}>{(ev.score * 100).toFixed(0)}% match</span>
                  </div>
                  <div style={{ fontWeight: 500, marginTop: 4 }}>{ev.title}</div>
                  <div style={{ color: '#64748b', marginTop: 2, fontSize: 10 }}>{ev.snippet?.substring(0, 80)}...</div>
                </div>
              ))}
            </div>
          </details>

          {/* Quick Actions */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: '#475569' }}>Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                onClick={reRunRetrieval}
                style={{
                  padding: '8px 10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 4,
                  fontSize: 11,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                ↻ Re-run retrieval (+2 docs)
              </button>
              <button
                onClick={regenerateSection}
                style={{
                  padding: '8px 10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 4,
                  fontSize: 11,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                ↻ Regenerate section S2 only
              </button>
            </div>
          </div>

          {/* Policy Explanation (shows when blocked) */}
          {policyError && (
            <div style={{ 
              background: '#fef2f2', 
              border: '1px solid #fecaca', 
              borderRadius: 5, 
              padding: 10,
              marginBottom: 12
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', marginBottom: 6 }}>Policy Explanation</div>
              <div style={{ fontSize: 11, color: '#7f1d1d' }}>{policyError.reason}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{policyError.message}</div>
            </div>
          )}

          {/* Records Scope */}
          <details style={{ marginBottom: 12 }}>
            <summary style={{ 
              fontSize: 11, 
              fontWeight: 600, 
              cursor: 'pointer',
              padding: '6px 0',
              color: '#475569'
            }}>
              Records Scope
            </summary>
            <div style={{ 
              fontSize: 10, 
              color: '#64748b', 
              padding: 10, 
              background: '#f8fafc', 
              borderRadius: 4,
              marginTop: 6,
              lineHeight: 1.6
            }}>
              <div><strong>Template:</strong> {draft.template_type}</div>
              <div><strong>Created:</strong> {new Date(createdAt).toLocaleString()}</div>
              <div><strong>Updated:</strong> {new Date(updatedAt).toLocaleString()}</div>
              <div><strong>Prompt:</strong> CLI_{draft.template_type.toUpperCase()}_V1</div>
              <div><strong>Model:</strong> {draft.ollama_model}</div>
            </div>
          </details>

          {/* Status */}
          <div>
            <span className={`badge badge-${draft.status}`}>
              {draft.status.toUpperCase()}
            </span>
            {draft.signed_by && (
              <div style={{ fontSize: 10, color: '#059669', marginTop: 4 }}>
                Signed by {draft.signed_by}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Draft Editor */}
        <div className="panel">
          {/* Editor Header with Coverage Meter */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 12
          }}>
            <div className="panel-header" style={{ margin: 0 }}>Draft Editor</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Auto-save status */}
              {autoSaveStatus && (
                <span style={{ 
                  fontSize: 10, 
                  color: autoSaveStatus === 'saved' ? '#059669' : '#64748b'
                }}>
                  {autoSaveStatus === 'saving' ? 'Saving...' : '✓ Saved'}
                </span>
              )}
              {/* Toolbar buttons */}
              <button
                onClick={() => setShowDiffView(!showDiffView)}
                style={{
                  padding: '4px 8px',
                  background: showDiffView ? '#dbeafe' : '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: 4,
                  fontSize: 10,
                  cursor: 'pointer'
                }}
              >
                Diff View
              </button>
            </div>
          </div>

          {/* Coverage Meter */}
          <div style={{ 
            background: coverage.complete ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${coverage.complete ? '#bbf7d0' : '#fef3c7'}`,
            borderRadius: 5,
            padding: 10,
            marginBottom: 12,
            fontSize: 11
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <strong>Coverage:</strong> {coverage.count}/{Math.min(coverage.required, 4)} required refs
              </span>
              <span style={{ 
                color: coverage.complete ? '#059669' : '#d97706',
                fontWeight: 600
              }}>
                {coverage.complete ? '✓ Complete' : 'Missing refs'}
              </span>
            </div>
            {!coverage.complete && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: '#92400e', fontSize: 10, marginBottom: 6 }}>Missing citations:</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {evidence.slice(coverage.count).map((ev, idx) => (
                    <button
                      key={idx}
                      onClick={() => insertCitationPlaceholder(ev.doc_id)}
                      style={{
                        padding: '3px 6px',
                        background: '#fef3c7',
                        border: '1px solid #fcd34d',
                        borderRadius: 3,
                        fontSize: 9,
                        cursor: 'pointer'
                      }}
                    >
                      + [DOC:{ev.doc_id}]
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Policy Blocked Banner */}
          {policyError && (
            <div style={{ 
              background: '#fef2f2', 
              border: '1px solid #fecaca', 
              borderRadius: 5, 
              padding: 12,
              marginBottom: 12
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#dc2626', fontSize: 12 }}>Blocked by Policy</div>
                  <div style={{ fontSize: 11, color: '#7f1d1d', marginTop: 4 }}>{policyError.reason}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button
                  onClick={() => {
                    evidence.forEach(ev => insertCitationPlaceholder(ev.doc_id))
                    setPolicyError(null)
                  }}
                  style={{
                    padding: '6px 10px',
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 10,
                    cursor: 'pointer'
                  }}
                >
                  Auto-add citation placeholders
                </button>
                <button
                  onClick={reRunRetrieval}
                  style={{
                    padding: '6px 10px',
                    background: 'white',
                    border: '1px solid #dc2626',
                    color: '#dc2626',
                    borderRadius: 4,
                    fontSize: 10,
                    cursor: 'pointer'
                  }}
                >
                  Re-run retrieval
                </button>
                <button
                  onClick={regenerateSection}
                  style={{
                    padding: '6px 10px',
                    background: 'white',
                    border: '1px solid #dc2626',
                    color: '#dc2626',
                    borderRadius: 4,
                    fontSize: 10,
                    cursor: 'pointer'
                  }}
                >
                  Regenerate with refs
                </button>
              </div>
            </div>
          )}

          <textarea
            ref={editorRef}
            className="draft-editor"
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            disabled={draft.status === 'signed' || draft.status === 'written_back'}
            style={{
              background: highlightedCitation ? '#fffbeb' : undefined
            }}
          />

          <div className="button-group" style={{ marginTop: 12 }}>
            <button
              className="button button-secondary"
              onClick={saveEdit}
              disabled={saving || draft.status === 'signed'}
            >
              {saving ? 'Saving...' : 'Save Edit'}
            </button>

            <button
              className="button button-success"
              onClick={signDraft}
              disabled={signing || draft.status === 'signed' || !coverage.complete}
              title={!coverage.complete ? 'Add required citations before signing' : ''}
            >
              {signing ? 'Signing...' : 'Sign Draft'}
            </button>

            <button
              className="button button-primary"
              onClick={writeBack}
              disabled={writingBack || draft.status !== 'signed'}
            >
              {writingBack ? 'Writing...' : 'Write Back'}
            </button>
          </div>

          {/* Sign gating warning */}
          {!coverage.complete && draft.status !== 'signed' && (
            <div style={{ 
              fontSize: 10, 
              color: '#d97706', 
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <span>⚠</span>
              Add {Math.min(coverage.required, 4) - coverage.count} more citation(s) to enable signing
            </div>
          )}

          <div style={{ 
            marginTop: 12, 
            padding: 10, 
            fontSize: 11, 
            color: '#64748b', 
            background: '#f8fafc',
            borderRadius: 4,
            border: '1px solid #e2e8f0'
          }}>
            <div><strong>Workflow:</strong> Draft → Edit → Sign (policy check) → Write-back</div>
            <div style={{ marginTop: 4 }}><strong>Policy:</strong> Must include evidence citations [DOC:...] to sign</div>
          </div>
          
          {/* Audit footer */}
          <div className="audit-footer">
            <span>Draft <span className="audit-id">{draftId}</span></span>
            <span 
              className="audit-link-inline"
              onClick={() => window.open(`/audit?draft_id=${draftId}`, '_blank')}
            >
              View audit trail
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
