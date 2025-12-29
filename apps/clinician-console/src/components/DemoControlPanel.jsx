import React, { useState, useEffect } from 'react'

/**
 * Demo Control Panel - Clinician Console version
 * Fixed drawer for controlling demo scenarios
 */
export default function DemoControlPanel({ onScenarioChange, onSpeedChange, onReset }) {
  const [isOpen, setIsOpen] = useState(false)
  const [scenario, setScenario] = useState('normal')
  const [speed, setSpeed] = useState('normal')
  const [autoAdvance, setAutoAdvance] = useState(false)
  
  // Expose demo state globally for API mocking
  useEffect(() => {
    window.__DEMO_STATE__ = { scenario, speed, autoAdvance }
    if (onScenarioChange) onScenarioChange(scenario)
    if (onSpeedChange) onSpeedChange(speed)
  }, [scenario, speed, autoAdvance])
  
  const scenarios = [
    { value: 'normal', label: 'Normal', desc: 'Standard workflow' },
    { value: 'retrieval_empty', label: 'Retrieval Empty', desc: 'No RAG results' },
    { value: 'json_invalid', label: 'JSON Invalid', desc: 'Draft parse fails' },
    { value: 'policy_blocked', label: 'Policy Blocked', desc: 'Missing citations' },
    { value: 'timeout', label: 'Timeout', desc: 'LLM request timeout' },
    { value: 'low_coverage', label: 'Low Coverage', desc: 'Insufficient refs' }
  ]
  
  const speeds = [
    { value: 'fast', label: 'Fast', delay: 500 },
    { value: 'normal', label: 'Normal', delay: 1500 },
    { value: 'slow', label: 'Slow', delay: 3000 }
  ]
  
  const checkpoints = [
    { id: 'queue', label: 'Case Queue', path: '/' },
    { id: 'draft', label: 'Draft Editor', path: '/draft/DEMO' },
    { id: 'audit', label: 'Audit Trail', path: '/audit' }
  ]
  
  const handleReset = (checkpoint) => {
    if (onReset) onReset(checkpoint)
    localStorage.removeItem('demo_draft_id')
    window.location.href = checkpoint.path
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 9999,
          background: '#0f172a',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 11,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}
      >
        <span style={{ fontSize: 14 }}>⚙</span>
        Demo Control
      </button>
      
      {/* Drawer */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 50,
          right: 12,
          zIndex: 9998,
          background: '#0f172a',
          color: 'white',
          borderRadius: 8,
          padding: 16,
          width: 280,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          fontSize: 12
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: '1px solid #334155'
          }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Demo Control Panel</span>
            <span style={{ 
              background: '#22c55e', 
              padding: '2px 8px', 
              borderRadius: 10, 
              fontSize: 10 
            }}>DEMO MODE</span>
          </div>
          
          {/* Scenario */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ 
              display: 'block', 
              marginBottom: 6, 
              color: '#94a3b8',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Scenario
            </label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 5,
                border: '1px solid #334155',
                background: '#1e293b',
                color: 'white',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              {scenarios.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <div style={{ marginTop: 4, color: '#64748b', fontSize: 10 }}>
              {scenarios.find(s => s.value === scenario)?.desc}
            </div>
          </div>
          
          {/* Speed */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ 
              display: 'block', 
              marginBottom: 6, 
              color: '#94a3b8',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Speed
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {speeds.map(s => (
                <button
                  key={s.value}
                  onClick={() => setSpeed(s.value)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 4,
                    border: speed === s.value ? '1px solid #3b82f6' : '1px solid #334155',
                    background: speed === s.value ? '#1e40af' : '#1e293b',
                    color: 'white',
                    fontSize: 11,
                    cursor: 'pointer'
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Auto-advance */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              cursor: 'pointer',
              padding: '8px 10px',
              background: autoAdvance ? '#1e40af' : '#1e293b',
              borderRadius: 5,
              border: '1px solid #334155'
            }}>
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
                style={{ accentColor: '#3b82f6' }}
              />
              <span>Auto-advance workflow</span>
              <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 10 }}>
                {autoAdvance ? 'ON' : 'OFF'}
              </span>
            </label>
          </div>
          
          {/* Workflow Steps */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ 
              display: 'block', 
              marginBottom: 8, 
              color: '#94a3b8',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Workflow Steps
            </label>
            <div style={{ 
              display: 'flex', 
              gap: 4, 
              fontSize: 9,
              flexWrap: 'wrap'
            }}>
              {['Plan', 'Retrieve', 'Draft', 'Review', 'Sign', 'Write-back'].map((step, i) => (
                <span 
                  key={step}
                  style={{
                    padding: '3px 6px',
                    background: i < 2 ? '#22c55e' : '#334155',
                    borderRadius: 3,
                    color: i < 2 ? 'white' : '#94a3b8'
                  }}
                >
                  {step}
                </span>
              ))}
            </div>
          </div>
          
          {/* Checkpoints */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: 8, 
              color: '#94a3b8',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Reset to Checkpoint
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {checkpoints.map(cp => (
                <button
                  key={cp.id}
                  onClick={() => handleReset(cp)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 5,
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: 'white',
                    fontSize: 11,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <span style={{ color: '#64748b' }}>↺</span>
                  {cp.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
