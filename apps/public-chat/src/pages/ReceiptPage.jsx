import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DemoControlPanel from '../components/DemoControlPanel'

export default function ReceiptPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { caseId, capsule, transferred, consentScope } = location.state || {}

  const collectionTime = new Date().toISOString()

  if (!caseId) {
    return (
      <div className="container">
        <DemoControlPanel />
        <div className="card">
          <p>No session found.</p>
          <button className="button button-primary" onClick={() => navigate('/')}>
            Start New Chat
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
          <h1>{transferred ? 'Transfer Complete' : 'Session Receipt'}</h1>
          <p style={{ fontSize: 12 }}>{transferred ? 'Your case has been transferred to a clinician' : 'Your session summary'}</p>
        </div>

        <div style={{ 
          padding: '10px 14px', 
          background: '#f8fafc', 
          border: '1px solid #e2e8f0', 
          borderRadius: 5, 
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: 13 }}><strong>Session ID:</strong> #{caseId}</span>
          <span 
            className="audit-link-inline"
            onClick={() => window.open(`/audit?case_id=${caseId}`, '_blank')}
          >
            View audit record
          </span>
        </div>

        {/* GOVERNANCE VISIBILITY: How Your Information Is Used */}
        <div style={{ 
          background: '#f8fafc', 
          border: '1px solid #e2e8f0', 
          borderRadius: 5, 
          padding: 14, 
          marginBottom: 16 
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            How Your Information Is Used
          </h3>
          
          <div style={{ fontSize: 12, lineHeight: 1.6, color: '#475569' }}>
            <div style={{ marginBottom: 6 }}>
              <strong>Collection Time:</strong> {new Date(collectionTime).toLocaleString()}
            </div>
            
            <div style={{ marginBottom: 6 }}>
              <strong>Information Collected:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: 18, color: '#64748b' }}>
                <li>Your self-description (preserved exactly)</li>
                <li>AI-generated summary (marked as model output)</li>
                <li>Structured assessment data</li>
              </ul>
            </div>
            
            <div style={{ marginBottom: 6 }}>
              <strong>Consent Scope:</strong> {transferred 
                ? (consentScope?.join(', ') || 'Intake capsule, Chat history')
                : 'No transfer consent - data remains local'
              }
            </div>
            
            <div style={{ marginBottom: 6 }}>
              <strong>Model:</strong> {capsule?.ollama_model || 'qwen2.5:1.5b-instruct'}
            </div>
            
            <div>
              <strong>Data Usage:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: 18, color: '#64748b' }}>
                {transferred ? (
                  <>
                    <li>Will be reviewed by a licensed clinician</li>
                    <li>Used to prepare clinical assessment</li>
                    <li>Stored with audit trail</li>
                  </>
                ) : (
                  <>
                    <li>Stored locally only</li>
                    <li>Not shared with clinical team</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        {capsule && (
          <div style={{ marginBottom: 16 }}>
            <div className="field-group">
              <div className="field-label">Capsule ID</div>
              <div className="field-value" style={{ fontFamily: 'SF Mono, monospace', fontSize: 12 }}>{capsule.capsule_id}</div>
            </div>

            <div className="field-group">
              <div className="field-label">Validation</div>
              <div className="field-value">
                <span className={`badge badge-${capsule.validation_status === 'valid' ? 'low' : 'medium'}`}>
                  {capsule.validation_status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="field-group">
              <div className="field-label">Prompt Version</div>
              <div className="field-value" style={{ fontSize: 12 }}>PUB_PRE_ASSESS_V1</div>
            </div>
          </div>
        )}

        {transferred ? (
          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            background: '#f0fdf4', 
            border: '1px solid #bbf7d0', 
            borderRadius: 5,
            fontSize: 12
          }}>
            <strong>What happens next:</strong>
            <ul style={{ marginTop: 6, paddingLeft: 18, color: '#166534' }}>
              <li>A clinician will review your case within 24-48 hours</li>
              <li>Access limited to consented information only</li>
              <li>All actions logged in audit trail</li>
            </ul>
          </div>
        ) : (
          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            background: '#fefce8', 
            border: '1px solid #fef08a', 
            borderRadius: 5,
            fontSize: 12,
            color: '#854d0e'
          }}>
            <p style={{ margin: 0 }}>You chose not to transfer. Your information is saved locally.</p>
          </div>
        )}

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button 
            className="button button-primary"
            onClick={() => navigate('/')}
          >
            Start New Session
          </button>
        </div>

        {/* Audit footer */}
        <div className="audit-footer">
          <span>Session <span className="audit-id">#{caseId}</span> | Track: Public{transferred && ' → Clinician'}</span>
          <span 
            className="audit-link-inline"
            onClick={() => window.open(`/audit?case_id=${caseId}`, '_blank')}
          >
            View full audit trail
          </span>
        </div>
      </div>
    </div>
  )
}
