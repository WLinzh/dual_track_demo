"""
Seed Performance Data for Demo
Generates realistic LLM performance data for the Performance Monitor dashboard
"""
import asyncio
import uuid
import random
from datetime import datetime, timedelta, timezone
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db, init_db


async def seed_perf_data():
    """Generate sample performance data for demo"""
    await init_db()
    
    # Check if we already have data
    result = await db.fetch_one("SELECT COUNT(*) as count FROM llm_perf_runs")
    if result and result['count'] > 0:
        print(f"ℹ Already have {result['count']} perf runs, skipping seed")
        return
    
    print("🌱 Seeding performance data...")
    
    # First, ensure we have some test cases
    existing_cases = await db.fetch_all("SELECT id FROM cases LIMIT 10")
    case_ids = [c['id'] for c in existing_cases]
    
    if not case_ids:
        # Create some test cases
        for i in range(5):
            await db.execute(
                "INSERT INTO cases (case_number, patient_name, status, origin_track) VALUES (?, ?, ?, ?)",
                (f"CASE-{1000 + i}", f"Test Patient {i+1}", 'active', random.choice(['public', 'clinician']))
            )
        await db.commit()
        existing_cases = await db.fetch_all("SELECT id FROM cases LIMIT 10")
        case_ids = [c['id'] for c in existing_cases]
        print(f"  Created {len(case_ids)} test cases")
    
    # Configuration
    models = {
        'public': 'qwen2.5:1.5b-instruct',
        'clinician': 'qwen2.5:14b-instruct'
    }
    
    phases = {
        0: 'public_capsule',
        1: 'plan',
        2: 'draft'
    }
    
    # Generate data for the last 7 days
    now = datetime.now(timezone.utc)
    records = []
    
    for day_offset in range(7):
        date = now - timedelta(days=day_offset)
        
        # More runs on recent days
        daily_runs = random.randint(20, 50) if day_offset < 2 else random.randint(5, 20)
        
        for _ in range(daily_runs):
            # Random time within the day
            hour = random.randint(8, 20)
            minute = random.randint(0, 59)
            created_at = date.replace(hour=hour, minute=minute, second=random.randint(0, 59))
            
            track = random.choice(['public', 'clinician'])
            model = models[track]
            
            # Phase depends on track
            if track == 'public':
                phase = 0  # public_capsule
            else:
                phase = random.choice([1, 2])  # plan or draft
            
            # Success rate (95% success)
            success = random.random() < 0.95
            
            # Generate realistic metrics
            if track == 'public':
                # Smaller model - faster
                base_latency = random.randint(500, 1500)
                tokens_per_sec = random.uniform(50, 100)
                load_duration = random.randint(50, 500) * 1_000_000  # ns
            else:
                # Larger model - slower
                base_latency = random.randint(1500, 5000)
                tokens_per_sec = random.uniform(20, 60)
                load_duration = random.randint(100, 1000) * 1_000_000  # ns
            
            # Occasional cold start (high load_duration)
            is_cold_start = random.random() < 0.15
            if is_cold_start:
                load_duration = random.randint(3000, 8000) * 1_000_000  # 3-8 seconds in ns
                base_latency += int(load_duration / 1_000_000)
            
            # Context size
            ctx_chars_in = random.randint(500, 3000)
            ctx_chars_out = random.randint(200, 1500)
            
            # RAG stats for clinician
            if track == 'clinician':
                evidence_count = random.randint(2, 6)
                snippet_chars_total = evidence_count * random.randint(300, 600)
                top_k = random.choice([3, 5, 7])
            else:
                evidence_count = None
                snippet_chars_total = None
                top_k = None
            
            # Tokens (estimated)
            prompt_eval_count = random.randint(100, 500)
            eval_count = random.randint(50, 300)
            
            # Duration calculations
            prompt_eval_duration = prompt_eval_count * random.randint(1, 3) * 1_000_000  # ns
            eval_duration = int(eval_count / tokens_per_sec * 1_000_000_000)  # ns
            total_duration = load_duration + prompt_eval_duration + eval_duration
            
            # Error data
            error_code = None
            error_message = None
            http_status = 200
            
            if not success:
                error_types = [
                    ('TIMEOUT', 'Request timed out after 120s', None),
                    ('JSON_INVALID', 'Failed to parse JSON response', 200),
                    ('HTTP_500', 'Internal server error', 500),
                    ('ERROR', 'Connection reset by peer', None)
                ]
                error_code, error_message, http_status = random.choice(error_types)
                http_status = http_status or 200
                tokens_per_sec = None
            
            record = {
                'run_id': str(uuid.uuid4()),
                'correlation_id': str(uuid.uuid4()),
                'case_id': random.choice(case_ids) if case_ids else None,  # Use actual case IDs
                'track': track,
                'phase': phase,
                'ollama_model': model,
                'prompt_version_id': f"{'PUB' if track == 'public' else 'CLI'}_{phases[phase].upper()}_V1",
                'stream': 0,
                'temperature': None,
                'top_k': top_k,
                'snippet_chars_total': snippet_chars_total,
                'evidence_count': evidence_count,
                'ctx_chars_in': ctx_chars_in,
                'ctx_chars_out': ctx_chars_out if success else None,
                'retry_count': 0 if success else random.randint(0, 2),
                'success': 1 if success else 0,
                'error_code': error_code,
                'error_message': error_message,
                'http_status': http_status,
                'latency_ms': base_latency,
                'total_duration_ns': total_duration if success else None,
                'load_duration_ns': load_duration if success else None,
                'prompt_eval_count': prompt_eval_count if success else None,
                'prompt_eval_duration_ns': prompt_eval_duration if success else None,
                'eval_count': eval_count if success else None,
                'eval_duration_ns': eval_duration if success else None,
                'tokens_per_sec': tokens_per_sec,
                'created_at': created_at.isoformat()
            }
            records.append(record)
    
    # Insert records
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
    
    for record in records:
        await db.execute(query, (
            record['run_id'],
            record['correlation_id'],
            record['case_id'],
            record['track'],
            record['phase'],
            record['ollama_model'],
            record['prompt_version_id'],
            record['stream'],
            record['temperature'],
            record['top_k'],
            record['snippet_chars_total'],
            record['evidence_count'],
            record['ctx_chars_in'],
            record['ctx_chars_out'],
            record['retry_count'],
            record['success'],
            record['error_code'],
            record['error_message'],
            record['http_status'],
            record['latency_ms'],
            record['total_duration_ns'],
            record['load_duration_ns'],
            record['prompt_eval_count'],
            record['prompt_eval_duration_ns'],
            record['eval_count'],
            record['eval_duration_ns'],
            record['tokens_per_sec'],
            record['created_at']
        ))
    
    await db.commit()
    print(f"✓ Seeded {len(records)} performance records")
    
    # Print summary
    public_count = len([r for r in records if r['track'] == 'public'])
    clinician_count = len([r for r in records if r['track'] == 'clinician'])
    success_count = len([r for r in records if r['success']])
    
    print(f"  - Public track: {public_count}")
    print(f"  - Clinician track: {clinician_count}")
    print(f"  - Success rate: {success_count / len(records) * 100:.1f}%")


if __name__ == "__main__":
    asyncio.run(seed_perf_data())
