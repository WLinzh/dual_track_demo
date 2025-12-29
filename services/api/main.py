"""
Dual-Track Healthcare Demo API
FastAPI backend with Ollama/Qwen integration
"""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from database import init_db
from routers import public, clinician, governance, audit, monitor

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup"""
    await init_db()
    yield


app = FastAPI(
    title="Dual-Track Healthcare API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(public.router, prefix="/api/public", tags=["Public Track"])
app.include_router(clinician.router, prefix="/api/clinician", tags=["Clinician Track"])
app.include_router(governance.router, prefix="/api/governance", tags=["Governance"])
app.include_router(audit.router, prefix="/api/audit", tags=["Audit"])
app.include_router(monitor.router, prefix="/api", tags=["Performance Monitor"])


@app.get("/")
async def root():
    return {
        "service": "Dual-Track Healthcare API",
        "version": "1.0.0",
        "tracks": ["public", "clinician"],
        "models": {
            "public": os.getenv("OLLAMA_PUBLIC_MODEL", "qwen2.5:1.5b-instruct"),
            "clinician": os.getenv("OLLAMA_CLINICIAN_MODEL", "qwen2.5:14b-instruct"),
            "embedding": os.getenv("OLLAMA_EMBED_MODEL", "qwen3-embedding")
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    from ollama_client import OllamaClient
    
    client = OllamaClient()
    try:
        # Quick health check
        await client.health_check()
        return {"status": "healthy", "ollama": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Ollama unavailable: {str(e)}")
