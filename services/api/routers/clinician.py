"""
Clinician Track API Router
Strong model + mandatory RAG citations + review-edit-sign workflow
"""
import json
import uuid
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ollama_client import OllamaClient, ChatMessage, OllamaConfig
from database import get_db, log_event
from rag_system import get_rag, EvidenceRef
from governance import get_governance

router = APIRouter()


class QueueItem(BaseModel):
    case_id: int
    case_number: str
    status: str
    origin_track: str
    created_at: str
    has_capsule: bool


class TemplateInfo(BaseModel):
    template_type: str
    display_name: str
    input_scope: List[str]
    steps: List[str]
    output_schema: dict
    human_confirmation_points: List[str]


class GenerateDraftRequest(BaseModel):
    case_id: int
    template_type: str
    context: dict  # Additional context inputs


class DraftResponse(BaseModel):
    draft_id: str
    content: str
    evidence_refs: List[dict]
    pending_tasks: List[str]
    risk_points: List[str]
    status: str
    ollama_model: str


class EditDraftRequest(BaseModel):
    draft_id: str
    edited_content: str
    clinician_notes: Optional[str] = None


class SignDraftRequest(BaseModel):
    draft_id: str
    clinician_id: str


class WriteBackRequest(BaseModel):
    draft_id: str


@router.get("/queue", response_model=List[QueueItem])
async def get_clinician_queue():
    """
    Get cases in clinician queue (transferred + active)
    """
    db = get_db()
    
    cases = await db.fetch_all(
        """SELECT c.*, 
           (SELECT COUNT(*) FROM intake_capsules WHERE case_id = c.id) as capsule_count
           FROM cases c 
           WHERE c.status IN ('transferred', 'active') 
           AND (c.origin_track = 'public' OR c.origin_track = 'clinician')
           ORDER BY c.created_at DESC"""
    )
    
    queue = []
    for case in cases:
        queue.append(QueueItem(
            case_id=case['id'],
            case_number=case['case_number'],
            status=case['status'],
            origin_track=case['origin_track'],
            created_at=case['created_at'],
            has_capsule=case['capsule_count'] > 0
        ))
    
    return queue


@router.get("/templates", response_model=List[TemplateInfo])
async def get_templates():
    """
    Get available workflow templates with full definition
    (input_scope, steps, output_schema, human_confirmation_points)
    """
    db = get_db()
    
    templates = await db.fetch_all(
        "SELECT template_type, display_name, input_scope, steps, output_schema, human_confirmation_points FROM templates WHERE active = 1"
    )
    
    result = []
    for t in templates:
        result.append(TemplateInfo(
            template_type=t['template_type'],
            display_name=t['display_name'],
            input_scope=json.loads(t['input_scope']),
            steps=json.loads(t['steps']),
            output_schema=json.loads(t['output_schema']) if t['output_schema'] else {},
            human_confirmation_points=json.loads(t['human_confirmation_points']) if t['human_confirmation_points'] else []
        ))
    
    return result


@router.post("/draft/generate", response_model=DraftResponse)
async def generate_draft(req: GenerateDraftRequest):
    """
    Generate clinical draft with mandatory RAG retrieval
    """
    db = get_db()
    ollama = OllamaClient()
    rag = get_rag()
    
    # Get template
    template = await db.fetch_one(
        "SELECT * FROM templates WHERE template_type = ? AND active = 1",
        (req.template_type,)
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get prompt version
    prompt_version = await db.fetch_one(
        "SELECT * FROM prompt_versions WHERE track = 'clinician' AND template_type = ? AND active = 1",
        (req.template_type,)
    )
    
    # Get case data
    case = await db.fetch_one("SELECT * FROM cases WHERE id = ?", (req.case_id,))
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # RAG retrieval based on template type
    query = f"{req.template_type} for {req.context.get('chief_complaint', 'patient assessment')}"
    evidence_refs = await rag.retrieve(query=query, top_k=3)
    
    # Log retrieval
    await log_event(
        track="clinician",
        event_type="retrieval",
        ollama_model=OllamaConfig.EMBED_MODEL,
        payload={
            "query": query,
            "evidence_count": len(evidence_refs),
            "evidence_refs": [{"doc_id": e.doc_id, "score": e.score} for e in evidence_refs]
        },
        case_id=req.case_id,
        prompt_version_id=prompt_version['id'] if prompt_version else None
    )
    
    # Build context with evidence
    evidence_context = "\n\n".join([
        f"[DOC:{ref.doc_id}] {ref.title}\n{ref.snippet}\n(Relevance: {ref.score:.2f})"
        for ref in evidence_refs
    ])
    
    # Generate draft with citations
    system_prompt = prompt_version['prompt_content'] if prompt_version else "Generate clinical documentation with citations."
    user_prompt = f"""
Template: {req.template_type}
Context: {json.dumps(req.context)}

Retrieved Evidence:
{evidence_context}

Generate a {template['display_name']} with mandatory citations using [DOC:doc_id] format.
Include specific citations for clinical recommendations.
"""
    
    messages = [
        ChatMessage(role="system", content=system_prompt),
        ChatMessage(role="user", content=user_prompt)
    ]
    
    model_name = OllamaConfig.CLINICIAN_MODEL
    response = await ollama.chat(messages=messages, track="clinician")
    draft_content = response["message"]["content"]
    
    # Extract pending tasks and risk points (simplified parsing)
    pending_tasks = ["Review and verify all citations", "Complete missing sections if any"]
    risk_points = ["Ensure medication reconciliation" if "discharge" in req.template_type else "Monitor patient progress"]
    
    # Create draft record
    draft_id = f"DRAFT-{uuid.uuid4().hex[:12].upper()}"
    
    await db.execute(
        """INSERT INTO drafts 
           (draft_id, case_id, template_type, status, content, evidence_refs, 
            pending_tasks, risk_points, ollama_model, prompt_version_id)
           VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)""",
        (
            draft_id,
            req.case_id,
            req.template_type,
            draft_content,
            json.dumps([e.dict() for e in evidence_refs]),
            json.dumps(pending_tasks),
            json.dumps(risk_points),
            model_name,
            prompt_version['id'] if prompt_version else None
        )
    )
    await db.commit()
    
    # Log generation
    await log_event(
        track="clinician",
        event_type="generation",
        ollama_model=model_name,
        payload={
            "draft_id": draft_id,
            "template_type": req.template_type,
            "evidence_count": len(evidence_refs)
        },
        case_id=req.case_id,
        draft_id=draft_id,
        prompt_version_id=prompt_version['id'] if prompt_version else None
    )
    
    return DraftResponse(
        draft_id=draft_id,
        content=draft_content,
        evidence_refs=[e.dict() for e in evidence_refs],
        pending_tasks=pending_tasks,
        risk_points=risk_points,
        status="draft",
        ollama_model=model_name
    )


@router.put("/draft/edit")
async def edit_draft(req: EditDraftRequest):
    """
    Clinician edits draft (human-in-the-loop)
    """
    db = get_db()
    
    # Get draft
    draft = await db.fetch_one(
        "SELECT * FROM drafts WHERE draft_id = ?",
        (req.draft_id,)
    )
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Store edit history
    edits = json.loads(draft['clinician_edits']) if draft['clinician_edits'] else []
    edits.append({
        "timestamp": datetime.utcnow().isoformat(),
        "notes": req.clinician_notes,
        "content_length": len(req.edited_content)
    })
    
    # Update draft
    await db.execute(
        """UPDATE drafts 
           SET content = ?, clinician_edits = ?, status = 'editing', updated_at = ?
           WHERE draft_id = ?""",
        (req.edited_content, json.dumps(edits), datetime.utcnow().isoformat(), req.draft_id)
    )
    await db.commit()
    
    # Log edit
    await log_event(
        track="clinician",
        event_type="edit",
        ollama_model="human_clinician",
        payload={
            "draft_id": req.draft_id,
            "edit_count": len(edits),
            "notes": req.clinician_notes
        },
        case_id=draft['case_id'],
        draft_id=req.draft_id
    )
    
    return {"success": True, "draft_id": req.draft_id, "status": "editing"}


@router.post("/draft/sign")
async def sign_draft(req: SignDraftRequest):
    """
    Clinician signs draft (must pass policy check first)
    """
    db = get_db()
    rag = get_rag()
    gov = get_governance()
    
    # Get draft
    draft = await db.fetch_one(
        "SELECT * FROM drafts WHERE draft_id = ?",
        (req.draft_id,)
    )
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Parse evidence refs
    evidence_refs = []
    if draft['evidence_refs']:
        evidence_data = json.loads(draft['evidence_refs'])
        evidence_refs = [EvidenceRef(**e) for e in evidence_data]
    
    # MANDATORY POLICY CHECK: Citation enforcement
    policy_result = await rag.enforce_citation_policy(
        content=draft['content'],
        evidence_refs=evidence_refs,
        case_id=draft['case_id'],
        draft_id=req.draft_id
    )
    
    if not policy_result["allowed"]:
        # Update draft status to blocked
        await db.execute(
            """UPDATE drafts 
               SET status = 'blocked', policy_check_result = ?, updated_at = ?
               WHERE draft_id = ?""",
            (json.dumps(policy_result), datetime.utcnow().isoformat(), req.draft_id)
        )
        await db.commit()
        
        raise HTTPException(status_code=400, detail={
            "error": "PolicyBlocked",
            "reason": policy_result["reason"],
            "validation": policy_result["validation_result"],
            "message": "Draft blocked by mandatory citation policy. Please add evidence citations [DOC:...] or retrieve evidence."
        })
    
    # Policy passed - sign draft
    await db.execute(
        """UPDATE drafts 
           SET status = 'signed', signed_by = ?, signed_at = ?, 
               policy_check_result = ?, updated_at = ?
           WHERE draft_id = ?""",
        (
            req.clinician_id,
            datetime.utcnow().isoformat(),
            json.dumps(policy_result),
            datetime.utcnow().isoformat(),
            req.draft_id
        )
    )
    await db.commit()
    
    # Log signature
    await log_event(
        track="clinician",
        event_type="sign",
        ollama_model="human_clinician",
        payload={
            "draft_id": req.draft_id,
            "clinician_id": req.clinician_id,
            "policy_check": policy_result
        },
        case_id=draft['case_id'],
        draft_id=req.draft_id,
        user_id=req.clinician_id
    )
    
    return {
        "success": True,
        "draft_id": req.draft_id,
        "status": "signed",
        "policy_check": policy_result
    }


@router.post("/draft/write-back")
async def write_back(req: WriteBackRequest):
    """
    Write signed draft back to system (final gate)
    """
    db = get_db()
    gov = get_governance()
    
    # Get draft
    draft = await db.fetch_one(
        "SELECT * FROM drafts WHERE draft_id = ?",
        (req.draft_id,)
    )
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Validate workflow state
    state_check = await gov.validate_workflow_state(
        current_status=draft['status'],
        target_status='written_back',
        required_conditions={
            "signed": draft['signed_by'] is not None,
            "policy_passed": draft['policy_check_result'] is not None
        }
    )
    
    if not state_check["allowed"]:
        raise HTTPException(status_code=400, detail={
            "error": "Invalid workflow state",
            "reason": state_check["reason"],
            "missing_conditions": state_check["missing_conditions"]
        })
    
    # Update status to written_back
    await db.execute(
        """UPDATE drafts 
           SET status = 'written_back', updated_at = ?
           WHERE draft_id = ?""",
        (datetime.utcnow().isoformat(), req.draft_id)
    )
    await db.commit()
    
    # Log write-back
    await log_event(
        track="clinician",
        event_type="write_back",
        ollama_model="system",
        payload={
            "draft_id": req.draft_id,
            "state_check": state_check
        },
        case_id=draft['case_id'],
        draft_id=req.draft_id
    )
    
    return {
        "success": True,
        "draft_id": req.draft_id,
        "status": "written_back",
        "message": "Draft successfully written back to system"
    }


@router.get("/drafts/{draft_id}")
async def get_draft(draft_id: str):
    """Get draft details"""
    db = get_db()
    
    draft = await db.fetch_one(
        "SELECT * FROM drafts WHERE draft_id = ?",
        (draft_id,)
    )
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    return dict(draft)


@router.get("/cases/{case_id}/drafts")
async def get_case_drafts(case_id: int):
    """Get all drafts for a case"""
    db = get_db()
    
    drafts = await db.fetch_all(
        "SELECT * FROM drafts WHERE case_id = ? ORDER BY created_at DESC",
        (case_id,)
    )
    
    return [dict(d) for d in drafts]
