"""
Public Track API Router
Fast small model + structured outputs + consent transfer + safety upgrade
"""
import json
import uuid
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ollama_client import OllamaClient, ChatMessage, OllamaConfig
from database import get_db, log_event
from governance import get_governance
from rag_system import get_rag

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    case_id: Optional[int] = None
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    case_id: int
    risk_assessment: Optional[dict] = None
    safety_upgrade: Optional[dict] = None


class PreAssessmentRequest(BaseModel):
    case_id: int
    conversation_summary: str


class PreAssessmentResponse(BaseModel):
    capsule_id: str
    structured_data: dict
    self_description: str
    model_summary: str
    validation_status: str
    ollama_model: str


class ConsentRequest(BaseModel):
    case_id: int
    capsule_id: str
    consent_confirmed: bool
    consent_scope: List[str]


class TransferRequest(BaseModel):
    case_id: int
    capsule_id: str


@router.post("/chat", response_model=ChatResponse)
async def public_chat(req: ChatRequest):
    """
    Public chatbot endpoint - supportive dialogue
    Includes automatic safety risk assessment
    """
    db = get_db()
    ollama = OllamaClient()
    gov = get_governance()
    
    # Create or get case
    if req.case_id:
        case = await db.fetch_one("SELECT * FROM cases WHERE id = ?", (req.case_id,))
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        case_id = req.case_id
    else:
        # Create new case
        case_number = f"PUB-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
        cursor = await db.execute(
            "INSERT INTO cases (case_number, origin_track, status) VALUES (?, 'public', 'active')",
            (case_number,)
        )
        await db.commit()
        case_id = cursor.lastrowid
    
    # Get prompt version
    prompt_version = await db.fetch_one(
        "SELECT * FROM prompt_versions WHERE track = 'public' AND template_type = 'pre_assessment' AND active = 1"
    )
    
    model_name = OllamaConfig.PUBLIC_MODEL
    
    # Supportive dialogue
    messages = [
        ChatMessage(role="system", content="You are a compassionate healthcare support assistant. Listen empathetically and ask clarifying questions. Keep responses brief and supportive."),
        ChatMessage(role="user", content=req.message)
    ]
    
    response = await ollama.chat(messages=messages, track="public")
    assistant_reply = response["message"]["content"]
    
    # Safety risk assessment (independent tool)
    risk_assessment = await gov.assess_safety_risk(user_input=req.message)
    
    # Log interaction
    await log_event(
        track="public",
        event_type="input",
        ollama_model=model_name,
        payload={"user_message": req.message, "assistant_reply": assistant_reply},
        case_id=case_id,
        prompt_version_id=prompt_version['id'] if prompt_version else None,
        risk_level=risk_assessment.risk_level
    )
    
    # Check for safety upgrade trigger
    safety_upgrade = None
    if risk_assessment.risk_level in ["high", "critical"]:
        # Create safety upgrade record
        cursor = await db.execute(
            """INSERT INTO safety_upgrades 
               (case_id, trigger_reason, trigger_data, tool_output, action_taken, ollama_model)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                case_id,
                f"risk_level_{risk_assessment.risk_level}",
                json.dumps({"triggers": risk_assessment.triggers}),
                json.dumps(risk_assessment.dict()),
                risk_assessment.recommended_action,
                "rule_engine"
            )
        )
        await db.commit()
        
        # Log safety upgrade event
        await log_event(
            track="public",
            event_type="safety_upgrade",
            ollama_model="rule_engine",
            payload={
                "risk_assessment": risk_assessment.dict(),
                "upgrade_id": cursor.lastrowid
            },
            case_id=case_id,
            risk_level=risk_assessment.risk_level
        )
        
        safety_upgrade = {
            "triggered": True,
            "risk_level": risk_assessment.risk_level,
            "message": risk_assessment.recommended_action,
            "explanation": risk_assessment.explanation
        }
    
    return ChatResponse(
        response=assistant_reply,
        case_id=case_id,
        risk_assessment=risk_assessment.dict(),
        safety_upgrade=safety_upgrade
    )


@router.post("/pre-assessment", response_model=PreAssessmentResponse)
async def create_pre_assessment(req: PreAssessmentRequest):
    """
    Generate structured pre-assessment capsule using structured outputs
    Includes schema validation and repair attempts
    """
    db = get_db()
    ollama = OllamaClient()
    
    # Get prompt version
    prompt_version = await db.fetch_one(
        "SELECT * FROM prompt_versions WHERE track = 'public' AND template_type = 'pre_assessment' AND active = 1"
    )
    
    # Define JSON schema for intake capsule
    json_schema = {
        "type": "object",
        "properties": {
            "chief_complaint": {"type": "string"},
            "symptom_duration": {"type": "string"},
            "severity_score": {"type": "integer", "minimum": 1, "maximum": 10},
            "risk_indicators": {"type": "array", "items": {"type": "string"}},
            "self_description": {"type": "string"}
        },
        "required": ["chief_complaint", "self_description"]
    }
    
    # Generate structured output
    messages = [
        ChatMessage(
            role="system",
            content=prompt_version['prompt_content'] if prompt_version else "Generate structured pre-assessment."
        ),
        ChatMessage(
            role="user",
            content=f"Based on this conversation: {req.conversation_summary}\n\nCreate a structured pre-assessment capsule."
        )
    ]
    
    result = await ollama.chat_structured(
        messages=messages,
        track="public",
        json_schema=json_schema,
        max_repair_attempts=1
    )
    
    capsule_id = f"CAP-{uuid.uuid4().hex[:12].upper()}"
    model_name = result.get("model", OllamaConfig.PUBLIC_MODEL)
    
    # Extract self-description and create model summary
    structured_data = result["data"] if result["data"] else {}
    self_description = structured_data.get("self_description", req.conversation_summary[:200])
    model_summary = f"Model-generated summary: {structured_data.get('chief_complaint', 'N/A')} (Severity: {structured_data.get('severity_score', 'N/A')}/10)"
    
    # Store intake capsule
    await db.execute(
        """INSERT INTO intake_capsules 
           (case_id, capsule_id, self_description_text, model_summary_text, structured_data, 
            validation_status, repair_attempts, ollama_model, prompt_version_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            req.case_id,
            capsule_id,
            self_description,
            model_summary,
            json.dumps(structured_data),
            result["validation_status"],
            result["repair_attempts"],
            model_name,
            prompt_version['id'] if prompt_version else None
        )
    )
    await db.commit()
    
    # Log generation event
    await log_event(
        track="public",
        event_type="generation",
        ollama_model=model_name,
        payload={
            "capsule_id": capsule_id,
            "validation_status": result["validation_status"],
            "structured_data": structured_data
        },
        case_id=req.case_id,
        prompt_version_id=prompt_version['id'] if prompt_version else None
    )
    
    return PreAssessmentResponse(
        capsule_id=capsule_id,
        structured_data=structured_data,
        self_description=self_description,
        model_summary=model_summary,
        validation_status=result["validation_status"],
        ollama_model=model_name
    )


@router.post("/consent")
async def record_consent(req: ConsentRequest):
    """
    Record user consent for transfer to clinician track
    """
    db = get_db()
    gov = get_governance()
    
    # Get capsule
    capsule = await db.fetch_one(
        "SELECT * FROM intake_capsules WHERE capsule_id = ? AND case_id = ?",
        (req.capsule_id, req.case_id)
    )
    
    if not capsule:
        raise HTTPException(status_code=404, detail="Capsule not found")
    
    # Store consent
    notification_content = (
        "Your information will be shared with a clinician for professional assessment. "
        "This includes your conversation summary and pre-assessment data."
    )
    
    await db.execute(
        """INSERT INTO consents 
           (case_id, consent_type, collection_time, notification_content, consent_scope, 
            user_confirmed, ollama_model, prompt_version_id, metadata)
           VALUES (?, 'transfer', ?, ?, ?, ?, ?, ?, ?)""",
        (
            req.case_id,
            datetime.utcnow().isoformat(),
            notification_content,
            json.dumps(req.consent_scope),
            req.consent_confirmed,
            capsule['ollama_model'],
            capsule['prompt_version_id'],
            json.dumps({"capsule_id": req.capsule_id})
        )
    )
    await db.commit()
    
    # Log consent event
    await log_event(
        track="public",
        event_type="consent",
        ollama_model="user_action",
        payload={
            "consent_confirmed": req.consent_confirmed,
            "consent_scope": req.consent_scope,
            "capsule_id": req.capsule_id
        },
        case_id=req.case_id
    )
    
    return {"success": True, "consent_recorded": req.consent_confirmed}


@router.post("/transfer")
async def transfer_to_clinician(req: TransferRequest):
    """
    Transfer case to clinician track (with eligibility check)
    """
    db = get_db()
    gov = get_governance()
    
    # Get case and capsule
    case = await db.fetch_one("SELECT * FROM cases WHERE id = ?", (req.case_id,))
    capsule = await db.fetch_one(
        "SELECT * FROM intake_capsules WHERE capsule_id = ? AND case_id = ?",
        (req.capsule_id, req.case_id)
    )
    consent = await db.fetch_one(
        "SELECT * FROM consents WHERE case_id = ? ORDER BY id DESC LIMIT 1",
        (req.case_id,)
    )
    
    if not case or not capsule:
        raise HTTPException(status_code=404, detail="Case or capsule not found")
    
    # Check transfer eligibility
    eligibility = await gov.check_transfer_eligibility(
        consent_confirmed=consent['user_confirmed'] if consent else False,
        capsule_valid=capsule['validation_status'] == 'valid',
        case_status=case['status']
    )
    
    if not eligibility["eligible"]:
        # Log policy block
        await gov.log_policy_enforcement(
            policy_name="transfer_eligibility",
            track="public",
            allowed=False,
            reason=eligibility["reason"],
            context={"blockers": eligibility["blockers"]},
            case_id=req.case_id
        )
        
        raise HTTPException(status_code=400, detail={
            "error": "Transfer blocked by policy",
            "reason": eligibility["reason"],
            "blockers": eligibility["blockers"]
        })
    
    # Update case status
    await db.execute(
        "UPDATE cases SET status = 'transferred', updated_at = ? WHERE id = ?",
        (datetime.utcnow().isoformat(), req.case_id)
    )
    await db.commit()
    
    # Log transfer event
    await log_event(
        track="public",
        event_type="transfer",
        ollama_model="system",
        payload={
            "capsule_id": req.capsule_id,
            "target_track": "clinician",
            "eligibility_check": eligibility
        },
        case_id=req.case_id
    )
    
    return {
        "success": True,
        "case_id": req.case_id,
        "status": "transferred",
        "message": "Case successfully transferred to clinician queue"
    }


@router.get("/cases/{case_id}")
async def get_case(case_id: int):
    """Get case details"""
    db = get_db()
    
    case = await db.fetch_one("SELECT * FROM cases WHERE id = ?", (case_id,))
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Get related data
    capsules = await db.fetch_all(
        "SELECT * FROM intake_capsules WHERE case_id = ?", (case_id,)
    )
    consents = await db.fetch_all(
        "SELECT * FROM consents WHERE case_id = ?", (case_id,)
    )
    safety_upgrades = await db.fetch_all(
        "SELECT * FROM safety_upgrades WHERE case_id = ?", (case_id,)
    )
    
    return {
        "case": dict(case),
        "capsules": [dict(c) for c in capsules],
        "consents": [dict(c) for c in consents],
        "safety_upgrades": [dict(s) for s in safety_upgrades]
    }
