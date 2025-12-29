"""
LLM Performance Monitor
Tracks Ollama model performance metrics
"""
import uuid
import time
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict
from database import db


@dataclass
class PerfRunContext:
    """Context for a single LLM performance run"""
    run_id: str
    correlation_id: Optional[str]
    case_id: Optional[int]
    track: str
    phase: int  # 0=public_capsule, 1=plan, 2=draft
    ollama_model: str
    prompt_version_id: Optional[str] = None
    stream: bool = False
    temperature: Optional[float] = None
    top_k: Optional[int] = None
    snippet_chars_total: Optional[int] = None
    evidence_count: Optional[int] = None
    ctx_chars_in: Optional[int] = None
    ctx_chars_out: Optional[int] = None
    retry_count: int = 0
    success: Optional[bool] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    http_status: Optional[int] = None
    latency_ms: Optional[int] = None
    total_duration_ns: Optional[int] = None
    load_duration_ns: Optional[int] = None
    prompt_eval_count: Optional[int] = None
    prompt_eval_duration_ns: Optional[int] = None
    eval_count: Optional[int] = None
    eval_duration_ns: Optional[int] = None
    tokens_per_sec: Optional[float] = None
    start_time: Optional[float] = None  # Not stored, just for tracking


class PerfMonitor:
    """Performance monitoring for LLM calls"""
    
    @staticmethod
    def create_run(
        track: str,
        phase: int,
        ollama_model: str,
        correlation_id: Optional[str] = None,
        case_id: Optional[int] = None,
        prompt_version_id: Optional[str] = None,
        stream: bool = False,
        temperature: Optional[float] = None,
        top_k: Optional[int] = None,
        snippet_chars_total: Optional[int] = None,
        evidence_count: Optional[int] = None,
        ctx_chars_in: Optional[int] = None
    ) -> PerfRunContext:
        """Create a new performance run context (call before LLM request)"""
        return PerfRunContext(
            run_id=str(uuid.uuid4()),
            correlation_id=correlation_id or str(uuid.uuid4()),
            case_id=case_id,
            track=track,
            phase=phase,
            ollama_model=ollama_model,
            prompt_version_id=prompt_version_id,
            stream=stream,
            temperature=temperature,
            top_k=top_k,
            snippet_chars_total=snippet_chars_total,
            evidence_count=evidence_count,
            ctx_chars_in=ctx_chars_in,
            start_time=time.time()
        )
    
    @staticmethod
    def extract_ollama_metrics(response: Dict[str, Any], ctx: PerfRunContext) -> PerfRunContext:
        """Extract performance metrics from Ollama response"""
        # Calculate latency
        if ctx.start_time:
            ctx.latency_ms = int((time.time() - ctx.start_time) * 1000)
        
        # Extract Ollama metrics (may be missing in some responses)
        ctx.total_duration_ns = response.get('total_duration')
        ctx.load_duration_ns = response.get('load_duration')
        ctx.prompt_eval_count = response.get('prompt_eval_count')
        ctx.prompt_eval_duration_ns = response.get('prompt_eval_duration')
        ctx.eval_count = response.get('eval_count')
        ctx.eval_duration_ns = response.get('eval_duration')
        
        # Calculate tokens per second
        if ctx.eval_count and ctx.eval_duration_ns and ctx.eval_duration_ns > 0:
            ctx.tokens_per_sec = ctx.eval_count / (ctx.eval_duration_ns / 1e9)
        
        # Extract output size
        if 'message' in response and 'content' in response['message']:
            ctx.ctx_chars_out = len(response['message']['content'])
        elif 'response' in response:
            ctx.ctx_chars_out = len(response['response'])
        
        ctx.success = True
        ctx.http_status = 200
        
        return ctx
    
    @staticmethod
    def mark_failed(
        ctx: PerfRunContext,
        error_code: str,
        error_message: str,
        http_status: Optional[int] = None
    ) -> PerfRunContext:
        """Mark a run as failed"""
        if ctx.start_time:
            ctx.latency_ms = int((time.time() - ctx.start_time) * 1000)
        
        ctx.success = False
        ctx.error_code = error_code
        ctx.error_message = error_message[:500] if error_message else None  # Truncate
        ctx.http_status = http_status
        
        return ctx
    
    @staticmethod
    def increment_retry(ctx: PerfRunContext) -> PerfRunContext:
        """Increment retry count"""
        ctx.retry_count += 1
        return ctx
    
    @staticmethod
    async def save_run(ctx: PerfRunContext) -> int:
        """Save performance run to database"""
        query = """
            INSERT INTO llm_perf_runs (
                run_id, correlation_id, case_id, track, phase, ollama_model,
                prompt_version_id, stream, temperature, top_k,
                snippet_chars_total, evidence_count, ctx_chars_in, ctx_chars_out,
                retry_count, success, error_code, error_message, http_status,
                latency_ms, total_duration_ns, load_duration_ns,
                prompt_eval_count, prompt_eval_duration_ns, eval_count, eval_duration_ns,
                tokens_per_sec, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        cursor = await db.execute(query, (
            ctx.run_id,
            ctx.correlation_id,
            ctx.case_id,
            ctx.track,
            ctx.phase,
            ctx.ollama_model,
            ctx.prompt_version_id,
            1 if ctx.stream else 0,
            ctx.temperature,
            ctx.top_k,
            ctx.snippet_chars_total,
            ctx.evidence_count,
            ctx.ctx_chars_in,
            ctx.ctx_chars_out,
            ctx.retry_count,
            1 if ctx.success else (0 if ctx.success is False else None),
            ctx.error_code,
            ctx.error_message,
            ctx.http_status,
            ctx.latency_ms,
            ctx.total_duration_ns,
            ctx.load_duration_ns,
            ctx.prompt_eval_count,
            ctx.prompt_eval_duration_ns,
            ctx.eval_count,
            ctx.eval_duration_ns,
            ctx.tokens_per_sec,
            datetime.utcnow().isoformat()
        ))
        await db.commit()
        return cursor.lastrowid
    
    @staticmethod
    async def get_summary(
        time_range: str = '24h',
        track: Optional[str] = None,
        phase: Optional[int] = None,
        model: Optional[str] = None,
        cold_start_threshold_ms: int = 3000
    ) -> Dict[str, Any]:
        """Get performance summary statistics"""
        # Calculate time filter
        time_filters = {
            '1h': "datetime('now', '-1 hour')",
            '24h': "datetime('now', '-24 hours')",
            '7d': "datetime('now', '-7 days')"
        }
        time_clause = time_filters.get(time_range, time_filters['24h'])
        
        # Build WHERE clause
        conditions = [f"created_at >= {time_clause}"]
        params = []
        
        if track:
            conditions.append("track = ?")
            params.append(track)
        if phase is not None:
            conditions.append("phase = ?")
            params.append(phase)
        if model:
            conditions.append("ollama_model = ?")
            params.append(model)
        
        where_clause = " AND ".join(conditions)
        
        # Get counts and success rate
        count_query = f"""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as succeeded,
                SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
            FROM llm_perf_runs
            WHERE {where_clause}
        """
        counts = await db.fetch_one(count_query, tuple(params))
        
        total = counts['total'] or 0
        succeeded = counts['succeeded'] or 0
        failed = counts['failed'] or 0
        success_rate = (succeeded / total * 100) if total > 0 else 0
        
        # Get latency percentiles (SQLite doesn't have built-in percentile, use subquery)
        latency_query = f"""
            SELECT latency_ms FROM llm_perf_runs
            WHERE {where_clause} AND latency_ms IS NOT NULL AND success = 1
            ORDER BY latency_ms
        """
        latencies = await db.fetch_all(latency_query, tuple(params))
        latency_values = [r['latency_ms'] for r in latencies]
        
        p50_latency = None
        p95_latency = None
        if latency_values:
            latency_values.sort()
            n = len(latency_values)
            p50_latency = latency_values[int(n * 0.5)]
            p95_latency = latency_values[int(n * 0.95)] if n >= 2 else latency_values[-1]
        
        # Get tokens/sec percentiles
        tps_query = f"""
            SELECT tokens_per_sec FROM llm_perf_runs
            WHERE {where_clause} AND tokens_per_sec IS NOT NULL AND success = 1
            ORDER BY tokens_per_sec
        """
        tps_results = await db.fetch_all(tps_query, tuple(params))
        tps_values = [r['tokens_per_sec'] for r in tps_results]
        
        p50_tps = None
        p95_tps = None
        if tps_values:
            tps_values.sort()
            n = len(tps_values)
            p50_tps = round(tps_values[int(n * 0.5)], 2)
            p95_tps = round(tps_values[int(n * 0.95)], 2) if n >= 2 else round(tps_values[-1], 2)
        
        # Calculate cold start rate
        cold_threshold_ns = cold_start_threshold_ms * 1_000_000
        cold_query = f"""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN load_duration_ns > ? THEN 1 ELSE 0 END) as cold_starts
            FROM llm_perf_runs
            WHERE {where_clause} AND load_duration_ns IS NOT NULL
        """
        cold_result = await db.fetch_one(cold_query, tuple(params) + (cold_threshold_ns,))
        cold_total = cold_result['total'] or 0
        cold_starts = cold_result['cold_starts'] or 0
        cold_start_rate = (cold_starts / cold_total * 100) if cold_total > 0 else 0
        
        return {
            'success_rate': round(success_rate, 2),
            'p50_total_ms': p50_latency,
            'p95_total_ms': p95_latency,
            'p50_tokens_per_sec': p50_tps,
            'p95_tokens_per_sec': p95_tps,
            'cold_start_rate': round(cold_start_rate, 2),
            'counts': {
                'total': total,
                'succeeded': succeeded,
                'failed': failed
            },
            'time_range': time_range
        }
    
    @staticmethod
    async def get_models_comparison(
        time_range: str = '24h',
        track: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get model comparison statistics"""
        time_filters = {
            '1h': "datetime('now', '-1 hour')",
            '24h': "datetime('now', '-24 hours')",
            '7d': "datetime('now', '-7 days')"
        }
        time_clause = time_filters.get(time_range, time_filters['24h'])
        
        conditions = [f"created_at >= {time_clause}"]
        params = []
        
        if track:
            conditions.append("track = ?")
            params.append(track)
        
        where_clause = " AND ".join(conditions)
        
        query = f"""
            SELECT 
                ollama_model,
                COUNT(*) as count,
                AVG(latency_ms) as avg_ms,
                AVG(tokens_per_sec) as avg_tps,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
                SUM(CASE WHEN load_duration_ns > 3000000000 THEN 1 ELSE 0 END) * 100.0 / 
                    NULLIF(SUM(CASE WHEN load_duration_ns IS NOT NULL THEN 1 ELSE 0 END), 0) as cold_start_rate
            FROM llm_perf_runs
            WHERE {where_clause}
            GROUP BY ollama_model
            ORDER BY count DESC
        """
        
        results = await db.fetch_all(query, tuple(params))
        
        # Calculate p95 for each model
        models_data = []
        for row in results:
            model = row['ollama_model']
            
            # Get p95 latency
            p95_query = f"""
                SELECT latency_ms FROM llm_perf_runs
                WHERE {where_clause} AND ollama_model = ? AND latency_ms IS NOT NULL AND success = 1
                ORDER BY latency_ms
            """
            latencies = await db.fetch_all(p95_query, tuple(params) + (model,))
            p95_ms = None
            if latencies:
                vals = [r['latency_ms'] for r in latencies]
                vals.sort()
                p95_ms = vals[int(len(vals) * 0.95)] if len(vals) >= 2 else vals[-1]
            
            # Get p95 tokens/sec
            p95_tps_query = f"""
                SELECT tokens_per_sec FROM llm_perf_runs
                WHERE {where_clause} AND ollama_model = ? AND tokens_per_sec IS NOT NULL AND success = 1
                ORDER BY tokens_per_sec
            """
            tps_results = await db.fetch_all(p95_tps_query, tuple(params) + (model,))
            p95_tps = None
            if tps_results:
                vals = [r['tokens_per_sec'] for r in tps_results]
                vals.sort()
                p95_tps = round(vals[int(len(vals) * 0.95)], 2) if len(vals) >= 2 else round(vals[-1], 2)
            
            models_data.append({
                'ollama_model': model,
                'count': row['count'],
                'avg_ms': round(row['avg_ms'], 1) if row['avg_ms'] else None,
                'p95_ms': p95_ms,
                'avg_tps': round(row['avg_tps'], 2) if row['avg_tps'] else None,
                'p95_tps': p95_tps,
                'success_rate': round(row['success_rate'], 2) if row['success_rate'] else 0,
                'cold_start_rate': round(row['cold_start_rate'], 2) if row['cold_start_rate'] else 0
            })
        
        return models_data
    
    @staticmethod
    async def get_phases_comparison(
        time_range: str = '24h',
        track: Optional[str] = None,
        model: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get phase comparison statistics"""
        time_filters = {
            '1h': "datetime('now', '-1 hour')",
            '24h': "datetime('now', '-24 hours')",
            '7d': "datetime('now', '-7 days')"
        }
        time_clause = time_filters.get(time_range, time_filters['24h'])
        
        conditions = [f"created_at >= {time_clause}"]
        params = []
        
        if track:
            conditions.append("track = ?")
            params.append(track)
        if model:
            conditions.append("ollama_model = ?")
            params.append(model)
        
        where_clause = " AND ".join(conditions)
        
        query = f"""
            SELECT 
                phase,
                COUNT(*) as count,
                AVG(latency_ms) as avg_ms,
                AVG(tokens_per_sec) as avg_tps,
                AVG(snippet_chars_total) as avg_snippet_chars,
                AVG(evidence_count) as avg_evidence_count,
                AVG(top_k) as avg_top_k,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
            FROM llm_perf_runs
            WHERE {where_clause}
            GROUP BY phase
            ORDER BY phase
        """
        
        results = await db.fetch_all(query, tuple(params))
        
        phase_names = {0: 'public_capsule', 1: 'plan', 2: 'draft'}
        phases_data = []
        
        for row in results:
            phase = row['phase']
            
            # Get p95 latency
            p95_query = f"""
                SELECT latency_ms FROM llm_perf_runs
                WHERE {where_clause} AND phase = ? AND latency_ms IS NOT NULL AND success = 1
                ORDER BY latency_ms
            """
            latencies = await db.fetch_all(p95_query, tuple(params) + (phase,))
            p95_ms = None
            if latencies:
                vals = [r['latency_ms'] for r in latencies]
                vals.sort()
                p95_ms = vals[int(len(vals) * 0.95)] if len(vals) >= 2 else vals[-1]
            
            # Get p95 tokens/sec
            p95_tps_query = f"""
                SELECT tokens_per_sec FROM llm_perf_runs
                WHERE {where_clause} AND phase = ? AND tokens_per_sec IS NOT NULL AND success = 1
                ORDER BY tokens_per_sec
            """
            tps_results = await db.fetch_all(p95_tps_query, tuple(params) + (phase,))
            p95_tps = None
            if tps_results:
                vals = [r['tokens_per_sec'] for r in tps_results]
                vals.sort()
                p95_tps = round(vals[int(len(vals) * 0.95)], 2) if len(vals) >= 2 else round(vals[-1], 2)
            
            phases_data.append({
                'phase': phase,
                'phase_name': phase_names.get(phase, f'phase_{phase}'),
                'count': row['count'],
                'avg_ms': round(row['avg_ms'], 1) if row['avg_ms'] else None,
                'p95_ms': p95_ms,
                'avg_tps': round(row['avg_tps'], 2) if row['avg_tps'] else None,
                'p95_tps': p95_tps,
                'avg_snippet_chars': int(row['avg_snippet_chars']) if row['avg_snippet_chars'] else None,
                'avg_evidence_count': round(row['avg_evidence_count'], 1) if row['avg_evidence_count'] else None,
                'avg_top_k': round(row['avg_top_k'], 1) if row['avg_top_k'] else None,
                'success_rate': round(row['success_rate'], 2) if row['success_rate'] else 0
            })
        
        return phases_data
    
    @staticmethod
    async def get_runs(
        time_range: str = '24h',
        track: Optional[str] = None,
        phase: Optional[int] = None,
        model: Optional[str] = None,
        success: Optional[bool] = None,
        error_code: Optional[str] = None,
        case_id: Optional[int] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get paginated list of performance runs"""
        time_filters = {
            '1h': "datetime('now', '-1 hour')",
            '24h': "datetime('now', '-24 hours')",
            '7d': "datetime('now', '-7 days')"
        }
        time_clause = time_filters.get(time_range, time_filters['24h'])
        
        conditions = [f"created_at >= {time_clause}"]
        params = []
        
        if track:
            conditions.append("track = ?")
            params.append(track)
        if phase is not None:
            conditions.append("phase = ?")
            params.append(phase)
        if model:
            conditions.append("ollama_model = ?")
            params.append(model)
        if success is not None:
            conditions.append("success = ?")
            params.append(1 if success else 0)
        if error_code:
            conditions.append("error_code = ?")
            params.append(error_code)
        if case_id:
            conditions.append("case_id = ?")
            params.append(case_id)
        
        where_clause = " AND ".join(conditions)
        
        query = f"""
            SELECT 
                run_id, correlation_id, case_id, track, phase, ollama_model,
                latency_ms, tokens_per_sec, load_duration_ns, success, error_code,
                created_at
            FROM llm_perf_runs
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """
        
        params.extend([limit, offset])
        results = await db.fetch_all(query, tuple(params))
        
        phase_names = {0: 'public_capsule', 1: 'plan', 2: 'draft'}
        
        return [{
            **dict(row),
            'phase_name': phase_names.get(row['phase'], f'phase_{row["phase"]}'),
            'load_ms': int(row['load_duration_ns'] / 1_000_000) if row['load_duration_ns'] else None,
            'tokens_per_sec': round(row['tokens_per_sec'], 2) if row['tokens_per_sec'] else None
        } for row in results]
    
    @staticmethod
    async def get_run_detail(run_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific run"""
        query = """
            SELECT * FROM llm_perf_runs WHERE run_id = ?
        """
        result = await db.fetch_one(query, (run_id,))
        
        if not result:
            return None
        
        phase_names = {0: 'public_capsule', 1: 'plan', 2: 'draft'}
        
        return {
            **dict(result),
            'phase_name': phase_names.get(result['phase'], f'phase_{result["phase"]}'),
            'load_ms': int(result['load_duration_ns'] / 1_000_000) if result['load_duration_ns'] else None,
            'prompt_eval_ms': int(result['prompt_eval_duration_ns'] / 1_000_000) if result['prompt_eval_duration_ns'] else None,
            'eval_ms': int(result['eval_duration_ns'] / 1_000_000) if result['eval_duration_ns'] else None,
            'total_ms': int(result['total_duration_ns'] / 1_000_000) if result['total_duration_ns'] else None,
            'tokens_per_sec': round(result['tokens_per_sec'], 2) if result['tokens_per_sec'] else None
        }
    
    @staticmethod
    async def get_available_models() -> List[str]:
        """Get list of models with recorded runs"""
        query = """
            SELECT DISTINCT ollama_model FROM llm_perf_runs ORDER BY ollama_model
        """
        results = await db.fetch_all(query)
        return [r['ollama_model'] for r in results]
    
    @staticmethod
    async def get_error_distribution(
        time_range: str = '24h',
        track: Optional[str] = None,
        model: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get distribution of error codes"""
        time_filters = {
            '1h': "datetime('now', '-1 hour')",
            '24h': "datetime('now', '-24 hours')",
            '7d': "datetime('now', '-7 days')"
        }
        time_clause = time_filters.get(time_range, time_filters['24h'])
        
        conditions = [f"created_at >= {time_clause}", "success = 0"]
        params = []
        
        if track:
            conditions.append("track = ?")
            params.append(track)
        if model:
            conditions.append("ollama_model = ?")
            params.append(model)
        
        where_clause = " AND ".join(conditions)
        
        query = f"""
            SELECT error_code, COUNT(*) as count
            FROM llm_perf_runs
            WHERE {where_clause}
            GROUP BY error_code
            ORDER BY count DESC
        """
        
        return await db.fetch_all(query, tuple(params))


# Singleton instance
perf_monitor = PerfMonitor()
