import os
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from database import init_db, log_query, get_recent_logs
from rag_engine import RAGEngine
from ingest import run_ingestion

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

# Initialize Database and RAG Engine on Startup
rag_engine: Optional[RAGEngine] = None

@app.on_event("startup")
def startup_event():
    global rag_engine
    init_db()
    print("🚀 SQLite database initialized.")
    try:
        rag_engine = RAGEngine()
    except Exception as e:
        print(f"⚠️ RAG Engine deferred initialization: {e}")

# Data Models
class ChatRequest(BaseModel):
    query: str = Field(..., example="What should I do if a kitchen fire breaks out?")

class SnippetItem(BaseModel):
    source: str
    text: str

class ChatResponse(BaseModel):
    answer: str
    sources: List[str]
    snippets: List[SnippetItem]
    log_id: Optional[int] = None

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
    
    is_healthy = api_key_valid
    
    return HealthResponse(
        status="healthy" if is_healthy else "degraded",
        api_key_configured=api_key_valid,
        vector_store_ready=vector_ready,
        message="System operating normally." if is_healthy else "Google API Key is unconfigured or vector store is empty."
    )


@app.post("/chat", response_model=ChatResponse, summary="Process Emergency Query")
def process_chat(request: ChatRequest):
    global rag_engine
    if not request.query or not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Emergency query text cannot be empty."
        )

    if not rag_engine:
        try:
            rag_engine = RAGEngine()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to initialize RAG Engine: {str(e)}"
            )

    result = rag_engine.query(request.query)
    
    # Log query into SQLite database
    log_id = log_query(
        query=request.query,
        answer=result["answer"],
        sources=result["sources"]
    )
    
    return ChatResponse(
        answer=result["answer"],
        sources=result["sources"],
        snippets=result["snippets"],
        log_id=log_id
    )


@app.post("/ingest", summary="Trigger Document Ingestion")
def trigger_ingestion():
    try:
        total_chunks = run_ingestion()
        global rag_engine
        rag_engine = RAGEngine()
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
