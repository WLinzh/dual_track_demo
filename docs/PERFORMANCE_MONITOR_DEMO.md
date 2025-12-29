# Performance Monitor Demo Script
## Duration: 5-8 minutes

### Prerequisites
1. Ollama running with both models:
   - `ollama pull qwen2.5:1.5b-instruct`
   - `ollama pull qwen2.5:14b-instruct`
2. Services running: `pnpm dev`
3. Seed data loaded: `python services/api/scripts/seed_perf_data.py`

---

## Demo Flow

### 1. Introduction (30 seconds)
**Navigate to:** `http://localhost:5174/performance`

**Talk Track:**
> "This is our Performance Monitor dashboard. It provides real-time visibility into LLM performance across both tracks - Public and Clinician. Let me walk you through the key metrics."

### 2. KPI Overview (1 minute)
**Point to the top KPI cards:**

| Metric | Explanation |
|--------|-------------|
| Success Rate | Percentage of successful LLM calls (target: >95%) |
| p50/p95 Latency | Median and 95th percentile response times |
| p50 Tokens/s | Throughput - how fast the model generates text |
| Cold Start Rate | Percentage of requests that required model loading (>3s load time) |

**Talk Track:**
> "Our success rate is 95%+. The p50 latency shows the typical response time, while p95 shows worst-case scenarios. Cold start rate indicates how often Ollama needs to reload the model into memory."

### 3. Model Comparison (1.5 minutes)
**Point to the Model Comparison table:**

**Talk Track:**
> "Here we can compare our two models:
> - **qwen2.5:1.5b-instruct** (Public): Faster response times (~800ms), higher tokens/sec (~65 t/s)
> - **qwen2.5:14b-instruct** (Clinician): Slower (~2500ms) but more capable for complex tasks, lower tokens/sec (~30 t/s)
> 
> The trade-off is intentional: Public track prioritizes responsiveness for chat, while Clinician track needs the reasoning power for clinical document generation."

### 4. Phase Comparison (1.5 minutes)
**Point to the Phase Comparison table:**

**Phases explained:**
- **public_capsule (0):** Public track pre-assessment generation
- **plan (1):** Clinician track Phase 1 - planning the document structure
- **draft (2):** Clinician track Phase 2 - generating the full draft with RAG citations

**Talk Track:**
> "We can see how different phases perform:
> - **Plan phase** is faster because it's just structuring the document
> - **Draft phase** takes longer because it includes RAG retrieval and must insert citations
> - Notice the 'Avg Snippets' column - this shows RAG context size affecting latency"

### 5. Demonstrating Filters (1 minute)
**Use the filter dropdowns:**

1. Set Time Range to "Last 1 hour"
2. Filter by Track = "clinician"
3. Filter by Model = "qwen2.5:14b-instruct"

**Talk Track:**
> "Filters let us drill down into specific scenarios. For example, if we want to analyze just the Clinician track with the 14B model..."

### 6. Error Analysis (1 minute)
**If there are errors in the Error Distribution section:**

**Talk Track:**
> "When failures occur, they're logged with error codes:
> - **TIMEOUT**: Request exceeded 120 second limit
> - **JSON_INVALID**: Model returned malformed JSON (triggers auto-repair)
> - **HTTP_500**: Ollama internal error
> 
> This helps us quickly identify systemic issues. Importantly, failed requests are still recorded, so success rate calculations are accurate."

### 7. Drill-down to Run Details (1.5 minutes)
**Click "Details" on any run in the Recent Runs table:**

**Walk through the drawer:**
1. **Timing Breakdown:**
   - Load Duration: Model loading time (high = cold start)
   - Prompt Eval: Time to process input tokens
   - Eval: Time to generate output tokens
   - Tokens/sec: Effective generation speed

2. **Context Stats:**
   - Input/Output chars: Context size
   - Evidence count: Number of RAG documents used
   - Snippet chars: Total RAG context size
   - Retry count: Number of repair attempts

**Talk Track:**
> "Every LLM call is fully instrumented. We capture Ollama's native metrics like load_duration and eval_count, then calculate derived metrics like tokens/sec. This is essential for debugging slow requests or understanding the impact of RAG context size."

### 8. Cold Start Demonstration (1 minute)
**Point to runs with high load_ms values (>3000ms):**

**Talk Track:**
> "Cold starts happen when Ollama needs to load the model into GPU memory. Notice these runs with 3000ms+ load times. In production, we'd want to keep models warm with periodic health checks or use model pinning."

### 9. Closing - Link to Audit (30 seconds)
**Click "View Audit Trail" in a run detail drawer:**

**Talk Track:**
> "Finally, every performance run links to the full audit trail. This provides complete traceability from performance metrics to the actual LLM inputs/outputs, which is critical for compliance and debugging."

---

## Key Demo Points to Emphasize

1. **ollama_model as first-class field**: Every run records which model was used, enabling accurate model-specific analysis.

2. **Failures are tracked**: Failed requests are logged with error codes, ensuring accurate success rate calculation.

3. **RAG impact visibility**: The dashboard shows how RAG context size (snippet_chars_total, evidence_count) affects latency.

4. **Cold start awareness**: load_duration tracking helps identify warm vs cold model states.

5. **End-to-end traceability**: Performance data links to audit trail for full observability.

---

## Troubleshooting

**No data showing?**
Run the seed script: `cd services/api && python scripts/seed_perf_data.py`

**Empty models dropdown?**
The models are populated from actual recorded runs. Run some real LLM requests first.

**API errors?**
Check that the FastAPI server is running on port 3001.
