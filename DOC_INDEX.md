# 📚 Documentation Index / 文档索引

Complete guide to the Dual-Track Healthcare Demo documentation.

---

## 🚀 Getting Started / 快速开始

**新用户从这里开始 / Start here if you're new:**

1. **[README.md](./README.md)** - 项目概览与快速开始指南 (中英双语)
   - Project overview and quick start (Bilingual)
   - Installation prerequisites
   - One-command startup

2. **[QUICKSTART.md](./QUICKSTART.md)** - 详细安装与配置指南
   - Step-by-step setup instructions
   - Troubleshooting guide
   - Verification checklist

3. **[DEMO_SCRIPT.md](./DEMO_SCRIPT.md)** - 10分钟演示脚本
   - Path A: Public → Clinician Transfer
   - Path B: Clinician Workflow
   - Path C: Governance Enforcement
   - Complete walkthrough with screenshots

---

## 📖 Technical Documentation / 技术文档

**深入了解系统架构与实现 / For understanding architecture and implementation:**

4. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - 系统架构详解
   - Project structure
   - Technology stack
   - Database schema
   - State machines
   - Performance benchmarks

5. **[API_DOCS.md](./API_DOCS.md)** - API 完整文档
   - 22 API endpoints
   - Request/response examples
   - Error codes
   - Authentication (future)
   - Rate limits

6. **[schema.sql](./schema.sql)** - 数据库 Schema + 种子数据
   - 9 database tables
   - Indexes and relationships
   - Seed data for demo

---

## ✅ Delivery & Acceptance / 交付验收

**项目交付相关文档 / For project delivery and acceptance:**

7. **[交付清单_DELIVERY_CHECKLIST.md](./交付清单_DELIVERY_CHECKLIST.md)** - 完整交付清单 (中英双语)
   - All deliverables listed
   - Requirements validation
   - Code statistics
   - Acceptance criteria

8. **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - 项目总结 (中英双语)
   - Key highlights
   - Demo paths summary
   - FAQ
   - Next steps

---

## 🛠 Configuration Files / 配置文件

**环境配置与脚本 / For environment setup and configuration:**

9. **[.env.example](./.env.example)** - 环境变量模板
   - Ollama configuration
   - API settings
   - Database path

10. **[package.json](./package.json)** - Monorepo 配置
    - Workspace structure
    - npm scripts
    - Dependencies

11. **[scripts/setup.js](./scripts/setup.js)** - 初始化脚本
    - Database initialization
    - Environment setup
    - Dependency installation

12. **[scripts/pull-models.js](./scripts/pull-models.js)** - 模型拉取脚本
    - Ollama model downloading
    - Model verification

---

## 📁 Code Organization / 代码组织

### Backend / 后端

**Core Files:**
- `services/api/main.py` - FastAPI entry point
- `services/api/database.py` - Database connection
- `services/api/ollama_client.py` - Ollama HTTP client
- `services/api/rag_system.py` - RAG implementation
- `services/api/governance.py` - Policy enforcement

**API Routers:**
- `services/api/routers/public.py` - Public Track endpoints
- `services/api/routers/clinician.py` - Clinician Track endpoints
- `services/api/routers/audit.py` - Audit endpoints
- `services/api/routers/governance.py` - Governance endpoints

### Frontend / 前端

**Public Chat:**
- `apps/public-chat/src/pages/ChatPage.jsx` - Chat interface
- `apps/public-chat/src/pages/PreAssessmentPage.jsx` - Pre-assessment
- `apps/public-chat/src/pages/ReceiptPage.jsx` - Transfer receipt

**Clinician Console:**
- `apps/clinician-console/src/pages/QueuePage.jsx` - Case queue
- `apps/clinician-console/src/pages/DraftEditorPage.jsx` - Draft editor
- `apps/clinician-console/src/pages/AuditPage.jsx` - Audit trail

---

## 🎯 Quick Reference / 快速参考

### Commands / 命令速查

```bash
# Setup
pnpm install              # Install dependencies
pnpm ollama:pull          # Pull Ollama models
pnpm setup                # Initialize database

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

### File Sizes / 文件大小

| Category | Lines | Files |
|----------|-------|-------|
| Backend Python | ~1,800 | 9 |
| Frontend React | ~1,000 | 6 |
| Database SQL | ~250 | 1 |
| Scripts | ~200 | 2 |
| Documentation | ~1,800 | 8 |
| **Total** | **~5,050** | **26** |

---

## 📊 Documentation Coverage / 文档覆盖范围

### ✅ Covered Topics / 已覆盖主题

- [x] Installation & Setup
- [x] Architecture & Design
- [x] API Reference
- [x] Database Schema
- [x] Demo Walkthrough
- [x] Troubleshooting
- [x] Production Deployment
- [x] Code Organization
- [x] Governance Policies
- [x] RAG Implementation
- [x] Risk Assessment
- [x] Event Logging

### 📝 Language Support / 语言支持

- **English**: All documents
- **中文 (Chinese)**: README, QUICKSTART, 交付清单, PROJECT_SUMMARY

---

## 🔍 Search by Topic / 按主题查找

### Installation / 安装
→ [QUICKSTART.md](./QUICKSTART.md)  
→ [README.md](./README.md) - Prerequisites section

### Demo / 演示
→ [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)  
→ [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Demo Paths section

### API / 接口
→ [API_DOCS.md](./API_DOCS.md)  
→ [services/api/routers/](./services/api/routers/) - Implementation

### Architecture / 架构
→ [ARCHITECTURE.md](./ARCHITECTURE.md)  
→ [schema.sql](./schema.sql) - Database design

### Governance / 治理
→ [services/api/governance.py](./services/api/governance.py)  
→ [API_DOCS.md](./API_DOCS.md) - Governance API section

### RAG / 检索增强
→ [services/api/rag_system.py](./services/api/rag_system.py)  
→ [ARCHITECTURE.md](./ARCHITECTURE.md) - RAG System section

### Ollama Integration / Ollama 集成
→ [services/api/ollama_client.py](./services/api/ollama_client.py)  
→ [.env.example](./.env.example) - Model configuration

### Audit / 审计
→ [apps/clinician-console/src/pages/AuditPage.jsx](./apps/clinician-console/src/pages/AuditPage.jsx)  
→ [API_DOCS.md](./API_DOCS.md) - Audit API section

### Troubleshooting / 故障排除
→ [QUICKSTART.md](./QUICKSTART.md) - Troubleshooting section  
→ [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - FAQ section

### Production / 生产部署
→ [ARCHITECTURE.md](./ARCHITECTURE.md) - Production Considerations  
→ [交付清单_DELIVERY_CHECKLIST.md](./交付清单_DELIVERY_CHECKLIST.md) - Section 8

---

## 🎓 Learning Path / 学习路径

### Beginner / 初学者
1. Read [README.md](./README.md)
2. Follow [QUICKSTART.md](./QUICKSTART.md)
3. Run [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)

### Intermediate / 中级
1. Study [ARCHITECTURE.md](./ARCHITECTURE.md)
2. Review [API_DOCS.md](./API_DOCS.md)
3. Explore code in `services/api/`

### Advanced / 高级
1. Deep dive into [schema.sql](./schema.sql)
2. Modify [governance.py](./services/api/governance.py)
3. Extend [rag_system.py](./services/api/rag_system.py)

---

## 📞 Support Resources / 支持资源

### For Questions / 问题咨询
- Technical issues → [QUICKSTART.md](./QUICKSTART.md) - Troubleshooting
- API usage → [API_DOCS.md](./API_DOCS.md)
- Architecture questions → [ARCHITECTURE.md](./ARCHITECTURE.md)

### For Customization / 自定义开发
- Adding features → [ARCHITECTURE.md](./ARCHITECTURE.md) - Code organization
- Modifying workflows → [schema.sql](./schema.sql) - templates table
- Changing models → [.env.example](./.env.example) - Model configuration

### For Deployment / 部署相关
- Production setup → [ARCHITECTURE.md](./ARCHITECTURE.md) - Deployment Options
- Security → [交付清单_DELIVERY_CHECKLIST.md](./交付清单_DELIVERY_CHECKLIST.md) - Section 8

---

## 📝 Document Versions / 文档版本

All documents are version 1.0.0 as of 2025-01-15.

**Last Updated / 最后更新**: 2025-01-15  
**Status / 状态**: ✅ Complete / 完成  
**Language / 语言**: English + 中文

---

## 🔖 Quick Links / 快速链接

| What you need | Document | Section |
|---------------|----------|---------|
| Install the project | [QUICKSTART.md](./QUICKSTART.md) | Installation Steps |
| Run the demo | [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) | All paths |
| Understand architecture | [ARCHITECTURE.md](./ARCHITECTURE.md) | Full document |
| Use the API | [API_DOCS.md](./API_DOCS.md) | All endpoints |
| Configure models | [.env.example](./.env.example) | Ollama section |
| Check requirements | [交付清单_DELIVERY_CHECKLIST.md](./交付清单_DELIVERY_CHECKLIST.md) | Section 3 |
| Deploy to production | [ARCHITECTURE.md](./ARCHITECTURE.md) | Deployment Options |
| Troubleshoot issues | [QUICKSTART.md](./QUICKSTART.md) | Troubleshooting |

---

**Happy Coding! / 祝编程愉快! 🚀**
