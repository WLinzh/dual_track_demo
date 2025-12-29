# Dual-Track Healthcare Demo (Ollama + Qwen)

生产级双轨道医疗演示系统：Public Chatbot + Clinician Agentic Workflow，共享 Governance/Audit 主干。

Production-ready demo with Public Chatbot + Clinician Agentic Workflow sharing Governance/Audit backbone.

## 核心特性 / Key Features

- **Public Track 公众轨道**: 快速小模型 (qwen2.5:1.5b) + 结构化输出 + 同意转诊
  - Fast small model + structured outputs + consent transfer
  - 自动风险评估与安全升级 / Automatic risk assessment & safety upgrades
  
- **Clinician Track 临床医生轨道**: 强模型 (qwen2.5:14b) + 强制 RAG 引用 + 审阅-编辑-签名流程
  - Strong model + mandatory RAG citations + review-edit-sign workflow
  - 双通道界面（对话+结构化面板）/ Dual-channel UI (dialogue + structured panel)
  
- **Shared Governance 共享治理**: 统一审计追踪、风险引擎、策略执行
  - Unified audit trail, risk engine, policy enforcement
  - ollama_model 作为一等字段可过滤 / ollama_model as first-class filterable field

## Architecture 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Ollama + Qwen Models                      │
│  qwen2.5:1.5b (Public) | qwen2.5:14b (Clinician) | qwen3-embedding (RAG) │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Public Chat UI  │───▶│   FastAPI Backend │◀───│ Clinician Console │
│  (Port 5173)     │    │   (Port 3001)     │    │  (Port 5174)      │
│                  │    │                   │    │                   │
│ - Supportive     │    │ - Ollama Client   │    │ - Queue Mgmt      │
│   Dialogue       │    │ - RAG System      │    │ - Draft Editor    │
│ - Pre-Assessment │    │ - Governance      │    │ - Audit Trail     │
│ - Consent        │    │ - SQLite DB       │    │                   │
└──────────────────┘    └──────────────────┘    └──────────────────┘
                              ↓
                    ┌──────────────────┐
                    │  SQLite Database │
                    │  + Event Logs    │
                    └──────────────────┘
```

## Prerequisites

1. **Ollama** installed and running:
   ```bash
   # Install Ollama from https://ollama.ai
   ollama serve
   ```

2. **Node.js** 18+ and **pnpm**:
   ```bash
   npm install -g pnpm
   ```

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Pull required Ollama models
pnpm ollama:pull

# 3. Setup database and seed data
pnpm setup

# 4. Start all services
pnpm dev
```

Access:
- Public Chat: http://localhost:5173
- Clinician Console: http://localhost:5174
- API: http://localhost:3001

## Models Required

```bash
ollama pull qwen2.5:1.5b-instruct
ollama pull qwen2.5:14b-instruct
ollama pull qwen3-embedding
```

## Demo Paths (10-min walkthrough)

See `DEMO_SCRIPT.md` for detailed walkthrough.

### Path A: Public → Clinician Transfer
1. Public chat → pre-assessment (structured output)
2. Consent to transfer
3. View in Clinician queue

### Path B: Clinician Workflow
1. Select handover/discharge template
2. RAG retrieves evidence with citations
3. Review/edit draft
4. Sign and write-back

### Path C: Governance Enforcement
1. Public: Safety upgrade triggered
2. Clinician: Missing citations → blocked write-back
3. View both in audit log (filter by ollama_model)

## Project Structure

```
apps/
  public-chat/          # Public chatbot UI (Vite + React)
  clinician-console/    # Clinician workflow UI (Vite + React)
services/
  api/                  # FastAPI backend
scripts/                # Setup and utility scripts
data/                   # SQLite database
```
