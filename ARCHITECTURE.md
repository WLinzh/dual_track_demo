# Project Structure

```
Dual_track_demo/
├── apps/
│   ├── public-chat/              # Public Track Frontend (Vite + React)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── ChatPage.jsx           # Supportive dialogue
│   │   │   │   ├── PreAssessmentPage.jsx  # Structured outputs + consent
│   │   │   │   └── ReceiptPage.jsx        # Transfer receipt
│   │   │   ├── main.jsx
│   │   │   └── index.css
│   │   ├── index.html
│   │   ├── vite.config.js
│   │   └── package.json
│   │
│   └── clinician-console/        # Clinician Track Frontend (Vite + React)
│       ├── src/
│       │   ├── pages/
│       │   │   ├── QueuePage.jsx          # Case queue + template selection
│       │   │   ├── DraftEditorPage.jsx    # Dual-channel editor
│       │   │   └── AuditPage.jsx          # Audit trail with model filtering
│       │   ├── main.jsx
│       │   └── index.css
│       ├── index.html
│       ├── vite.config.js
│       └── package.json
│
├── services/
│   └── api/                      # FastAPI Backend
│       ├── routers/
│       │   ├── __init__.py
│       │   ├── public.py          # Public Track endpoints
│       │   ├── clinician.py       # Clinician Track endpoints
│       │   ├── audit.py           # Audit endpoints
│       │   └── governance.py      # Governance/policy endpoints
│       ├── main.py                # FastAPI app entry
│       ├── database.py            # Async SQLite connection
│       ├── ollama_client.py       # Ollama HTTP API client
│       ├── rag_system.py          # RAG with embedding + vector search
│       ├── governance.py          # Risk engine + policy tools
│       ├── requirements.txt       # Python dependencies
│       └── package.json
│
├── scripts/
│   ├── setup.js                  # Initialize database + env
│   └── pull-models.js            # Pull Ollama models
│
├── data/
│   └── dual_track.db             # SQLite database (created on init)
│
├── schema.sql                    # Database schema + seed data
├── package.json                  # Monorepo root
├── .env.example                  # Environment template
├── .gitignore
├── README.md                     # Quick start guide
├── DEMO_SCRIPT.md                # 10-minute walkthrough
└── API_DOCS.md                   # API reference
```

## Key Technologies

### Frontend
- **React 18** with hooks
- **Vite** for fast dev + HMR
- **React Router** for navigation
- **Axios** for HTTP requests

### Backend
- **FastAPI** (async Python)
- **Ollama HTTP API** (via httpx)
- **SQLite** (aiosqlite for async)
- **NumPy + scikit-learn** for vector operations

### Models (Ollama)
- **qwen2.5:1.5b-instruct** (Public Track)
- **qwen2.5:14b-instruct** (Clinician Track)
- **qwen3-embedding** (RAG embeddings)

## Database Schema

### Core Tables
- **cases**: Shared case records
- **intake_capsules**: Structured public assessments
- **drafts**: Clinician-generated documents
- **event_logs**: Unified audit trail
- **consents**: Transfer consent records
- **documents**: Knowledge base for RAG
- **templates**: Workflow templates
- **prompt_versions**: Prompt versioning
- **safety_upgrades**: Safety escalation events

### Key Relationships
```
cases 1──N intake_capsules
cases 1──N drafts
cases 1──N event_logs
cases 1──N consents
drafts N──1 templates
```

## Architecture Highlights

### 1. Track Separation
- **Public**: Fast model, structured outputs, consent-based
- **Clinician**: Strong model, RAG-required, review-sign flow
- **Shared**: Governance, audit backbone

### 2. Ollama Integration
- Models enforced backend-side (no frontend override)
- `/api/chat` for conversational
- `/api/generate` for single-shot
- `/api/embed` for RAG embeddings
- Structured outputs via `format` parameter

### 3. RAG System
- Real embedding generation (qwen3-embedding)
- Cosine similarity search
- Top-k retrieval with scores
- Mandatory citation enforcement

### 4. Governance
- **Toolization**: Rule engine outputs, LLM doesn't decide
- **Risk Assessment**: Pattern-based triggers
- **Policy Enforcement**: Hard blocks (400 errors)
- **Event Logging**: All actions tracked

### 5. State Machines
**Public Flow:**
```
Chat → Pre-Assessment → Consent → Transfer → Clinician Queue
```

**Clinician Flow:**
```
Draft → Check Policy → Edit → Sign → Write-back → Archive
             ↓ (if blocked)
          Blocked ← (fix) → Edit
```

## Development Commands

```bash
# Setup
pnpm install              # Install all dependencies
pnpm ollama:pull          # Pull required models
pnpm setup                # Initialize DB + env

# Development
pnpm dev                  # Start all services
pnpm dev:api              # API only
pnpm dev:public           # Public chat only
pnpm dev:clinician        # Clinician console only

# Access
# Public:    http://localhost:5173
# Clinician: http://localhost:5174
# API:       http://localhost:3001
```

## Production Considerations

### Current State (Demo)
- ✓ Runnable, demonstrable, auditable
- ✓ Core governance policies enforced
- ✓ Full event logging
- ✓ Model strategy enforced

### To Production (Enhancements Needed)
- [ ] Authentication (JWT for clinicians)
- [ ] HTTPS + secure sessions
- [ ] PostgreSQL (replace SQLite)
- [ ] Vector DB (FAISS/Chroma/Pinecone)
- [ ] Rate limiting
- [ ] Model queuing/load balancing
- [ ] Comprehensive error handling
- [ ] Input sanitization
- [ ] HIPAA compliance audit
- [ ] Backup/disaster recovery
- [ ] Monitoring (Prometheus/Grafana)
- [ ] CI/CD pipeline

## Testing Strategy

### Manual Testing (Demo Script)
- Path A: Public → Transfer
- Path B: Clinician workflow
- Path C: Governance enforcement

### Future Automated Testing
```python
# Unit tests
pytest services/api/tests/

# Integration tests
pytest services/api/tests/integration/

# E2E tests
playwright test
```

## Deployment Options

### Option 1: Docker Compose
```yaml
services:
  ollama:
    image: ollama/ollama
  api:
    build: ./services/api
  public-chat:
    build: ./apps/public-chat
  clinician-console:
    build: ./apps/clinician-console
```

### Option 2: Kubernetes
- Separate pods for each service
- Ollama with GPU support
- Horizontal scaling for API

### Option 3: Serverless
- API on AWS Lambda + API Gateway
- Frontends on Vercel/Netlify
- Ollama on dedicated GPU instance

## Performance Benchmarks

### Model Inference Times (Approximate)
| Model | Input Tokens | Time (CPU) | Time (GPU) |
|-------|--------------|------------|------------|
| qwen2.5:1.5b | 100 | ~2s | ~0.5s |
| qwen2.5:14b | 100 | ~15s | ~2s |
| qwen3-embedding | 100 | ~1s | ~0.3s |

### Database Operations
- Case creation: <10ms
- Event logging: <5ms
- Audit query (1000 events): ~50ms

## Security Notes

### Current Implementation
- No authentication (demo only)
- SQLite (file-based, single-user safe)
- Local Ollama (no external API keys)

### Production Requirements
- RBAC (Role-Based Access Control)
- Encrypted storage
- Audit log immutability
- PII anonymization options
- GDPR compliance
