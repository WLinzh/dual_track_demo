# API Documentation

Base URL: `http://localhost:3001`

## Health & Info

### GET /
Root endpoint with service information
```json
{
  "service": "Dual-Track Healthcare API",
  "version": "1.0.0",
  "tracks": ["public", "clinician"],
  "models": {
    "public": "qwen2.5:1.5b-instruct",
    "clinician": "qwen2.5:14b-instruct",
    "embedding": "qwen3-embedding"
  }
}
```

### GET /health
Health check with Ollama connectivity
```json
{
  "status": "healthy",
  "ollama": "connected"
}
```

---

## Public Track API

### POST /api/public/chat
Supportive dialogue with risk assessment

**Request:**
```json
{
  "message": "I've been feeling depressed",
  "case_id": 1  // optional, creates new case if omitted
}
```

**Response:**
```json
{
  "response": "I'm sorry to hear that...",
  "case_id": 1,
  "risk_assessment": {
    "risk_level": "medium",
    "triggers": ["depress"],
    "explanation": "Risk assessment based on 1 trigger(s)...",
    "recommended_action": "ROUTINE: Recommend clinician follow-up..."
  },
  "safety_upgrade": null  // or object if triggered
}
```

### POST /api/public/pre-assessment
Generate structured intake capsule

**Request:**
```json
{
  "case_id": 1,
  "conversation_summary": "User: I'm depressed\nAssistant: ..."
}
```

**Response:**
```json
{
  "capsule_id": "CAP-ABC123",
  "structured_data": {
    "chief_complaint": "Depression",
    "symptom_duration": "2 weeks",
    "severity_score": 7,
    "risk_indicators": ["hopelessness"],
    "self_description": "I've been feeling really down..."
  },
  "self_description": "User's own words...",
  "model_summary": "Model-generated summary: Depression (Severity: 7/10)",
  "validation_status": "valid",
  "ollama_model": "qwen2.5:1.5b-instruct"
}
```

### POST /api/public/consent
Record consent for transfer

**Request:**
```json
{
  "case_id": 1,
  "capsule_id": "CAP-ABC123",
  "consent_confirmed": true,
  "consent_scope": ["intake_capsule", "chat_history"]
}
```

**Response:**
```json
{
  "success": true,
  "consent_recorded": true
}
```

### POST /api/public/transfer
Transfer case to clinician track

**Request:**
```json
{
  "case_id": 1,
  "capsule_id": "CAP-ABC123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "case_id": 1,
  "status": "transferred",
  "message": "Case successfully transferred to clinician queue"
}
```

**Response (Policy Block):**
```json
{
  "error": "Transfer blocked by policy",
  "reason": "Transfer eligibility check failed",
  "blockers": ["User consent not confirmed"]
}
```

### GET /api/public/cases/{case_id}
Get case details with related data

---

## Clinician Track API

### GET /api/clinician/queue
Get cases in clinician queue

**Response:**
```json
[
  {
    "case_id": 1,
    "case_number": "PUB-20250115-ABC123",
    "status": "transferred",
    "origin_track": "public",
    "created_at": "2025-01-15T10:30:00",
    "has_capsule": true
  }
]
```

### GET /api/clinician/templates
Get available workflow templates

**Response:**
```json
[
  {
    "template_type": "handover",
    "display_name": "Shift Handover Note",
    "input_scope": ["patient_id", "current_status", "time_range"],
    "steps": ["retrieve_recent_records", "rag_search_guidelines", "generate_draft"]
  }
]
```

### POST /api/clinician/draft/generate
Generate clinical draft with RAG

**Request:**
```json
{
  "case_id": 1,
  "template_type": "handover",
  "context": {
    "chief_complaint": "Patient assessment",
    "case_number": "PUB-20250115-ABC123"
  }
}
```

**Response:**
```json
{
  "draft_id": "DRAFT-XYZ789",
  "content": "Patient Summary:\n...\n[DOC:DOC001] According to protocol...",
  "evidence_refs": [
    {
      "doc_id": "DOC001",
      "title": "Handover Communication Standards",
      "snippet": "Effective handover must include...",
      "score": 0.87,
      "category": "guideline"
    }
  ],
  "pending_tasks": ["Review and verify all citations"],
  "risk_points": ["Monitor patient progress"],
  "status": "draft",
  "ollama_model": "qwen2.5:14b-instruct"
}
```

### PUT /api/clinician/draft/edit
Edit draft content

**Request:**
```json
{
  "draft_id": "DRAFT-XYZ789",
  "edited_content": "Updated content with [DOC:DOC001]...",
  "clinician_notes": "Added clarification"
}
```

**Response:**
```json
{
  "success": true,
  "draft_id": "DRAFT-XYZ789",
  "status": "editing"
}
```

### POST /api/clinician/draft/sign
Sign draft (with policy enforcement)

**Request:**
```json
{
  "draft_id": "DRAFT-XYZ789",
  "clinician_id": "DR001"
}
```

**Response (Success):**
```json
{
  "success": true,
  "draft_id": "DRAFT-XYZ789",
  "status": "signed",
  "policy_check": {
    "allowed": true,
    "reason": "Citation policy satisfied",
    "validation_result": {
      "has_citations": true,
      "citation_count": 3,
      "cited_docs": ["DOC001", "DOC002"],
      "valid": true
    }
  }
}
```

**Response (Policy Block - HTTP 400):**
```json
{
  "error": "PolicyBlocked",
  "reason": "Draft missing citation marks. Found evidence: DOC001, DOC002, but no [DOC:...] citations in content.",
  "validation": {
    "has_citations": false,
    "citation_count": 0,
    "cited_docs": [],
    "valid": false
  },
  "message": "Draft blocked by mandatory citation policy..."
}
```

### POST /api/clinician/draft/write-back
Write signed draft back to system

**Request:**
```json
{
  "draft_id": "DRAFT-XYZ789"
}
```

**Response:**
```json
{
  "success": true,
  "draft_id": "DRAFT-XYZ789",
  "status": "written_back",
  "message": "Draft successfully written back to system"
}
```

### GET /api/clinician/drafts/{draft_id}
Get draft details

### GET /api/clinician/cases/{case_id}/drafts
Get all drafts for a case

---

## Audit API

### GET /api/audit/events
Get audit events with filtering

**Query Parameters:**
- `track` (optional): public, clinician, governance
- `event_type` (optional): input, generation, retrieval, policy_trigger, etc.
- `ollama_model` (optional): Filter by model (FIRST-CLASS FIELD)
- `risk_level` (optional): low, medium, high, critical
- `case_id` (optional): Filter by case
- `limit` (optional, default 50): Max results

**Response:**
```json
[
  {
    "id": 42,
    "track": "clinician",
    "event_type": "policy_trigger",
    "case_id": 1,
    "draft_id": "DRAFT-XYZ789",
    "ollama_model": "policy_engine",
    "prompt_version_id": 2,
    "user_id": "DR001",
    "risk_level": "high",
    "created_at": "2025-01-15T10:45:00",
    "payload_summary": {
      "policy": "mandatory_citations",
      "allowed": false,
      "reason": "Missing citation marks"
    }
  }
]
```

### GET /api/audit/events/{event_id}
Get full event details including complete payload

### GET /api/audit/stats
Get audit statistics

**Response:**
```json
{
  "total_events": 156,
  "by_track": {
    "public": 82,
    "clinician": 64,
    "governance": 10
  },
  "by_model": {
    "qwen2.5:1.5b-instruct": 82,
    "qwen2.5:14b-instruct": 64,
    "qwen3-embedding": 45,
    "policy_engine": 10,
    "rule_engine": 5
  },
  "by_risk_level": {
    "low": 120,
    "medium": 25,
    "high": 8,
    "critical": 3
  }
}
```

### GET /api/audit/models
Get list of all ollama_models in audit trail

**Response:**
```json
{
  "models": [
    "qwen2.5:1.5b-instruct",
    "qwen2.5:14b-instruct",
    "qwen3-embedding",
    "policy_engine",
    "rule_engine",
    "human_clinician",
    "system"
  ]
}
```

### GET /api/audit/policy-triggers
Get recent policy trigger events

---

## Governance API

### POST /api/governance/assess-risk
Assess safety risk using rule engine

**Request:**
```json
{
  "user_input": "I feel hopeless and want to end it all",
  "severity_score": 9
}
```

**Response:**
```json
{
  "risk_level": "critical",
  "triggers": [
    "High-risk keyword detected: \\b(suicid|kill myself|end my life|want to die)\\b",
    "High severity score: 9/10 (threshold: 8+)"
  ],
  "explanation": "Risk assessment based on 2 trigger(s). Automated rule-based evaluation using clinical safety protocols.",
  "recommended_action": "IMMEDIATE: Transfer to crisis intervention. Clinician contact required within 1 hour."
}
```

### GET /api/governance/policies
List all active governance policies

**Response:**
```json
{
  "policies": [
    {
      "name": "mandatory_citations",
      "description": "All clinician drafts must include evidence citations",
      "enforcement": "hard_block",
      "track": "clinician"
    },
    {
      "name": "transfer_eligibility",
      "description": "Transfer requires valid consent and capsule",
      "enforcement": "hard_block",
      "track": "public"
    },
    {
      "name": "safety_upgrade",
      "description": "High-risk cases trigger automatic escalation",
      "enforcement": "automatic_trigger",
      "track": "public"
    }
  ]
}
```

---

## Error Responses

All endpoints follow standard HTTP status codes:

- **200**: Success
- **400**: Bad request / Policy blocked
- **404**: Resource not found
- **500**: Server error
- **503**: Service unavailable (Ollama down)

**Error Format:**
```json
{
  "detail": "Error message or detailed object"
}
```

---

## Model Strategy (Backend-Enforced)

| Track | Endpoint | Model | Purpose |
|-------|----------|-------|---------|
| Public | /api/public/chat | qwen2.5:1.5b-instruct | Fast dialogue |
| Public | /api/public/pre-assessment | qwen2.5:1.5b-instruct | Structured outputs |
| Clinician | /api/clinician/draft/generate | qwen2.5:14b-instruct | Strong clinical text |
| RAG | (internal) | qwen3-embedding | Semantic search |
| Governance | (rule engine) | N/A | Independent tools |

**Note:** Model selection is enforced server-side based on track. Frontend cannot override.

---

## Event Types Reference

| Event Type | Description | Typical Track |
|------------|-------------|---------------|
| input | User input received | public, clinician |
| generation | LLM output generated | public, clinician |
| retrieval | RAG evidence retrieved | clinician |
| edit | Human edit action | clinician |
| sign | Draft signature | clinician |
| write_back | Final write-back | clinician |
| policy_trigger | Policy enforcement event | governance |
| safety_upgrade | Safety escalation | public |
| tool_output | Independent tool result | governance |
| transfer | Case transferred | public |
| consent | Consent recorded | public |

---

## Rate Limits

- No rate limits in demo mode
- Production deployment should add:
  - Per-IP rate limiting
  - Per-user quotas
  - Model inference queuing

---

## Authentication

- Demo mode: No authentication
- Production: Add JWT-based auth
  - Public track: Anonymous sessions
  - Clinician track: Clinician credentials required
  - Audit track: Admin-only access
