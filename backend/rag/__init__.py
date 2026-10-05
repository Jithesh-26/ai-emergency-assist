"""
RAG Module for AI Emergency Response Assistant.
Handles document loading, text chunking, embedding generation, ChromaDB vector storage,
retrieval, and Gemini LLM answer generation.
"""

from .ingest import run_ingestion
from .pipeline import RAGPipeline

__all__ = ["run_ingestion", "RAGPipeline"]
