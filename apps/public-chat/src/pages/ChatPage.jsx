import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import DemoControlPanel from '../components/DemoControlPanel'

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [caseId, setCaseId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [riskAssessment, setRiskAssessment] = useState(null)
  const [safetyUpgrade, setSafetyUpgrade] = useState(null)
  const [conversationSummary, setConversationSummary] = useState('')
  const [showSafetyPanel, setShowSafetyPanel] = useState(false)
  const [safetyPanelExpanded, setSafetyPanelExpanded] = useState(true)
  const messagesEndRef = useRef(null)
  const navigate = useNavigate()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setConversationSummary(prev => prev + `\nUser: ${input}`)
    setInput('')
    setLoading(true)

    try {
      const response = await axios.post('/api/public/chat', {
        message: input,
        case_id: caseId
      })

      const { response: assistantReply, case_id, risk_assessment, safety_upgrade } = response.data

      setMessages(prev => [...prev, { role: 'assistant', content: assistantReply }])
      setConversationSummary(prev => prev + `\nAssistant: ${assistantReply}`)
      
      if (!caseId) setCaseId(case_id)
      if (risk_assessment) setRiskAssessment(risk_assessment)
      if (safety_upgrade) {
        setSafetyUpgrade(safety_upgrade)
        setShowSafetyPanel(true)
        setSafetyPanelExpanded(true)
      }

    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const proceedToAssessment = () => {
    navigate('/pre-assessment', { 
      state: { caseId, conversationSummary } 
    })
  }

  // Quick action chips
  const handleChipAction = (action) => {
    switch (action) {
      case 'assessment':
        proceedToAssessment()
        break
      case 'later':
        setMessages(prev => [...prev, 
          { role: 'user', content: 'I prefer to share later.' },
          { role: 'assistant', content: 'That\'s completely okay. Your information stays private. You can return anytime when you\'re ready.' }
        ])
        break
      case 'safety':
        setShowSafetyPanel(true)
        setSafetyPanelExpanded(true)
        break
    }
  }

  return (
    <div className="container">
      {/* Demo Control Panel */}
      <DemoControlPanel />
      
      {/* Fixed Safety Panel (when triggered) */}
      {showSafetyPanel && (
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: safetyUpgrade?.risk_level === 'critical' ? '#dc2626' : '#d97706',
          color: 'white',
          borderRadius: 6,
          marginBottom: 12,
          overflow: 'hidden'
        }}>
          <div 
            style={{
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer'
            }}
            onClick={() => setSafetyPanelExpanded(!safetyPanelExpanded)}
          >
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              Safety Resources Available
            </span>
            <span style={{ fontSize: 12 }}>{safetyPanelExpanded ? '▲' : '▼'}</span>
          </div>
          
          {safetyPanelExpanded && (
            <div style={{ padding: '0 14px 14px', background: 'rgba(0,0,0,0.1)' }}>
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: 'white',
                  color: '#dc2626',
                  border: 'none',
                  borderRadius: 5,
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}>
                  I need immediate help
                </button>
                <button style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 5,
                  fontWeight: 500,
                  fontSize: 12,
                  cursor: 'pointer'
                }}>
                  Not immediate
                </button>
              </div>
              
              {/* Resource cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 5, padding: 10, fontSize: 11 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Crisis Line</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>988</div>
                  <div style={{ opacity: 0.8, fontSize: 10 }}>24/7 Available</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 5, padding: 10, fontSize: 11 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Crisis Text</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>HOME → 741741</div>
                  <div style={{ opacity: 0.8, fontSize: 10 }}>Text support</div>
                </div>
              </div>
              
              {/* Minimal alert consent */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 4,
                fontSize: 11,
                cursor: 'pointer'
              }}>
                <input type="checkbox" style={{ accentColor: 'white' }} />
                <span>Share minimal safety alert to clinic (optional)</span>
              </label>
              
              <div style={{ marginTop: 10, fontSize: 10, opacity: 0.7 }}>
                This chatbot does not provide diagnoses. Contact 911 for emergencies.
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="card">
        <div className="header">
          <h1>Health Support</h1>
          <p>Confidential support powered by AI</p>
          {caseId && <p style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>Session #{caseId}</p>}
        </div>

        <div className="chat-messages">
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>
              <p style={{ fontSize: 14 }}>Hello. I'm here to listen and support you.</p>
              <p style={{ fontSize: 13, marginTop: 8, color: '#94a3b8' }}>Share what's on your mind when you're ready.</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`message message-${msg.role}`}>
              <div className="message-bubble">
                {msg.content}
              </div>
              {/* Guidance chips after assistant messages */}
              {msg.role === 'assistant' && idx === messages.length - 1 && !loading && messages.length >= 2 && (
                <div style={{ 
                  display: 'flex', 
                  gap: 6, 
                  marginTop: 8,
                  flexWrap: 'wrap'
                }}>
                  <button
                    onClick={() => handleChipAction('assessment')}
                    style={{
                      padding: '6px 12px',
                      background: '#475569',
                      color: 'white',
                      border: 'none',
                      borderRadius: 16,
                      fontSize: 11,
                      cursor: 'pointer'
                    }}
                  >
                    Start Pre-Assessment
                  </button>
                  <button
                    onClick={() => handleChipAction('later')}
                    style={{
                      padding: '6px 12px',
                      background: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #e2e8f0',
                      borderRadius: 16,
                      fontSize: 11,
                      cursor: 'pointer'
                    }}
                  >
                    I want to share later
                  </button>
                  <button
                    onClick={() => handleChipAction('safety')}
                    style={{
                      padding: '6px 12px',
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      borderRadius: 16,
                      fontSize: 11,
                      cursor: 'pointer'
                    }}
                  >
                    Safety resources
                  </button>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="message message-assistant">
              <div className="message-bubble">
                <div style={{ display: 'flex', gap: 4 }}>
                  <span className="dot">●</span>
                  <span className="dot">●</span>
                  <span className="dot">●</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {riskAssessment && (
          <div style={{ 
            fontSize: 11, 
            color: '#64748b', 
            padding: '8px 12px', 
            background: '#f8fafc', 
            borderRadius: 4,
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>
              Risk Level: 
              <span className={`badge badge-${riskAssessment.risk_level}`} style={{ marginLeft: 6 }}>
                {riskAssessment.risk_level.toUpperCase()}
              </span>
              {riskAssessment.triggers.length > 0 && (
                <span style={{ marginLeft: 8 }}>({riskAssessment.triggers.length} trigger{riskAssessment.triggers.length > 1 ? 's' : ''})</span>
              )}
            </span>
            <span 
              className="audit-link-inline"
              onClick={() => window.open(`/audit?case_id=${caseId}`, '_blank')}
            >
              View audit record
            </span>
          </div>
        )}

        <div className="input-group">
          <input
            type="text"
            className="input"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
          />
          <button 
            className="button button-primary" 
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </div>

        {messages.length >= 3 && !safetyUpgrade && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <div className="divider" />
            <p style={{ color: '#64748b', marginBottom: 12, fontSize: 13 }}>
              Ready to create a structured pre-assessment?
            </p>
            <button 
              className="button button-primary"
              onClick={proceedToAssessment}
            >
              Continue to Pre-Assessment
            </button>
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
              View full audit trail
            </span>
          </div>
        )}
      </div>

      <style jsx>{`
        .dot {
          animation: blink 1.4s infinite both;
          font-size: 20px;
        }
        .dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        .dot:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes blink {
          0%, 80%, 100% { opacity: 0; }
          40% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
