"""
Ollama HTTP API Client
Handles all LLM interactions via Ollama's HTTP API
With Performance Monitoring Integration
"""
import os
import json
import httpx
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from perf_monitor import PerfMonitor, PerfRunContext


class OllamaConfig:
    """Configuration for Ollama models by track"""
    BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    PUBLIC_MODEL = os.getenv("OLLAMA_PUBLIC_MODEL", "qwen2.5:1.5b-instruct")
    CLINICIAN_MODEL = os.getenv("OLLAMA_CLINICIAN_MODEL", "qwen2.5:14b-instruct")
    EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "qwen3-embedding")
    
    @classmethod
    def get_model_for_track(cls, track: str) -> str:
        """Get model name for given track (enforced backend-side)"""
        if track == "public":
            return cls.PUBLIC_MODEL
        elif track == "clinician":
            return cls.CLINICIAN_MODEL
        else:
            raise ValueError(f"Invalid track: {track}")


class ChatMessage(BaseModel):
    role: str  # 'system', 'user', 'assistant'
    content: str


class OllamaClient:
    """Client for Ollama HTTP API with Performance Monitoring"""
    
    def __init__(self):
        self.base_url = OllamaConfig.BASE_URL
        self.timeout = httpx.Timeout(120.0, connect=10.0)
        self.perf_enabled = True  # Enable/disable perf tracking
    
    async def health_check(self) -> bool:
        """Check if Ollama is running"""
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
            except Exception:
                return False
    
    async def chat(
        self,
        messages: List[ChatMessage],
        track: str,
        stream: bool = False,
        format_json: Optional[Dict[str, Any]] = None,
        # Performance tracking params
        perf_context: Optional[PerfRunContext] = None,
        case_id: Optional[int] = None,
        phase: int = 0,
        correlation_id: Optional[str] = None,
        prompt_version_id: Optional[str] = None,
        evidence_count: Optional[int] = None,
        snippet_chars_total: Optional[int] = None,
        top_k: Optional[int] = None,
        temperature: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Call Ollama /api/chat endpoint with performance tracking
        """
        model = OllamaConfig.get_model_for_track(track)
        
        payload = {
            "model": model,
            "messages": [{"role": msg.role, "content": msg.content} for msg in messages],
            "stream": stream
        }
        
        if format_json:
            payload["format"] = format_json
        
        # Calculate context size
        ctx_chars_in = sum(len(msg.content) for msg in messages)
        
        # Create perf context if not provided and tracking is enabled
        if self.perf_enabled and not perf_context:
            perf_context = PerfMonitor.create_run(
                track=track,
                phase=phase,
                ollama_model=model,
                correlation_id=correlation_id,
                case_id=case_id,
                prompt_version_id=prompt_version_id,
                stream=stream,
                temperature=temperature,
                top_k=top_k,
                snippet_chars_total=snippet_chars_total,
                evidence_count=evidence_count,
                ctx_chars_in=ctx_chars_in
            )
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json=payload
                )
                response.raise_for_status()
                result = response.json()
                
                # Extract performance metrics
                if self.perf_enabled and perf_context:
                    PerfMonitor.extract_ollama_metrics(result, perf_context)
                    await PerfMonitor.save_run(perf_context)
                
                # Add run_id to response for correlation
                if perf_context:
                    result['_perf_run_id'] = perf_context.run_id
                    result['_perf_correlation_id'] = perf_context.correlation_id
                
                return result
                
        except httpx.TimeoutException as e:
            if self.perf_enabled and perf_context:
                PerfMonitor.mark_failed(perf_context, 'TIMEOUT', str(e))
                await PerfMonitor.save_run(perf_context)
            raise
        except httpx.HTTPStatusError as e:
            if self.perf_enabled and perf_context:
                PerfMonitor.mark_failed(perf_context, f'HTTP_{e.response.status_code}', str(e), e.response.status_code)
                await PerfMonitor.save_run(perf_context)
            raise
        except Exception as e:
            if self.perf_enabled and perf_context:
                PerfMonitor.mark_failed(perf_context, 'ERROR', str(e))
                await PerfMonitor.save_run(perf_context)
            raise
    
    async def generate(
        self,
        prompt: str,
        track: str,
        system: Optional[str] = None,
        format_json: Optional[Dict[str, Any]] = None,
        # Performance tracking params
        case_id: Optional[int] = None,
        phase: int = 0,
        correlation_id: Optional[str] = None,
        prompt_version_id: Optional[str] = None,
        evidence_count: Optional[int] = None,
        snippet_chars_total: Optional[int] = None,
        top_k: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Call Ollama /api/generate endpoint with performance tracking
        """
        model = OllamaConfig.get_model_for_track(track)
        
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False
        }
        
        if system:
            payload["system"] = system
        if format_json:
            payload["format"] = format_json
        
        ctx_chars_in = len(prompt) + (len(system) if system else 0)
        
        perf_context = None
        if self.perf_enabled:
            perf_context = PerfMonitor.create_run(
                track=track,
                phase=phase,
                ollama_model=model,
                correlation_id=correlation_id,
                case_id=case_id,
                prompt_version_id=prompt_version_id,
                stream=False,
                top_k=top_k,
                snippet_chars_total=snippet_chars_total,
                evidence_count=evidence_count,
                ctx_chars_in=ctx_chars_in
            )
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json=payload
                )
                response.raise_for_status()
                result = response.json()
                
                if self.perf_enabled and perf_context:
                    PerfMonitor.extract_ollama_metrics(result, perf_context)
                    await PerfMonitor.save_run(perf_context)
                
                if perf_context:
                    result['_perf_run_id'] = perf_context.run_id
                    result['_perf_correlation_id'] = perf_context.correlation_id
                
                return result
                
        except httpx.TimeoutException as e:
            if self.perf_enabled and perf_context:
                PerfMonitor.mark_failed(perf_context, 'TIMEOUT', str(e))
                await PerfMonitor.save_run(perf_context)
            raise
        except httpx.HTTPStatusError as e:
            if self.perf_enabled and perf_context:
                PerfMonitor.mark_failed(perf_context, f'HTTP_{e.response.status_code}', str(e), e.response.status_code)
                await PerfMonitor.save_run(perf_context)
            raise
        except Exception as e:
            if self.perf_enabled and perf_context:
                PerfMonitor.mark_failed(perf_context, 'ERROR', str(e))
                await PerfMonitor.save_run(perf_context)
            raise
    
    async def embed(self, text: str) -> List[float]:
        """
        Generate embedding via Ollama /api/embed
        
        Args:
            text: Text to embed
        
        Returns:
            List of floats (embedding vector)
        """
        payload = {
            "model": OllamaConfig.EMBED_MODEL,
            "input": text
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/embed",
                json=payload
            )
            response.raise_for_status()
            result = response.json()
            
            # Ollama returns {"embeddings": [[...]]} for single input
            if "embeddings" in result and len(result["embeddings"]) > 0:
                return result["embeddings"][0]
            elif "embedding" in result:
                return result["embedding"]
            else:
                raise ValueError(f"Unexpected embed response format: {result}")
    
    async def chat_structured(
        self,
        messages: List[ChatMessage],
        track: str,
        json_schema: Dict[str, Any],
        max_repair_attempts: int = 1,
        # Performance tracking params
        case_id: Optional[int] = None,
        phase: int = 0,
        correlation_id: Optional[str] = None,
        prompt_version_id: Optional[str] = None,
        evidence_count: Optional[int] = None,
        snippet_chars_total: Optional[int] = None,
        top_k: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Chat with structured JSON output and validation/repair
        With performance tracking
        """
        model = OllamaConfig.get_model_for_track(track)
        ctx_chars_in = sum(len(msg.content) for msg in messages)
        
        # Create perf context for initial attempt
        perf_context = None
        if self.perf_enabled:
            perf_context = PerfMonitor.create_run(
                track=track,
                phase=phase,
                ollama_model=model,
                correlation_id=correlation_id,
                case_id=case_id,
                prompt_version_id=prompt_version_id,
                stream=False,
                top_k=top_k,
                snippet_chars_total=snippet_chars_total,
                evidence_count=evidence_count,
                ctx_chars_in=ctx_chars_in
            )
        
        # First attempt with JSON format constraint
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": model,
                        "messages": [{"role": msg.role, "content": msg.content} for msg in messages],
                        "stream": False,
                        "format": {"type": "object"}
                    }
                )
                response.raise_for_status()
                ollama_response = response.json()
        except httpx.TimeoutException as e:
            if self.perf_enabled and perf_context:
                PerfMonitor.mark_failed(perf_context, 'TIMEOUT', str(e))
                await PerfMonitor.save_run(perf_context)
            raise
        except httpx.HTTPStatusError as e:
            if self.perf_enabled and perf_context:
                PerfMonitor.mark_failed(perf_context, f'HTTP_{e.response.status_code}', str(e), e.response.status_code)
                await PerfMonitor.save_run(perf_context)
            raise
        except Exception as e:
            if self.perf_enabled and perf_context:
                PerfMonitor.mark_failed(perf_context, 'ERROR', str(e))
                await PerfMonitor.save_run(perf_context)
            raise
        
        content = ollama_response["message"]["content"]
        validation_status = "valid"
        repair_attempts = 0
        
        try:
            data = json.loads(content)
            if not isinstance(data, dict):
                raise ValueError("Expected JSON object")
            
            # Success - save perf metrics
            if self.perf_enabled and perf_context:
                PerfMonitor.extract_ollama_metrics(ollama_response, perf_context)
                await PerfMonitor.save_run(perf_context)
            
            return {
                "data": data,
                "raw_content": content,
                "validation_status": validation_status,
                "repair_attempts": repair_attempts,
                "model": ollama_response.get("model"),
                "_perf_run_id": perf_context.run_id if perf_context else None,
                "_perf_correlation_id": perf_context.correlation_id if perf_context else None
            }
        except (json.JSONDecodeError, ValueError) as e:
            # Need repair attempt
            if repair_attempts < max_repair_attempts:
                repair_attempts += 1
                if self.perf_enabled and perf_context:
                    PerfMonitor.increment_retry(perf_context)
                
                repair_messages = messages + [
                    ChatMessage(role="assistant", content=content),
                    ChatMessage(
                        role="user",
                        content=f"The JSON output was invalid ({str(e)}). Please provide a valid JSON object matching the required schema."
                    )
                ]
                
                try:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        repair_response = await client.post(
                            f"{self.base_url}/api/chat",
                            json={
                                "model": model,
                                "messages": [{"role": msg.role, "content": msg.content} for msg in repair_messages],
                                "stream": False,
                                "format": {"type": "object"}
                            }
                        )
                        repair_response.raise_for_status()
                        repair_result = repair_response.json()
                except Exception as repair_e:
                    if self.perf_enabled and perf_context:
                        PerfMonitor.mark_failed(perf_context, 'REPAIR_FAILED', str(repair_e))
                        await PerfMonitor.save_run(perf_context)
                    raise
                
                try:
                    repaired_data = json.loads(repair_result["message"]["content"])
                    
                    # Success after repair - save perf
                    if self.perf_enabled and perf_context:
                        PerfMonitor.extract_ollama_metrics(repair_result, perf_context)
                        await PerfMonitor.save_run(perf_context)
                    
                    return {
                        "data": repaired_data,
                        "raw_content": repair_result["message"]["content"],
                        "validation_status": "repaired",
                        "repair_attempts": repair_attempts,
                        "model": repair_result.get("model"),
                        "_perf_run_id": perf_context.run_id if perf_context else None,
                        "_perf_correlation_id": perf_context.correlation_id if perf_context else None
                    }
                except json.JSONDecodeError:
                    pass
            
            # Repair failed - save as failure
            if self.perf_enabled and perf_context:
                PerfMonitor.mark_failed(perf_context, 'JSON_INVALID', 'Failed to parse JSON after repair')
                await PerfMonitor.save_run(perf_context)
            
            return {
                "data": None,
                "raw_content": content,
                "validation_status": "invalid",
                "repair_attempts": repair_attempts,
                "model": ollama_response.get("model"),
                "_perf_run_id": perf_context.run_id if perf_context else None,
                "_perf_correlation_id": perf_context.correlation_id if perf_context else None
            }
