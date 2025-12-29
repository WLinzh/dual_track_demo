"""
Audit API Router
Unified audit trail with ollama_model as first-class field
"""
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Query
from pydantic import BaseModel

from database import get_db

router = APIRouter()


class EventLogEntry(BaseModel):
    id: int
    track: str
    event_type: str
    case_id: Optional[int]
    draft_id: Optional[str]
    ollama_model: str  # First-class field
    prompt_version_id: Optional[int]
    user_id: Optional[str]
    risk_level: Optional[str]
    created_at: str
    payload_summary: dict  # Simplified payload for display


class AuditStats(BaseModel):
    total_events: int
    by_track: dict
    by_model: dict
    by_risk_level: dict


@router.get("/events", response_model=List[EventLogEntry])
async def get_audit_events(
    track: Optional[str] = Query(None, description="Filter by track: public, clinician, governance"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    ollama_model: Optional[str] = Query(None, description="Filter by Ollama model (first-class field)"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level"),
    case_id: Optional[int] = Query(None, description="Filter by case ID"),
    limit: int = Query(50, ge=1, le=500, description="Max results to return")
):
    """
    Get audit events with filtering
    ollama_model is a first-class filterable field
    """
    db = get_db()
    
    # Build query dynamically
    conditions = []
    params = []
    
    if track:
        conditions.append("track = ?")
        params.append(track)
    
    if event_type:
        conditions.append("event_type = ?")
        params.append(event_type)
    
    if ollama_model:
        conditions.append("ollama_model = ?")
        params.append(ollama_model)
    
    if risk_level:
        conditions.append("risk_level = ?")
        params.append(risk_level)
    
    if case_id:
        conditions.append("case_id = ?")
        params.append(case_id)
    
    where_clause = " AND ".join(conditions) if conditions else "1=1"
    params.append(limit)
    
    query = f"""
        SELECT id, track, event_type, case_id, draft_id, ollama_model, 
               prompt_version_id, user_id, payload_json, risk_level, created_at
        FROM event_logs
        WHERE {where_clause}
        ORDER BY created_at DESC
        LIMIT ?
    """
    
    events = await db.fetch_all(query, tuple(params))
    
    # Transform to response format
    import json
    result = []
    for event in events:
        payload = json.loads(event['payload_json']) if event['payload_json'] else {}
        
        # Create simplified payload summary
        summary = {
            k: str(v)[:100] if isinstance(v, str) else v
            for k, v in list(payload.items())[:3]  # First 3 keys only
        }
        
        result.append(EventLogEntry(
            id=event['id'],
            track=event['track'],
            event_type=event['event_type'],
            case_id=event['case_id'],
            draft_id=event['draft_id'],
            ollama_model=event['ollama_model'],
            prompt_version_id=event['prompt_version_id'],
            user_id=event['user_id'],
            risk_level=event['risk_level'],
            created_at=event['created_at'],
            payload_summary=summary
        ))
    
    return result


@router.get("/events/{event_id}")
async def get_event_detail(event_id: int):
    """Get full event details including complete payload"""
    db = get_db()
    
    event = await db.fetch_one(
        "SELECT * FROM event_logs WHERE id = ?",
        (event_id,)
    )
    
    if not event:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Event not found")
    
    import json
    event_dict = dict(event)
    event_dict['payload'] = json.loads(event_dict['payload_json'])
    del event_dict['payload_json']
    
    return event_dict


@router.get("/stats", response_model=AuditStats)
async def get_audit_stats():
    """
    Get audit statistics
    Includes breakdown by ollama_model (first-class field)
    """
    db = get_db()
    
    # Total events
    total = await db.fetch_one("SELECT COUNT(*) as count FROM event_logs")
    total_events = total['count'] if total else 0
    
    # By track
    by_track_rows = await db.fetch_all(
        "SELECT track, COUNT(*) as count FROM event_logs GROUP BY track"
    )
    by_track = {row['track']: row['count'] for row in by_track_rows}
    
    # By model (FIRST-CLASS FIELD)
    by_model_rows = await db.fetch_all(
        "SELECT ollama_model, COUNT(*) as count FROM event_logs GROUP BY ollama_model ORDER BY count DESC"
    )
    by_model = {row['ollama_model']: row['count'] for row in by_model_rows}
    
    # By risk level
    by_risk_rows = await db.fetch_all(
        "SELECT risk_level, COUNT(*) as count FROM event_logs WHERE risk_level IS NOT NULL GROUP BY risk_level"
    )
    by_risk_level = {row['risk_level']: row['count'] for row in by_risk_rows}
    
    return AuditStats(
        total_events=total_events,
        by_track=by_track,
        by_model=by_model,
        by_risk_level=by_risk_level
    )


@router.get("/models")
async def get_models_list():
    """
    Get list of all ollama_models in audit trail (for filter dropdown)
    """
    db = get_db()
    
    models = await db.fetch_all(
        "SELECT DISTINCT ollama_model FROM event_logs ORDER BY ollama_model"
    )
    
    return {
        "models": [m['ollama_model'] for m in models]
    }


@router.get("/policy-triggers")
async def get_policy_triggers(limit: int = Query(20, ge=1, le=100)):
    """
    Get recent policy trigger events (governance enforcement)
    """
    db = get_db()
    
    events = await db.fetch_all(
        """SELECT id, track, event_type, case_id, draft_id, ollama_model, 
                  payload_json, risk_level, created_at
           FROM event_logs
           WHERE event_type IN ('policy_trigger', 'safety_upgrade')
           ORDER BY created_at DESC
           LIMIT ?""",
        (limit,)
    )
    
    import json
    result = []
    for event in events:
        payload = json.loads(event['payload_json']) if event['payload_json'] else {}
        result.append({
            **dict(event),
            "payload": payload
        })
    
    return result
