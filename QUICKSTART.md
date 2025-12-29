# Dual-Track Demo Quick Start

Complete production-ready demo in **5 commands**. Total setup time: ~10-15 minutes.

## What You're Building

A dual-track healthcare system with:
- **Public Track**: Fast chatbot (qwen2.5:1.5b) with structured outputs + safety upgrades
- **Clinician Track**: Strong model (qwen2.5:14b) with mandatory RAG citations
- **Shared Governance**: Unified audit, policy enforcement, risk assessment

## Prerequisites

1. **Ollama installed** (https://ollama.ai)
2. **Node.js 18+** and **pnpm**
3. **Python 3.8+** with pip

## Installation Steps

### 1. Clone/Navigate to Project
```bash
cd /Users/linmacbook/Dual_track_demo
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Pull Ollama Models
```bash
pnpm ollama:pull
```
This pulls:
- `qwen2.5:1.5b-instruct` (~1GB)
- `qwen2.5:14b-instruct` (~8GB)  
- `qwen3-embedding` (~1GB)

**Note:** This may take 5-15 minutes depending on your connection.

### 4. Setup Database & Environment
```bash
pnpm setup
```
This:
- Creates `.env` from `.env.example`
- Creates `data/` directory
- Installs Python dependencies
- Checks Ollama connectivity

### 5. Start All Services
```bash
pnpm dev
```

This starts:
- **API** (FastAPI): http://localhost:3001
- **Public Chat**: http://localhost:5173
- **Clinician Console**: http://localhost:5174

---

## Verify Installation

### Check API Health
```bash
curl http://localhost:3001/health
```
Expected: `{"status":"healthy","ollama":"connected"}`

### Check Models
```bash
curl http://localhost:3001/
```
Expected: Service info with model configuration

### Open Frontend
1. Navigate to http://localhost:5173
2. You should see "💬 Health Support Chat"

---

## Run Demo (10 Minutes)

See [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) for detailed walkthrough.

### Quick Test Path

1. **Public Chat** (http://localhost:5173)
   - Type: "I feel depressed and anxious"
   - Observe: Risk assessment, supportive response
   - Click: "Continue to Pre-Assessment"
   - Click: "Generate Pre-Assessment"
   - Observe: Structured JSON output with validation status
   - Check consent boxes and transfer

2. **Clinician Console** (http://localhost:5174)
   - See transferred case in queue
   - Select case, choose "Shift Handover" template
   - Click "Generate Draft with Evidence Citations"
   - Observe: Draft with [DOC:...] citations
   - Click "Sign Draft"
   - Click "Write Back"

3. **Audit Trail** (http://localhost:5174/audit)
   - Filter by "ollama_model"
   - See all events logged
   - Observe model distribution stats

---

## Troubleshooting

### "Ollama is not running"
```bash
# Start Ollama in background
ollama serve
```

### "Model not found"
```bash
# Manually pull a model
ollama pull qwen2.5:1.5b-instruct
```

### "Python dependencies failed"
```bash
# Manual install
cd services/api
pip3 install -r requirements.txt
```

### "Port already in use"
Edit `.env` and change ports:
```
API_PORT=3002  # Change from 3001
```

### API won't start
```bash
# Check Python path
which python3

# Try running directly
cd services/api
python3 -m uvicorn main:app --reload
```

### Frontend build errors
```bash
# Clear and reinstall
rm -rf node_modules apps/*/node_modules
pnpm install
```

---

## Development Workflow

### Start Individual Services

```bash
# API only
pnpm dev:api

# Public chat only
pnpm dev:public

# Clinician console only
pnpm dev:clinician
```

### Reset Database
```bash
rm data/dual_track.db
pnpm dev:api  # Will reinitialize from schema.sql
```

### View Logs

API logs show:
- Ollama requests
- Database operations
- Policy enforcement events

Check terminal where `pnpm dev` is running.

---

## Key Files to Explore

| File | Purpose |
|------|---------|
| `schema.sql` | Database schema + seed data |
| `services/api/ollama_client.py` | Ollama integration |
| `services/api/rag_system.py` | RAG with embeddings |
| `services/api/governance.py` | Policy enforcement |
| `services/api/routers/public.py` | Public Track API |
| `services/api/routers/clinician.py` | Clinician Track API |
| `apps/public-chat/src/pages/ChatPage.jsx` | Public UI |
| `apps/clinician-console/src/pages/DraftEditorPage.jsx` | Clinician UI |

---

## Customization

### Change Models

Edit `.env`:
```bash
OLLAMA_PUBLIC_MODEL=qwen2.5:3b-instruct     # Upgrade from 1.5b
OLLAMA_CLINICIAN_MODEL=qwen2.5:7b-instruct  # Downgrade for speed
```

Restart services.

### Add Knowledge Documents

Edit `schema.sql` INSERT statements for `documents` table, or use API:
```python
# In Python shell
from rag_system import rag_system
await rag_system.index_document(
    doc_id="DOC999",
    title="New Protocol",
    content="Protocol content...",
    category="protocol"
)
```

### Modify Risk Thresholds

Edit `services/api/governance.py`:
```python
HIGH_RISK_KEYWORDS = [
    r'\b(your|custom|patterns)\b'
]
```

---

## Production Deployment

See [ARCHITECTURE.md](./ARCHITECTURE.md) for:
- Docker Compose setup
- Kubernetes deployment
- Security hardening
- Performance optimization

### Minimal Production Checklist
- [ ] Enable authentication
- [ ] Use PostgreSQL instead of SQLite
- [ ] Add HTTPS/TLS
- [ ] Implement rate limiting
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Review HIPAA compliance

---

## API Examples

### Test Risk Assessment
```bash
curl -X POST http://localhost:3001/api/governance/assess-risk \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "I want to hurt myself",
    "severity_score": 9
  }'
```

### Get Audit Stats
```bash
curl http://localhost:3001/api/audit/stats
```

### Filter by Model
```bash
curl "http://localhost:3001/api/audit/events?ollama_model=qwen2.5:14b-instruct&limit=10"
```

---

## Learning Path

1. **Start Simple**: Run Public chat → Pre-assessment → Transfer
2. **Explore Clinician**: Generate draft → Observe RAG → Sign → Write-back
3. **Test Governance**: Trigger safety upgrade, test missing citations
4. **Review Audit**: Filter events, examine policy triggers
5. **Read Code**: Follow one request through the full stack
6. **Customize**: Add a new workflow template or knowledge document

---

## Support & Documentation

- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **API Reference**: [API_DOCS.md](./API_DOCS.md)
- **Demo Script**: [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)
- **Main README**: [README.md](./README.md)

---

## What's Next?

After successfully running the demo:

1. **Experiment with Models**: Try different Qwen variants
2. **Expand Knowledge Base**: Add domain-specific documents
3. **Build New Templates**: Create discharge or follow-up workflows
4. **Enhance Governance**: Add custom risk rules
5. **Deploy**: Containerize and deploy to cloud

**Happy building! 🚀**
