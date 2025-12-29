"""
Governance Tools and Risk Engine
Rule-based policy enforcement (toolization)
"""
import re
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime

from database import log_event


class RiskAssessment(BaseModel):
    """Risk assessment result"""
    risk_level: str  # 'low', 'medium', 'high', 'critical'
    triggers: List[str]
    explanation: str
    recommended_action: str


class GovernanceTools:
    """Independent, explainable tools for governance"""
    
    # =================================================================
    # CRITICAL RISK - Immediate danger (self-harm, suicidal ideation)
    # Conservative threshold: trigger on ANY match
    # =================================================================
    CRITICAL_RISK_PATTERNS = [
        # Suicidal ideation - English
        (r'\b(suicid|kill\s*(myself|me)|end\s*(my\s*)?life|want\s*(to)?\s*die)\b', 'Suicidal ideation detected'),
        (r'\b(no\s*reason\s*to\s*live|better\s*off\s*dead|wish\s*i\s*was\s*dead)\b', 'Passive suicidal ideation'),
        (r'\b(goodbye\s*(letter|note|forever)|final\s*(goodbye|message))\b', 'Potential farewell message'),
        (r"\b(can'?t\s*(go\s*on|take\s*(it|this)\s*anymore|continue))\b", 'Crisis expression'),
        (r'\b(ending\s*(it|everything)|give\s*up\s*on\s*life)\b', 'End-of-life intent'),
        
        # Self-harm - English
        (r'\b(self[- ]?harm|cut(ting)?\s*(myself|my\s*(wrist|arm|leg)))\b', 'Self-harm behavior'),
        (r'\b(hurt(ing)?\s*(myself|my\s*body))\b', 'Self-injury indication'),
        (r'\b(overdose|OD|too\s*many\s*pills)\b', 'Overdose concern'),
        (r'\b(burn(ing)?\s*(myself|my\s*skin))\b', 'Self-burning concern'),
        (r'\b(slit(ting)?\s*(my\s*)?(wrist|throat))\b', 'Self-injury method'),
        
        # Suicidal ideation - Chinese
        (r'(想死|死了算了|不想活|结束生命|自杀|自绝)', '检测到自杀想法'),
        (r'(活着没意思|活不下去|不想活了|我想走了)', '检测到危机表达'),
        (r'(跳楼|跳桥|上吊|割脉)', '检测到自伤方法'),
        
        # Self-harm - Chinese
        (r'(自残|自伤|割伤|割手|割脉|吃药)', '检测到自伤行为'),
        (r'(伤害自己|惩罚自己|折磨自己)', '检测到自我伤害'),
    ]
    
    # =================================================================
    # HIGH RISK - Urgent concern (extreme distress, violence, abuse)
    # Conservative threshold: trigger on ANY match
    # =================================================================
    HIGH_RISK_PATTERNS = [
        # Extreme emotional distress - English
        (r'\b(unbearable|excruciating)\s*(pain|suffering)\b', 'Extreme suffering'),
        (r"\b(can'?t\s*(bear|stand|handle)\s*(it|this|the\s*pain))\b", 'Unbearable distress'),
        (r'\b(no\s*(hope|point|way\s*out)|feel(ing)?\s*trapped)\b', 'Hopelessness/trapped'),
        (r'\b(everyone\s*(would\s*be)?\s*better\s*without\s*me)\b', 'Burden perception'),
        (r'\b(completely\s*(hopeless|worthless|alone))\b', 'Severe negative cognition'),
        
        # Violence/Abuse indicators - English
        (r'\b(beat(en|ing)?\s*(me|up)|hit(s|ting)?\s*me)\b', 'Physical abuse indicator'),
        (r'\b(abuse|abusing|abused)\b', 'Abuse mentioned'),
        (r'\b(violent|violence|assault)\b', 'Violence mentioned'),
        (r'\b(rape[d]?|sexual\s*(abuse|assault))\b', 'Sexual violence'),
        (r'\b(dangerous\s*(situation|person))\b', 'Danger indicator'),
        
        # Extreme distress - Chinese
        (r'(崩溃|绝望|无法承受|活不下去)', '检测到极端痛苦'),
        (r'(家暴|殴打|虐待|强奸)', '检测到暴力/虐待'),
        (r'(太痛苦了|活着没意义|没有希望)', '检测到绝望表达'),
    ]
    
    # =================================================================
    # MEDIUM RISK - Elevated concern (depression, anxiety, insomnia)
    # Accumulative: 2+ matches elevates to medium
    # =================================================================
    MEDIUM_RISK_PATTERNS = [
        # Depression indicators - English
        (r'\b(depress(ed|ion|ing))\b', 'Depression mentioned'),
        (r'\b(hopeless|worthless|helpless|empty|numb)\b', 'Negative cognition'),
        (r'\b(no\s*(motivation|energy|interest))\b', 'Anhedonia indicator'),
        (r'\b(cry(ing)?\s*(all\s*the\s*time|constantly|everyday))\b', 'Persistent crying'),
        (r'\b(hate\s*(myself|my\s*(life|body)))\b', 'Self-hatred'),
        
        # Anxiety indicators - English
        (r'\b(anxious|anxiety|panic)\b', 'Anxiety mentioned'),
        (r'\b(cannot\s*(cope|function|breathe))\b', 'Functioning impairment'),
        (r'\b(overwhelming|overwhelmed)\b', 'Overwhelming feeling'),
        (r'\b(terrified|scared\s*(all\s*the\s*time))\b', 'Severe fear'),
        
        # Sleep/Functioning - English
        (r'\b(insomnia|cannot\s*sleep|not\s*sleeping)\b', 'Sleep disturbance'),
        (r'\b(not\s*(eating|showering|getting\s*out\s*of\s*bed))\b', 'Self-care neglect'),
        (r'\b(stopped\s*(taking\s*)?medication)\b', 'Medication non-adherence'),
        
        # Medium risk - Chinese
        (r'(抵触|焦虑|恐慌|担心)', '检测到焦虑'),
        (r'(失眠|睡不着|吃不下)', '检测到睡眠/食欲问题'),
        (r'(没有动力|什么都不想做|讨厌自己)', '检测到抑郁症状'),
    ]
    
    @staticmethod
    async def assess_safety_risk(
        user_input: str,
        severity_score: Optional[int] = None
    ) -> RiskAssessment:
        """
        Rule-based safety risk assessment with CONSERVATIVE thresholds
        
        CRITICAL: Immediate danger - any single critical pattern match
        HIGH: Urgent concern - any single high pattern OR severity >= 7
        MEDIUM: Elevated concern - 2+ medium patterns OR severity >= 5
        LOW: Routine monitoring - no significant triggers
        
        LLM should only present this tool's output, not interpret it.
        No diagnosis - only standardized safety response and help-seeking paths.
        
        Args:
            user_input: User's text input
            severity_score: Optional self-reported severity (1-10)
        
        Returns:
            RiskAssessment with explainable reasoning
        """
        triggers = []
        risk_level = "low"
        input_lower = user_input.lower()
        
        # Check CRITICAL patterns (any single match = critical)
        for pattern, description in GovernanceTools.CRITICAL_RISK_PATTERNS:
            if re.search(pattern, input_lower, re.IGNORECASE):
                triggers.append(f"CRITICAL: {description}")
                risk_level = "critical"
        
        # Check HIGH patterns (any single match = high, unless already critical)
        if risk_level != "critical":
            for pattern, description in GovernanceTools.HIGH_RISK_PATTERNS:
                if re.search(pattern, input_lower, re.IGNORECASE):
                    triggers.append(f"HIGH: {description}")
                    risk_level = "high"
        
        # Check MEDIUM patterns (2+ matches = medium, unless already higher)
        if risk_level not in ["critical", "high"]:
            medium_matches = []
            for pattern, description in GovernanceTools.MEDIUM_RISK_PATTERNS:
                if re.search(pattern, input_lower, re.IGNORECASE):
                    medium_matches.append(f"MEDIUM: {description}")
            
            if len(medium_matches) >= 2:
                triggers.extend(medium_matches)
                risk_level = "medium"
            elif len(medium_matches) == 1:
                triggers.extend(medium_matches)
                # Single medium match stays at low but is logged
        
        # Conservative severity score thresholds
        if severity_score is not None:
            if severity_score >= 8:
                triggers.append(f"CRITICAL: Severity score {severity_score}/10 (threshold: 8+)")
                risk_level = "critical"
            elif severity_score >= 7 and risk_level not in ["critical"]:
                triggers.append(f"HIGH: Severity score {severity_score}/10 (threshold: 7+)")
                risk_level = "high"
            elif severity_score >= 5 and risk_level not in ["critical", "high"]:
                triggers.append(f"MEDIUM: Severity score {severity_score}/10 (threshold: 5+)")
                risk_level = "medium"
        
        # Determine recommended action (standardized help-seeking paths, NO diagnosis)
        if risk_level == "critical":
            action = (
                "IMMEDIATE SAFETY CONCERN: Please reach out to crisis support now. "
                "• National Crisis Line: 988 (US) | • Crisis Text: Text HOME to 741741 | "
                "• Emergency: 911 | • 中国24小时心理援助热线: 010-82951332"
            )
        elif risk_level == "high":
            action = (
                "URGENT SUPPORT RECOMMENDED: Please consider speaking with a professional soon. "
                "• National Helpline: 988 | • SAMHSA: 1-800-662-4357 | "
                "Clinician review recommended within 24 hours."
            )
        elif risk_level == "medium":
            action = (
                "SUPPORT AVAILABLE: Consider connecting with a mental health professional. "
                "Routine follow-up recommended within 1 week. You are not alone."
            )
        else:
            action = (
                "CONTINUE SUPPORT: No immediate safety concerns detected. "
                "Resources are always available if needed."
            )
        
        # Build explainable reasoning
        if triggers:
            trigger_summary = "; ".join(triggers[:3])  # Show first 3 triggers
            if len(triggers) > 3:
                trigger_summary += f" (+{len(triggers) - 3} more)"
            explanation = (
                f"Automated safety screening detected {len(triggers)} trigger(s): {trigger_summary}. "
                f"This is NOT a diagnosis. Rule-based screening for safety support only."
            )
        else:
            explanation = (
                "No significant risk indicators detected. "
                "Continuing supportive dialogue. Resources available anytime."
            )
        
        return RiskAssessment(
            risk_level=risk_level,
            triggers=triggers,
            explanation=explanation,
            recommended_action=action
        )
    
    @staticmethod
    async def check_transfer_eligibility(
        consent_confirmed: bool,
        capsule_valid: bool,
        case_status: str
    ) -> Dict[str, Any]:
        """
        Rule-based transfer eligibility check
        
        Returns:
            {
                "eligible": bool,
                "reason": str,
                "blockers": list
            }
        """
        blockers = []
        
        if not consent_confirmed:
            blockers.append("User consent not confirmed")
        
        if not capsule_valid:
            blockers.append("Intake capsule validation failed (invalid JSON schema)")
        
        if case_status not in ['active', 'transferred']:
            blockers.append(f"Invalid case status: {case_status}")
        
        eligible = len(blockers) == 0
        
        return {
            "eligible": eligible,
            "reason": "Transfer allowed" if eligible else "Transfer blocked due to policy violations",
            "blockers": blockers
        }
    
    @staticmethod
    async def validate_workflow_state(
        current_status: str,
        target_status: str,
        required_conditions: Dict[str, bool]
    ) -> Dict[str, Any]:
        """
        State machine validation for clinician workflow
        
        Args:
            current_status: Current draft status
            target_status: Target status
            required_conditions: Dict of required conditions (e.g., {"signed": True})
        
        Returns:
            {
                "allowed": bool,
                "reason": str,
                "missing_conditions": list
            }
        """
        # Define valid state transitions
        VALID_TRANSITIONS = {
            "draft": ["check_policy", "editing"],
            "check_policy": ["editing", "blocked"],
            "editing": ["check_policy", "signed"],
            "signed": ["written_back"],
            "written_back": ["archived"],
            "blocked": ["editing"],  # Can edit and retry
            "archived": []
        }
        
        if target_status not in VALID_TRANSITIONS.get(current_status, []):
            return {
                "allowed": False,
                "reason": f"Invalid state transition: {current_status} → {target_status}",
                "missing_conditions": []
            }
        
        # Check required conditions
        missing = [cond for cond, met in required_conditions.items() if not met]
        
        if missing:
            return {
                "allowed": False,
                "reason": f"Missing required conditions for {current_status} → {target_status}",
                "missing_conditions": missing
            }
        
        return {
            "allowed": True,
            "reason": f"Valid transition: {current_status} → {target_status}",
            "missing_conditions": []
        }
    
    @staticmethod
    async def log_policy_enforcement(
        policy_name: str,
        track: str,
        allowed: bool,
        reason: str,
        context: Dict[str, Any],
        case_id: Optional[int] = None,
        draft_id: Optional[str] = None
    ):
        """
        Log policy enforcement action to audit trail
        """
        await log_event(
            track="governance",
            event_type="policy_trigger",
            ollama_model="policy_engine",
            payload={
                "policy": policy_name,
                "allowed": allowed,
                "reason": reason,
                "context": context
            },
            case_id=case_id,
            draft_id=draft_id,
            risk_level="high" if not allowed else "low"
        )


# Singleton instance
governance = GovernanceTools()


def get_governance() -> GovernanceTools:
    """Get governance tools instance"""
    return governance
