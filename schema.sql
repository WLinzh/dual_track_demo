-- Dual-Track Demo Database Schema
-- SQLite 3.x compatible

PRAGMA foreign_keys = ON;

-- ============================================================
-- Prompt Version Management
-- ============================================================
CREATE TABLE IF NOT EXISTS prompt_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_code TEXT NOT NULL UNIQUE,
    track TEXT NOT NULL CHECK(track IN ('public', 'clinician')),
    template_type TEXT, -- e.g., 'pre_assessment', 'handover', 'discharge'
    prompt_content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT 1
);

CREATE INDEX idx_prompt_versions_track ON prompt_versions(track, active);

-- ============================================================
-- Cases (Shared across both tracks)
-- ============================================================
CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_number TEXT NOT NULL UNIQUE,
    patient_name TEXT,
    patient_id TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'transferred', 'completed', 'archived')),
    origin_track TEXT NOT NULL CHECK(origin_track IN ('public', 'clinician')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cases_status ON cases(status, origin_track);
CREATE INDEX idx_cases_number ON cases(case_number);

-- ============================================================
-- Consents (Public Track consent for transfer)
-- ============================================================
CREATE TABLE IF NOT EXISTS consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    consent_type TEXT NOT NULL DEFAULT 'transfer',
    collection_time TIMESTAMP NOT NULL,
    notification_content TEXT NOT NULL,
    consent_scope TEXT NOT NULL, -- JSON array: ["intake_capsule", "chat_history"]
    user_confirmed BOOLEAN DEFAULT 0,
    prompt_version_id INTEGER,
    ollama_model TEXT NOT NULL,
    metadata TEXT, -- JSON for additional context
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id)
);

CREATE INDEX idx_consents_case ON consents(case_id);

-- ============================================================
-- Documents (Knowledge Base for RAG)
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT, -- 'guideline', 'protocol', 'policy'
    content TEXT NOT NULL,
    embedding BLOB, -- Serialized vector (numpy array or JSON)
    metadata TEXT, -- JSON for additional info
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT 1
);

CREATE INDEX idx_documents_category ON documents(category, active);
CREATE INDEX idx_documents_doc_id ON documents(doc_id);

-- ============================================================
-- Workflow Templates (Clinician Track)
-- ============================================================
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_type TEXT NOT NULL UNIQUE CHECK(template_type IN ('progress', 'discharge', 'handover', 'follow_up')),
    display_name TEXT NOT NULL,
    input_scope TEXT NOT NULL, -- JSON array of required inputs
    steps TEXT NOT NULL, -- JSON array of workflow steps
    output_schema TEXT NOT NULL, -- JSON schema for structured output
    human_confirmation_points TEXT, -- JSON array of checkpoints
    prompt_version_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT 1,
    FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id)
);

-- ============================================================
-- Drafts (Clinician generated content before sign-off)
-- ============================================================
CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    draft_id TEXT NOT NULL UNIQUE,
    case_id INTEGER NOT NULL,
    template_type TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'check_policy', 'editing', 'signed', 'written_back', 'archived', 'blocked')),
    content TEXT NOT NULL, -- Draft content with citations
    evidence_refs TEXT, -- JSON array of RAG evidence references
    pending_tasks TEXT, -- JSON array of pending items
    risk_points TEXT, -- JSON array of identified risks
    clinician_edits TEXT, -- JSON array of edit history
    signed_by TEXT,
    signed_at TIMESTAMP,
    policy_check_result TEXT, -- JSON with policy validation results
    ollama_model TEXT NOT NULL,
    prompt_version_id INTEGER,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id)
);

CREATE INDEX idx_drafts_case ON drafts(case_id);
CREATE INDEX idx_drafts_status ON drafts(status);
CREATE INDEX idx_drafts_draft_id ON drafts(draft_id);

-- ============================================================
-- Event Logs (Unified audit trail for both tracks)
-- ============================================================
CREATE TABLE IF NOT EXISTS event_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track TEXT NOT NULL CHECK(track IN ('public', 'clinician', 'governance')),
    event_type TEXT NOT NULL, -- 'input', 'generation', 'retrieval', 'edit', 'sign', 'policy_trigger', 'safety_upgrade', 'tool_output', 'transfer'
    case_id INTEGER,
    draft_id TEXT,
    ollama_model TEXT NOT NULL, -- FIRST-CLASS FIELD for audit filtering
    prompt_version_id INTEGER,
    user_id TEXT, -- Clinician ID or session ID
    payload_json TEXT NOT NULL, -- Full event details
    risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL,
    FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id)
);

CREATE INDEX idx_event_logs_track ON event_logs(track, event_type);
CREATE INDEX idx_event_logs_case ON event_logs(case_id);
CREATE INDEX idx_event_logs_model ON event_logs(ollama_model); -- For filtering by model
CREATE INDEX idx_event_logs_created ON event_logs(created_at DESC);
CREATE INDEX idx_event_logs_risk ON event_logs(risk_level);

-- ============================================================
-- Intake Capsules (Public Track structured pre-assessment)
-- ============================================================
CREATE TABLE IF NOT EXISTS intake_capsules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    capsule_id TEXT NOT NULL UNIQUE,
    self_description_text TEXT NOT NULL, -- User's own words
    model_summary_text TEXT NOT NULL, -- Model-generated summary (marked as such)
    structured_data TEXT NOT NULL, -- JSON with validated schema
    validation_status TEXT DEFAULT 'valid' CHECK(validation_status IN ('valid', 'invalid', 'repaired')),
    repair_attempts INTEGER DEFAULT 0,
    ollama_model TEXT NOT NULL,
    prompt_version_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id)
);

CREATE INDEX idx_intake_capsules_case ON intake_capsules(case_id);
CREATE INDEX idx_intake_capsules_id ON intake_capsules(capsule_id);

-- ============================================================
-- Safety Upgrades (Public Track escalation triggers)
-- ============================================================
CREATE TABLE IF NOT EXISTS safety_upgrades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    trigger_reason TEXT NOT NULL, -- 'high_risk_keywords', 'suicidal_intent', 'crisis_detected'
    trigger_data TEXT, -- JSON with detection details
    tool_output TEXT NOT NULL, -- Rule engine output (explainable)
    action_taken TEXT NOT NULL, -- 'prompt_clinician_contact', 'transfer_recommended'
    ollama_model TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE INDEX idx_safety_upgrades_case ON safety_upgrades(case_id);

-- ============================================================
-- LLM Performance Runs (Performance Monitoring)
-- ============================================================
CREATE TABLE IF NOT EXISTS llm_perf_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL UNIQUE,
    correlation_id TEXT,           -- Links phase1+phase2 in same workflow
    case_id INTEGER,
    track TEXT NOT NULL CHECK(track IN ('public', 'clinician')),
    phase INTEGER DEFAULT 0,       -- 0=public_capsule, 1=plan, 2=draft
    ollama_model TEXT NOT NULL,    -- FIRST-CLASS FIELD
    prompt_version_id TEXT,
    stream BOOLEAN DEFAULT 0,
    temperature REAL,
    top_k INTEGER,
    snippet_chars_total INTEGER,   -- RAG snippet size
    evidence_count INTEGER,        -- Number of RAG docs
    ctx_chars_in INTEGER,          -- Input context size
    ctx_chars_out INTEGER,         -- Output size
    retry_count INTEGER DEFAULT 0,
    success BOOLEAN,
    error_code TEXT,
    error_message TEXT,
    http_status INTEGER,
    latency_ms INTEGER,
    total_duration_ns INTEGER,
    load_duration_ns INTEGER,
    prompt_eval_count INTEGER,
    prompt_eval_duration_ns INTEGER,
    eval_count INTEGER,
    eval_duration_ns INTEGER,
    tokens_per_sec REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL
);

CREATE INDEX idx_llm_perf_runs_created ON llm_perf_runs(created_at DESC);
CREATE INDEX idx_llm_perf_runs_model ON llm_perf_runs(ollama_model);
CREATE INDEX idx_llm_perf_runs_track ON llm_perf_runs(track);
CREATE INDEX idx_llm_perf_runs_phase ON llm_perf_runs(phase);
CREATE INDEX idx_llm_perf_runs_success ON llm_perf_runs(success);
CREATE INDEX idx_llm_perf_runs_error ON llm_perf_runs(error_code);
CREATE INDEX idx_llm_perf_runs_correlation ON llm_perf_runs(correlation_id);
CREATE INDEX idx_llm_perf_runs_case ON llm_perf_runs(case_id);

-- ============================================================
-- Seed Initial Data
-- ============================================================

-- Seed prompt versions
INSERT INTO prompt_versions (version_code, track, template_type, prompt_content, active) VALUES
('PUB_PRE_ASSESS_V1', 'public', 'pre_assessment', 'You are a compassionate healthcare assistant. Based on the conversation, create a structured pre-assessment capsule in JSON format with the following fields: chief_complaint, symptom_duration, severity_score (1-10), risk_indicators (array), self_description. Be empathetic and accurate.', 1),
('CLI_HANDOVER_V1', 'clinician', 'handover', 'You are a clinical documentation assistant. Generate a handover note based on retrieved evidence. MUST include citations in format [DOC:doc_id]. Structure: patient_summary, key_findings, pending_tasks, recommendations.', 1),
('CLI_DISCHARGE_V1', 'clinician', 'discharge', 'Generate discharge summary with mandatory evidence citations [DOC:doc_id]. Include: diagnosis, treatment_provided, discharge_instructions, follow_up_plan, medications.', 1),
('CLI_PROGRESS_V1', 'clinician', 'progress', 'Create progress note with evidence-based assessment [DOC:doc_id]. Include: subjective, objective, assessment, plan (SOAP format).', 1),
('CLI_FOLLOWUP_V1', 'clinician', 'follow_up', 'Generate follow-up plan with cited guidelines [DOC:doc_id]. Include: review_of_systems, interval_changes, continued_plan, next_appointment.', 1);

-- Seed workflow templates
INSERT INTO templates (template_type, display_name, input_scope, steps, output_schema, human_confirmation_points, active) VALUES
('handover', 'Shift Handover Note', 
 '["patient_id", "current_status", "time_range"]',
 '["retrieve_recent_records", "rag_search_guidelines", "generate_draft", "structure_output"]',
 '{"patient_summary": "string", "key_findings": "array", "pending_tasks": "array", "recommendations": "array", "evidence_refs": "array"}',
 '["verify_pending_tasks", "confirm_critical_findings"]',
 1),
('discharge', 'Discharge Summary',
 '["patient_id", "admission_date", "diagnosis"]',
 '["retrieve_admission_note", "rag_treatment_protocols", "generate_summary", "structure_discharge"]',
 '{"diagnosis": "string", "treatment_provided": "array", "discharge_instructions": "string", "follow_up_plan": "string", "medications": "array", "evidence_refs": "array"}',
 '["verify_medications", "confirm_follow_up_date"]',
 1),
('progress', 'Progress Note',
 '["patient_id", "visit_date"]',
 '["retrieve_last_visit", "rag_clinical_guidelines", "generate_soap", "structure_note"]',
 '{"subjective": "string", "objective": "string", "assessment": "string", "plan": "string", "evidence_refs": "array"}',
 '["confirm_assessment", "verify_plan"]',
 1),
('follow_up', 'Follow-up Plan',
 '["patient_id", "last_visit_date", "concerns"]',
 '["retrieve_history", "rag_follow_up_protocols", "generate_plan", "structure_follow_up"]',
 '{"review_of_systems": "string", "interval_changes": "string", "continued_plan": "string", "next_appointment": "string", "evidence_refs": "array"}',
 '["confirm_next_appointment"]',
 1);

-- Seed knowledge base documents
INSERT INTO documents (doc_id, title, category, content, active) VALUES
('DOC001', 'Mental Health Crisis Response Protocol', 'protocol', 
 'When patient exhibits suicidal ideation or self-harm risk: 1) Ensure immediate safety 2) Conduct risk assessment using Columbia Protocol 3) Contact crisis intervention team 4) Document all interventions 5) Never leave high-risk patient unattended. Severity thresholds: Score 8+ on PHQ-9 item 9 requires immediate evaluation.', 
 1),
('DOC002', 'Handover Communication Standards', 'guideline',
 'Effective handover must include: Patient identification, Current status and vital signs, Outstanding tasks, Pending results, Risks and concerns, Care plan modifications. Use SBAR format (Situation, Background, Assessment, Recommendation). Document all handovers in EMR within 1 hour.',
 1),
('DOC003', 'Discharge Planning Guidelines', 'guideline',
 'Discharge criteria: Stable vital signs for 24h, Patient understands medication regimen, Follow-up appointment scheduled, Home care arranged if needed. Required documentation: Discharge summary, Medication reconciliation, Patient education materials, Follow-up instructions. High-risk patients require care coordinator contact within 48h.',
 1),
('DOC004', 'Anxiety Disorder Treatment Protocol', 'protocol',
 'First-line treatment for GAD: CBT (12-16 sessions) + consider SSRI if moderate-severe. Monitor PHQ-9 and GAD-7 scores biweekly. Safety assessment at each visit. Refer to psychiatry if: No improvement after 8 weeks, Suicidal ideation, Co-morbid substance use. Evidence level: Grade A recommendation.',
 1),
('DOC005', 'Clinical Documentation Requirements', 'policy',
 'All clinical notes must: Include evidence-based citations for treatment decisions, Document informed consent, Record patient-reported outcomes, Note any deviations from standard protocols with justification. AI-assisted notes require clinician review and signature. Retention period: 7 years minimum.',
 1);
