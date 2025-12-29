import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import QueuePage from './pages/QueuePage'
import DraftEditorPage from './pages/DraftEditorPage'
import AuditPage from './pages/AuditPage'
import PerformancePage from './pages/PerformancePage'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<QueuePage />} />
        <Route path="/draft/:draftId" element={<DraftEditorPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/performance" element={<PerformancePage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
