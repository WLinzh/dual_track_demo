"""
Governance API Router
Policy enforcement and risk assessment endpoints
"""
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

from governance import get_governance

router = APIRouter()


class RiskAssessmentRequest(BaseModel):
    user_input: str
    severity_score: Optional[int] = None


@router.post("/assess-risk")
async def assess_risk(req: RiskAssessmentRequest):
    """
    Assess safety risk using rule-based engine
    """
    gov = get_governance()
    
    assessment = await gov.assess_safety_risk(
        user_input=req.user_input,
        severity_score=req.severity_score
    )
    
    return assessment.dict()


@router.get("/policies")
async def get_policies():
    """
    List all active governance policies
    """
    return {
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
            },
            {
                "name": "workflow_state_validation",
                "description": "Enforce valid state transitions in clinician workflow",
                "enforcement": "hard_block",
                "track": "clinician"
            }
        ]
    }
