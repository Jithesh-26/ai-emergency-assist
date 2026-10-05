import os
from pathlib import Path
from typing import Dict, List, Any
from dotenv import load_dotenv

from langchain_community.vectorstores import Chroma
from langchain_google_genai import ChatGoogleGenerativeAI
from .ingest import get_embedding_model, run_ingestion, is_valid_api_key, COLLECTION_NAME

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CHROMA_DB_DIR = os.getenv("CHROMA_DB_DIR", str(BASE_DIR / "chroma_db"))
DOCUMENTS_DIR = os.getenv("DOCUMENTS_DIR", str(BASE_DIR / "data" / "documents"))

SYSTEM_PROMPT_TEMPLATE = """You are an official AI Emergency Response Assistant. Your duty is to provide clear, urgent, prioritized, and accurate emergency guidance based PRIMARILY on the retrieved official emergency response context.

CRITICAL INSTRUCTIONS:
1. Ground your answer strictly in the provided Context below.
2. If the Context does not contain enough information to answer the emergency query, clearly state: "The provided official emergency manuals do not contain specific instructions for this query. Please contact emergency services (911/112) immediately." Do NOT invent or make up safety procedures.
3. Structure your response with an urgent summary followed by numbered action steps.
4. Reference the document sources where appropriate.

Retrieved Official Emergency Context:
------------------------------------
{context}
------------------------------------

User Emergency Query: {query}

Provide immediate, step-by-step emergency instructions:"""


class RAGPipeline:
    def __init__(self, chroma_dir: str = CHROMA_DB_DIR, doc_dir: str = DOCUMENTS_DIR):
        self.chroma_dir = chroma_dir
        self.doc_dir = doc_dir
        self.vector_store = None
        self.llm = None
        self._initialize()

    def _initialize(self):
        """Initialize ChromaDB vector store and Gemini LLM."""
        api_key = os.getenv("GOOGLE_API_KEY", "").strip()

        try:
            embeddings = get_embedding_model(api_key)

            # Auto-ingest documents if vector DB doesn't exist yet
            if not os.path.exists(self.chroma_dir) or not os.listdir(self.chroma_dir):
                print("[INFO] Vector database not found. Running document ingestion...")
                run_ingestion(doc_dir=self.doc_dir, chroma_dir=self.chroma_dir)

            self.vector_store = Chroma(
                collection_name=COLLECTION_NAME,
                persist_directory=self.chroma_dir,
                embedding_function=embeddings
            )

            if is_valid_api_key(api_key):
                self.llm = ChatGoogleGenerativeAI(
                    model="gemini-3.8-flash",
                    google_api_key=api_key,
                    temperature=0.2
                )
            else:
                self.llm = None
                print("[WARNING] GOOGLE_API_KEY not configured. Gemini LLM set to offline mode.")
                
            print("[INFO] RAG Pipeline initialized successfully.")
        except Exception as e:
            print(f"[ERROR] RAG Pipeline initialization failed: {e}")

    def query(self, user_query: str, top_k: int = 4) -> Dict[str, Any]:
        """
        Executes complete RAG pipeline:
        1. Queries ChromaDB for top_k relevant text chunks.
        2. Extracts text and source document metadata.
        3. Sends context + question to Gemini API.
        4. Returns answer + formatted sources.
        """
        if not self.vector_store:
            self._initialize()

        if not self.vector_store:
            return {
                "answer": "Error: Vector Store could not be initialized.",
                "sources": []
            }

        try:
            # 1. Retrieve relevant chunks from ChromaDB
            results = self.vector_store.similarity_search_with_score(user_query, k=top_k)

            if not results:
                return {
                    "answer": "No relevant emergency documents were found for your query. If you are in immediate danger, please call emergency services (911/112) right away.",
                    "sources": []
                }

            context_chunks = []
            sources_list = []
            seen_sources = set()

            for doc, score in results:
                content = doc.page_content
                context_chunks.append(content)

                source_name = doc.metadata.get("source", "unknown_document")
                snippet = content[:200] + "..." if len(content) > 200 else content

                if source_name not in seen_sources:
                    seen_sources.add(source_name)
                    sources_list.append({
                        "document": source_name,
                        "relevance": snippet
                    })

            context = "\n\n".join(context_chunks)

            # 2. Call Gemini LLM if key is present
            api_key = os.getenv("GOOGLE_API_KEY", "").strip()
            if self.llm and is_valid_api_key(api_key):
                prompt = SYSTEM_PROMPT_TEMPLATE.format(context=context, query=user_query)
                llm_response = self.llm.invoke(prompt)
                
                if hasattr(llm_response, "content"):
                    if isinstance(llm_response.content, list):
                        answer_text = "".join([part.get("text", "") if isinstance(part, dict) else str(part) for part in llm_response.content])
                    else:
                        answer_text = str(llm_response.content)
                else:
                    answer_text = str(llm_response)
            else:
                answer_text = f"[NOTICE: GOOGLE_API_KEY Unconfigured] Retrieved {len(context_chunks)} relevant emergency protocol chunk(s) from document(s): {', '.join(seen_sources)}.\n\nRetrieved Guidance Summary:\n" + context[:500] + "..."

            return {
                "answer": answer_text,
                "sources": sources_list
            }

        except Exception as err:
            print(f"[ERROR] Error during RAG pipeline query execution: {err}")
            return {
                "answer": f"An error occurred while generating emergency guidance: {str(err)}",
                "sources": []
            }
