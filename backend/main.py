import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Ensure backend directory is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from database import init_db, log_query, get_recent_logs
from rag.pipeline import RAGPipeline
from rag.ingest import run_ingestion

load_dotenv()

# Initialize FastAPI App
app = FastAPI(
    title="AI Emergency Response Assistant API",
    description="RAG-powered AI API for immediate emergency guidance and safety procedures.",
    version="1.0.0"
)

# CORS Configuration
allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [origin.strip() for origin in allowed_origins_raw.split(",")] if allowed_origins_raw != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize RAG Pipeline Instance
rag_pipeline: Optional[RAGPipeline] = None


@app.on_event("startup")
def startup_event():
    global rag_pipeline
    init_db()
    print("🚀 SQLite database initialized.")
    try:
        rag_pipeline = RAGPipeline()
    except Exception as e:
        print(f"⚠️ RAG Pipeline deferred startup: {e}")


# Data Models
class ChatRequest(BaseModel):
    query: str = Field(..., example="What should I do if a kitchen grease fire breaks out?")


class SourceItem(BaseModel):
    document: str
    relevance: str


class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceItem]


class HealthResponse(BaseModel):
    status: str
    api_key_configured: bool
    vector_store_ready: bool
    message: str


# Endpoints
@app.get("/", summary="Root Endpoint")
def read_root():
    return {
        "app": "AI Emergency Response Assistant API",
        "status": "online",
        "docs_url": "/docs"
    }


@app.get("/health", response_model=HealthResponse, summary="Health Check")
def health_check():
    api_key = os.getenv("GOOGLE_API_KEY")
    api_key_valid = bool(api_key and api_key != "your_gemini_api_key_here")
    
    chroma_dir = os.getenv("CHROMA_DB_DIR", "./chroma_db")
    vector_ready = os.path.exists(chroma_dir) and len(os.listdir(chroma_dir)) > 0
    
    is_healthy = api_key_valid and vector_ready
    
    return HealthResponse(
        status="healthy" if is_healthy else "degraded",
        api_key_configured=api_key_valid,
        vector_store_ready=vector_ready,
        message="System operating normally." if is_healthy else "Google API Key is unconfigured or vector store is empty."
    )


@app.post("/chat", response_model=ChatResponse, summary="Process Emergency Query")
def process_chat(request: ChatRequest):
    global rag_pipeline
    if not request.query or not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Emergency query text cannot be empty."
        )

    if not rag_pipeline:
        try:
            rag_pipeline = RAGPipeline()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to initialize RAG Pipeline: {str(e)}"
            )

    result = rag_pipeline.query(request.query)
    
    # Extract source filenames for database logging
    doc_names = [s["document"] for s in result.get("sources", [])]
    
    # Log query into SQLite database
    try:
        log_query(
            query=request.query,
            answer=result["answer"],
            sources=doc_names
        )
    except Exception as err:
        print(f"⚠️ Warning logging query to DB: {err}")
    
    return ChatResponse(
        answer=result["answer"],
        sources=result.get("sources", [])
    )


@app.post("/ingest", summary="Trigger Document Ingestion")
def trigger_ingestion():
    try:
        total_chunks = run_ingestion()
        global rag_pipeline
        rag_pipeline = RAGPipeline()
        return {
            "status": "success",
            "message": f"Successfully ingested {total_chunks} text chunks into ChromaDB vector store."
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingestion failed: {str(e)}"
        )


@app.get("/history", summary="Get Recent Emergency Logs")
def get_history(limit: int = 10):
    logs = get_recent_logs(limit=limit)
    return {"logs": logs}
