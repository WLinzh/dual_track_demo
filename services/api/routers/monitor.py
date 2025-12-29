"""
Performance Monitoring API Router
Endpoints for LLM performance metrics
"""
from fastapi import APIRouter, Query
from typing import Optional
from perf_monitor import PerfMonitor

router = APIRouter(prefix="/monitor/performance", tags=["Performance Monitor"])


@router.get("/summary")
async def get_performance_summary(
    range: str = Query("24h", description="Time range: 1h, 24h, 7d"),
    track: Optional[str] = Query(None, description="Filter by track: public, clinician"),
    phase: Optional[int] = Query(None, description="Filter by phase: 0, 1, 2"),
    model: Optional[str] = Query(None, description="Filter by ollama_model"),
    cold_threshold: int = Query(3000, description="Cold start threshold in ms")
):
    """
    Get performance summary statistics
    
    Returns:
    ```json
    {
        "success_rate": 98.5,
        "p50_total_ms": 1200,
        "p95_total_ms": 3500,
        "p50_tokens_per_sec": 45.2,
        "p95_tokens_per_sec": 62.1,
        "cold_start_rate": 15.3,
        "counts": {"total": 100, "succeeded": 98, "failed": 2},
        "time_range": "24h"
    }
    ```
    """
    return await PerfMonitor.get_summary(
        time_range=range,
        track=track,
        phase=phase,
        model=model,
        cold_start_threshold_ms=cold_threshold
    )


@router.get("/models")
async def get_models_comparison(
    range: str = Query("24h", description="Time range: 1h, 24h, 7d"),
    track: Optional[str] = Query(None, description="Filter by track")
):
    """
    Get model comparison statistics
    
    Returns:
    ```json
    [
        {
            "ollama_model": "qwen2.5:1.5b-instruct",
            "count": 50,
            "avg_ms": 800,
            "p95_ms": 1500,
            "avg_tps": 65.2,
            "p95_tps": 80.1,
            "success_rate": 98.0,
            "cold_start_rate": 10.0
        }
    ]
    ```
    """
    return await PerfMonitor.get_models_comparison(
        time_range=range,
        track=track
    )


@router.get("/phases")
async def get_phases_comparison(
    range: str = Query("24h", description="Time range: 1h, 24h, 7d"),
    track: Optional[str] = Query(None, description="Filter by track"),
    model: Optional[str] = Query(None, description="Filter by ollama_model")
):
    """
    Get phase comparison statistics (plan vs draft vs public_capsule)
    
    Returns:
    ```json
    [
        {
            "phase": 1,
            "phase_name": "plan",
            "count": 25,
            "avg_ms": 500,
            "p95_ms": 800,
            "avg_tps": 70.5,
            "p95_tps": 85.2,
            "avg_snippet_chars": 1500,
            "avg_evidence_count": 3.5,
            "avg_top_k": 5,
            "success_rate": 100.0
        }
    ]
    ```
    """
    return await PerfMonitor.get_phases_comparison(
        time_range=range,
        track=track,
        model=model
    )


@router.get("/runs")
async def get_performance_runs(
    range: str = Query("24h", description="Time range: 1h, 24h, 7d"),
    track: Optional[str] = Query(None, description="Filter by track"),
    phase: Optional[int] = Query(None, description="Filter by phase"),
    model: Optional[str] = Query(None, description="Filter by ollama_model"),
    success: Optional[bool] = Query(None, description="Filter by success status"),
    error_code: Optional[str] = Query(None, description="Filter by error_code"),
    case_id: Optional[int] = Query(None, description="Filter by case_id"),
    limit: int = Query(50, description="Page size"),
    offset: int = Query(0, description="Offset")
):
    """
    Get paginated list of performance runs
    
    Returns:
    ```json
    [
        {
            "run_id": "uuid",
            "correlation_id": "uuid",
            "case_id": 1,
            "track": "clinician",
            "phase": 2,
            "phase_name": "draft",
            "ollama_model": "qwen2.5:14b-instruct",
            "latency_ms": 2500,
            "tokens_per_sec": 45.2,
            "load_ms": 150,
            "success": true,
            "error_code": null,
            "created_at": "2025-01-15T10:30:00Z"
        }
    ]
    ```
    """
    return await PerfMonitor.get_runs(
        time_range=range,
        track=track,
        phase=phase,
        model=model,
        success=success,
        error_code=error_code,
        case_id=case_id,
        limit=limit,
        offset=offset
    )


@router.get("/runs/{run_id}")
async def get_run_detail(run_id: str):
    """
    Get detailed information about a specific run
    
    Returns:
    ```json
    {
        "run_id": "uuid",
        "correlation_id": "uuid",
        "case_id": 1,
        "track": "clinician",
        "phase": 2,
        "phase_name": "draft",
        "ollama_model": "qwen2.5:14b-instruct",
        "prompt_version_id": "CLI_HANDOVER_V1",
        "stream": false,
        "temperature": null,
        "top_k": 5,
        "snippet_chars_total": 2500,
        "evidence_count": 4,
        "ctx_chars_in": 3500,
        "ctx_chars_out": 1200,
        "retry_count": 0,
        "success": true,
        "error_code": null,
        "error_message": null,
        "http_status": 200,
        "latency_ms": 2500,
        "total_ms": 2480,
        "load_ms": 150,
        "prompt_eval_count": 450,
        "prompt_eval_ms": 280,
        "eval_count": 180,
        "eval_ms": 2000,
        "tokens_per_sec": 90.0,
        "created_at": "2025-01-15T10:30:00Z"
    }
    ```
    """
    result = await PerfMonitor.get_run_detail(run_id)
    if not result:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Run not found")
    return result


@router.get("/available-models")
async def get_available_models():
    """
    Get list of models with recorded performance runs
    
    Returns:
    ```json
    ["qwen2.5:1.5b-instruct", "qwen2.5:14b-instruct"]
    ```
    """
    return await PerfMonitor.get_available_models()


@router.get("/errors")
async def get_error_distribution(
    range: str = Query("24h", description="Time range: 1h, 24h, 7d"),
    track: Optional[str] = Query(None, description="Filter by track"),
    model: Optional[str] = Query(None, description="Filter by ollama_model")
):
    """
    Get distribution of error codes
    
    Returns:
    ```json
    [
        {"error_code": "TIMEOUT", "count": 3},
        {"error_code": "JSON_INVALID", "count": 2},
        {"error_code": "HTTP_500", "count": 1}
    ]
    ```
    """
    return await PerfMonitor.get_error_distribution(
        time_range=range,
        track=track,
        model=model
    )
