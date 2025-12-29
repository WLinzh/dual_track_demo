import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import DemoControlPanel from '../components/DemoControlPanel'

export default function PreAssessmentPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { caseId, conversationSummary } = location.state || {}

  const [loading, setLoading] = useState(false)
  const [capsule, setCapsule] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [consentLevel, setConsentLevel] = useState(0) // 0=None, 1=Capsule, 2=Capsule+Snippets
  const [transferring, setTransferring] = useState(false)
  const [highlightedText, setHighlightedText] = useState(null)

  // Steps for progress stepper
  const steps = [
    { id: 'generate', label: 'Generate', desc: 'Create assessment' },
    { id: 'review', label: 'Review', desc: 'Verify content' },
    { id: 'consent', label: 'Consent', desc: 'Set sharing' },
    { id: 'complete', label: 'Complete', desc: 'Finish' }
  ]

  const consentOptions = [
    { level: 0, label: "Don't share", desc: 'Your data stays private', color: '#64748b', default: true },
    { level: 1, label: 'Share capsule only', desc: 'Recommended for demo', color: '#059669', recommended: true },
    { level: 2, label: 'Share capsule + snippets', desc: 'Full context', color: '#0369a1', advanced: true }
  ]

  const generateAssessment = async () => {
    setLoading(true)
    try {
      const response = await axios.post('/api/public/pre-assessment', {
        case_id: caseId,
        conversation_summary: conversationSummary
      })
      setCapsule(response.data)
      setCurrentStep(1) // Move to review step
    } catch (error) {
      console.error('Assessment error:', error)
      alert('Failed to generate assessment. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const proceedToConsent = () => {
    setCurrentStep(2)
  }

  const submitTransfer = async () => {
    if (consentLevel === 0) {
      navigate('/receipt', { state: { caseId, capsule, transferred: false, consentScope: [] } })
      return
    }

    setTransferring(true)
    try {
      await axios.post('/api/public/consent', {
        case_id: caseId,
        capsule_id: capsule.capsule_id,
        consent_confirmed: true,
        consent_scope: consentLevel === 2 ? ['intake_capsule', 'chat_history'] : ['intake_capsule']
      })

      await axios.post('/api/public/transfer', {
        case_id: caseId,
        capsule_id: capsule.capsule_id
      })

      setCurrentStep(3)
      setTimeout(() => {
        navigate('/receipt', { 
          state: { 
            caseId, 
            capsule, 
            transferred: true, 
            consentScope: consentLevel === 2 ? ['intake_capsule', 'chat_history'] : ['intake_capsule']
          } 
        })
      }, 1500)
    } catch (error) {
      console.error('Transfer error:', error)
      alert(`Transfer failed: ${error.response?.data?.detail?.reason || error.message}`)
    } finally {
      setTransferring(false)
    }
  }

  if (!caseId) {
    return (
      <div className="container">
        <div className="card">
          <p>No case found. Please start a chat first.</p>
          <button className="button button-primary" onClick={() => navigate('/')}>
            Back to Chat
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <DemoControlPanel />
      
      <div className="card">
        <div className="header">
          <h1>Structured Pre-Assessment</h1>
          <p>Generate a validated intake capsule</p>
        </div>

        {/* Progress Stepper */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: 24,
          padding: '12px 0',
          borderBottom: '1px solid #e2e8f0'
        }}>
          {steps.map((step, idx) => (
            <div key={step.id} style={{ 
              display: 'flex', 
              alignItems: 'center',
              flex: 1,
              opacity: idx <= currentStep ? 1 : 0.4
            }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: idx < currentStep ? '#059669' : idx === currentStep ? '#475569' : '#e2e8f0',
                color: idx <= currentStep ? 'white' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600
              }}>
                {idx < currentStep ? '✓' : idx + 1}
              </div>
              <div style={{ marginLeft: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{step.label}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{step.desc}</div>
              </div>
              {idx < steps.length - 1 && (
                <div style={{ 
                  flex: 1, 
                  height: 2, 
                  background: idx < currentStep ? '#059669' : '#e2e8f0',
                  marginLeft: 12,
                  marginRight: 12
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Generate */}
        {currentStep === 0 && (
          <div>
            <p style={{ marginBottom: 16, color: '#64748b', fontSize: 13 }}>
              This will create a structured summary of your conversation using AI-powered analysis.
            </p>

            <div style={{ 
              background: '#f8fafc', 
              border: '1px solid #e2e8f0', 
              borderRadius: 6, 
              padding: 14,
              marginBottom: 16
            }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>How it works</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: '#059669' }}>✓</span>
                  <span>Your words preserved separately</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: '#059669' }}>✓</span>
                  <span>AI summary clearly marked</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: '#059669' }}>✓</span>
                  <span>Schema validation</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: '#059669' }}>✓</span>
                  <span>Auto-repair if needed</span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>
              Estimated time: ~30 seconds
            </div>

            <button
              className="button button-primary"
              onClick={generateAssessment}
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Generating...' : 'Generate Pre-Assessment'}
            </button>
          </div>
        )}

        {/* Step 1: Review - Two Column Compare */}
        {currentStep === 1 && capsule && (
          <div>
            <div style={{ 
              background: '#f0fdf4', 
              border: '1px solid #bbf7d0', 
              borderRadius: 5, 
              padding: 10,
              marginBottom: 16,
              fontSize: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>
                <strong>Assessment Generated</strong> • Validation: 
                <span className={`badge badge-${capsule.validation_status === 'valid' ? 'low' : 'medium'}`} style={{ marginLeft: 6 }}>
                  {capsule.validation_status.toUpperCase()}
                </span>
              </span>
              <span style={{ fontSize: 10, color: '#64748b' }}>Model: {capsule.ollama_model}</span>
            </div>

            {/* Two-Column Compare View */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Compare View</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Self Description */}
                <div 
                  style={{ 
                    background: '#f8fafc', 
                    border: highlightedText === 'self' ? '2px solid #475569' : '1px solid #e2e8f0', 
                    borderRadius: 6, 
                    padding: 12,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={() => setHighlightedText('self')}
                  onMouseLeave={() => setHighlightedText(null)}
                >
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                    Your Description
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    {capsule.self_description}
                  </div>
                </div>
                
                {/* Model Summary */}
                <div 
                  style={{ 
                    background: '#fffbeb', 
                    border: highlightedText === 'model' ? '2px solid #d97706' : '1px solid #fef3c7', 
                    borderRadius: 6, 
                    padding: 12,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={() => setHighlightedText('model')}
                  onMouseLeave={() => setHighlightedText(null)}
                >
                  <div style={{ fontSize: 10, color: '#d97706', textTransform: 'uppercase', marginBottom: 6 }}>
                    AI-Generated Summary
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    {capsule.model_summary}
                  </div>
                </div>
              </div>
            </div>

            {/* Structured Data (collapsible) */}
            <details style={{ marginBottom: 16 }}>
              <summary style={{ 
                fontSize: 11, 
                color: '#64748b', 
                cursor: 'pointer',
                padding: '8px 0'
              }}>
                View structured data (JSON)
              </summary>
              <pre className="structured-data" style={{ marginTop: 8 }}>
                {JSON.stringify(capsule.structured_data, null, 2)}
              </pre>
            </details>

            <button
              className="button button-primary"
              onClick={proceedToConsent}
              style={{ width: '100%' }}
            >
              Continue to Consent
            </button>
          </div>
        )}

        {/* Step 2: Consent Slider */}
        {currentStep === 2 && capsule && (
          <div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
              Choose what to share with the clinical team. Default is private.
            </div>

            {/* Consent Level Slider */}
            <div style={{ marginBottom: 20 }}>
              {consentOptions.map((opt) => (
                <div
                  key={opt.level}
                  onClick={() => !opt.advanced && setConsentLevel(opt.level)}
                  style={{
                    padding: '14px 16px',
                    marginBottom: 8,
                    borderRadius: 6,
                    border: consentLevel === opt.level ? `2px solid ${opt.color}` : '1px solid #e2e8f0',
                    background: consentLevel === opt.level ? `${opt.color}10` : opt.advanced ? '#f8fafc' : 'white',
                    cursor: opt.advanced ? 'not-allowed' : 'pointer',
                    opacity: opt.advanced ? 0.5 : 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.15s'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>
                      {opt.label}
                      {opt.default && <span style={{ marginLeft: 8, fontSize: 10, color: '#64748b' }}>(default)</span>}
                      {opt.recommended && <span style={{ marginLeft: 8, fontSize: 10, color: '#059669', fontWeight: 600 }}>RECOMMENDED</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{opt.desc}</div>
                  </div>
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: consentLevel === opt.level ? `6px solid ${opt.color}` : '2px solid #d1d5db',
                    background: 'white'
                  }} />
                </div>
              ))}
            </div>

            {/* Receipt Preview */}
            <div style={{ 
              background: '#f8fafc', 
              border: '1px solid #e2e8f0', 
              borderRadius: 6, 
              padding: 14,
              marginBottom: 20
            }}>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Receipt Preview</div>
              <div style={{ fontSize: 12 }}>
                {consentLevel === 0 && (
                  <div style={{ color: '#64748b' }}>Your data will remain private. No information shared.</div>
                )}
                {consentLevel === 1 && (
                  <div>
                    <div style={{ color: '#059669', fontWeight: 500 }}>Will be shared:</div>
                    <ul style={{ margin: '4px 0', paddingLeft: 18, fontSize: 11, color: '#475569' }}>
                      <li>Intake capsule (structured assessment)</li>
                      <li>Model: {capsule.ollama_model}</li>
                      <li>Validation status: {capsule.validation_status}</li>
                    </ul>
                  </div>
                )}
                {consentLevel === 2 && (
                  <div>
                    <div style={{ color: '#0369a1', fontWeight: 500 }}>Will be shared:</div>
                    <ul style={{ margin: '4px 0', paddingLeft: 18, fontSize: 11, color: '#475569' }}>
                      <li>Intake capsule (structured assessment)</li>
                      <li>Conversation history snippets</li>
                      <li>Full context for clinical review</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="button button-secondary"
                onClick={() => setCurrentStep(1)}
                style={{ flex: 1 }}
              >
                Back
              </button>
              <button
                className="button button-primary"
                onClick={submitTransfer}
                disabled={transferring}
                style={{ flex: 1 }}
              >
                {transferring ? 'Processing...' : consentLevel === 0 ? 'Continue (No Share)' : 'Confirm & Transfer'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {currentStep === 3 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ 
              width: 60, 
              height: 60, 
              borderRadius: '50%', 
              background: '#059669', 
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              margin: '0 auto 16px'
            }}>
              ✓
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Transfer Complete</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Redirecting to receipt...</div>
          </div>
        )}

        {/* Audit footer */}
        {caseId && (
          <div className="audit-footer">
            <span>Session <span className="audit-id">#{caseId}</span></span>
            <span 
              className="audit-link-inline"
              onClick={() => window.open(`/audit?case_id=${caseId}`, '_blank')}
            >
              View audit trail
            </span>
          </div>
        )}
      </div>
    </div>
  )
}