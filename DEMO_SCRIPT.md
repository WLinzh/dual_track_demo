# Demo Script - 10-Minute Walkthrough

This script guides you through the three demo paths showcasing the Dual-Track system.

## Prerequisites

```bash
# Ensure all services are running
pnpm dev

# Verify endpoints:
# - Public Chat: http://localhost:5173
# - Clinician Console: http://localhost:5174
# - API: http://localhost:3001
```

---

## Demo Path A: Public → Clinician Transfer (3-4 minutes)

**Demonstrates:** Structured outputs, consent transfer, safety risk assessment

### Steps:

1. **Open Public Chat** (http://localhost:5173)
   - Click on page, observe welcome message
   - *Expected:* "👋 Hello! I'm here to listen and support you."

2. **Initiate Conversation**
   - Type: "I've been feeling very depressed lately and having trouble sleeping"
   - Send message
   - *Expected:* Compassionate AI response from qwen2.5:1.5b-instruct

3. **Continue Dialogue** (2-3 messages)
   - Type: "It's been going on for about 2 weeks. I feel hopeless sometimes."
   - Type: "My anxiety is really bad too, I can't seem to calm down."
   - *Expected:* 
     - Risk assessment appears (Medium/High level)
     - "Continue to Pre-Assessment" button appears

4. **Generate Pre-Assessment**
   - Click "Continue to Pre-Assessment →"
   - Click "Generate Pre-Assessment"
   - *Expected:*
     - Structured JSON output appears
     - Validation status: VALID or REPAIRED
     - Self-description (user's words) vs Model summary (marked as AI)
     - Model shown: qwen2.5:1.5b-instruct

5. **Review Structured Data**
   - Observe JSON fields:
     - `chief_complaint`
     - `symptom_duration`
     - `severity_score`
     - `risk_indicators` (array)
   - *Expected:* Properly formatted, schema-validated JSON

6. **Consent & Transfer**
   - Check "Share intake capsule"
   - Check "Share conversation history"
   - Check "I consent to transfer..."
   - Click "Confirm & Transfer"
   - *Expected:* 
     - Transfer successful
     - Receipt page showing Case ID
     - "Transfer Complete" confirmation

7. **Verify in Clinician Queue**
   - Open Clinician Console (http://localhost:5174)
   - *Expected:* 
     - New case appears in queue
     - Shows "Origin: public"
     - Shows "✓ Has Capsule"

---

## Demo Path B: Clinician Workflow (4-5 minutes)

**Demonstrates:** RAG retrieval, mandatory citations, review-edit-sign, policy enforcement

### Steps:

1. **Select Case from Queue**
   - In Clinician Console, click on a case (transferred or any)
   - *Expected:* Case details shown in right panel

2. **Choose Template**
   - Select "Shift Handover Note" (🔄)
   - *Expected:*
     - Template details appear
     - Steps shown: retrieve_recent_records → rag_search_guidelines → generate_draft → structure_output

3. **Generate Draft with RAG**
   - Click "🤖 Generate Draft with Evidence Citations"
   - Wait for generation (may take 10-30 seconds with qwen2.5:14b)
   - *Expected:*
     - Redirected to draft editor page
     - Left panel shows:
       - Evidence retrieved (3 documents)
       - Each with [DOC:DOC001], [DOC:DOC002], etc.
       - Relevance scores
     - Right panel shows:
       - Generated draft content
       - Citations in format [DOC:...]

4. **Review Evidence**
   - Observe left panel evidence items:
     - "Mental Health Crisis Response Protocol"
     - "Handover Communication Standards"
     - Other guidelines
   - *Expected:* Each shows doc_id, title, snippet, relevance score

5. **Edit Draft**
   - In draft editor, modify some text
   - Click "💾 Save Edit"
   - *Expected:* "Draft saved" alert

6. **Sign Draft (with Citations)**
   - Click "✍️ Sign Draft"
   - *Expected:*
     - Status changes to "SIGNED"
     - Policy check passes (has citations)
     - Signed by DR001

7. **Write Back**
   - Click "📤 Write Back"
   - *Expected:*
     - Success message
     - Redirected to queue
     - Draft status now "written_back"

---

## Demo Path C: Governance Enforcement (2-3 minutes)

**Demonstrates:** Safety upgrade trigger, policy blocking, audit trail

### C1: Public Safety Upgrade

1. **Trigger High-Risk Keywords**
   - In Public Chat (new session)
   - Type: "I want to kill myself. I can't take it anymore."
   - *Expected:*
     - Safety Alert appears (red warning box)
     - Risk Level: CRITICAL
     - Recommended action: "IMMEDIATE: Transfer to crisis intervention..."
     - Tool output explicitly shown

2. **Verify Audit Log**
   - Go to Clinician Console → Audit
   - Filter by Event Type: "Safety Upgrade"
   - *Expected:*
     - Event logged
     - ollama_model: "rule_engine"
     - Risk level: critical
     - Payload shows triggers

### C2: Clinician Policy Block

1. **Generate Draft Without Citations**
   - In Clinician Console, generate a new draft
   - In draft editor, **remove all [DOC:...] citations** from content
   - Click "💾 Save Edit"
   - Click "✍️ Sign Draft"
   - *Expected:*
     - **RED ALERT**: "❌ Policy Blocked: PolicyBlocked"
     - Reason: "Draft missing citation marks..."
     - Status changes to "BLOCKED"
     - Cannot proceed to write-back

2. **Fix and Retry**
   - Add back citations: [DOC:DOC001]
   - Save edit
   - Sign again
   - *Expected:* Now successful

3. **Verify Audit Trail**
   - Go to Audit page
   - Filter by Event Type: "Policy Trigger"
   - *Expected:*
     - Policy block event logged
     - ollama_model: "policy_engine"
     - Payload shows violation reason

### C3: Audit Filtering by ollama_model

1. **Filter by Model**
   - In Audit page, use "All Models (Filter by ollama_model)" dropdown
   - Select "qwen2.5:1.5b-instruct"
   - *Expected:* Only public track events shown

2. **Filter by Risk Level**
   - Select Risk Level: "Critical"
   - *Expected:* Only safety upgrade events

3. **View Stats**
   - Observe top stats cards:
     - Total events
     - By track (public, clinician, governance)
     - **By model** (first-class field)
   - *Expected:* Model breakdown clearly visible

---

## Validation Checklist

After completing all paths, verify:

- [ ] Public uses qwen2.5:1.5b-instruct (visible in capsule)
- [ ] Clinician uses qwen2.5:14b-instruct (visible in draft)
- [ ] RAG uses qwen3-embedding (logged in retrieval events)
- [ ] Structured outputs validated (capsule shows validation_status)
- [ ] Consent required for transfer (blocked without consent)
- [ ] Citations required for sign (blocked without citations)
- [ ] All events logged in audit with ollama_model field
- [ ] ollama_model filterable in audit UI
- [ ] Safety upgrade triggers on high-risk input
- [ ] Policy engine outputs are explainable (shown to user)

---

## Troubleshooting

**Issue:** Ollama timeout
- **Solution:** Increase timeout or use smaller models

**Issue:** Draft generation slow
- **Solution:** qwen2.5:14b is large; consider qwen2.5:7b-instruct

**Issue:** No evidence retrieved
- **Solution:** Check database seeded with documents (schema.sql INSERT statements)

**Issue:** JSON validation fails
- **Solution:** Repair attempts up to 1; expected behavior, shows robustness

---

## Demo Talking Points

1. **Architecture**: Monorepo, shared governance, two tracks
2. **Models**: Track-specific, backend-enforced, no frontend override
3. **Structured Outputs**: JSON schema validation, repair attempts
4. **RAG**: Real embedding, vector search, mandatory citations
5. **Governance**: Independent tools (rule engine), LLM doesn't decide policy
6. **Audit**: First-class ollama_model field, full transparency
7. **Production-Ready**: State machines, error handling, event logging

---

## Post-Demo: API Exploration

```bash
# Health check
curl http://localhost:3001/health

# Get audit stats
curl http://localhost:3001/api/audit/stats

# List models used
curl http://localhost:3001/api/audit/models

# Get policies
curl http://localhost:3001/api/governance/policies

# Risk assessment (standalone)
curl -X POST http://localhost:3001/api/governance/assess-risk \
  -H "Content-Type: application/json" \
  -d '{"user_input": "I feel hopeless", "severity_score": 7}'
```

**Expected:** Well-structured JSON responses demonstrating API design
