import os
from typing import Dict, List, Any
from dotenv import load_dotenv
from langchain_community.vectorstores import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from ingest import run_ingestion

load_dotenv()

CHROMA_DB_DIR = os.getenv("CHROMA_DB_DIR", "./chroma_db")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

EMERGENCY_PROMPT_TEMPLATE = """You are an official AI Emergency Response Assistant. Your primary goal is to provide immediate, clear, accurate, and prioritized safety instructions for emergency situations based on official guidance documents.

IMPORTANT EMERGENCY SAFETY DIRECTIVE:
1. Always start with an urgent, direct action summary (1-2 sentences).
2. Provide numbered, step-by-step instructions in order of priority.
3. Emphasize life-safety steps (e.g., call local emergency services like 911 immediately if lives are in danger).
4. Strictly ground your advice in the provided Context below. If the Context does not contain specific information for a minor detail, rely on standard emergency safety protocols while staying consistent with the context.

Context from official emergency response documents:
---------------------------------------------------
{context}
---------------------------------------------------

User Emergency Query: {query}

Provide a clear, urgent, step-by-step emergency response guide:"""


class RAGEngine:
    def __init__(self, chroma_dir: str = CHROMA_DB_DIR):
        self.chroma_dir = chroma_dir
        self.vector_store = None
        self.embeddings = None
        self.llm = None
        self._initialize()

    def _initialize(self):
        """Initialize embeddings, vector store, and Gemini LLM."""
        if not GOOGLE_API_KEY or GOOGLE_API_KEY == "your_gemini_api_key_here":
            print("⚠️ GOOGLE_API_KEY is missing or unconfigured!")
            return

        try:
            self.embeddings = GoogleGenerativeAIEmbeddings(
                model="models/text-embedding-004",
                google_api_key=GOOGLE_API_KEY
            )

            # Check if Chroma DB directory exists, if not run ingestion automatically
            if not os.path.exists(self.chroma_dir) or not os.listdir(self.chroma_dir):
                print("🔄 Vector database missing. Running initial document ingestion...")
                run_ingestion(chroma_dir=self.chroma_dir)

            self.vector_store = Chroma(
                persist_directory=self.chroma_dir,
                embedding_function=self.embeddings
            )

            self.llm = ChatGoogleGenerativeAI(
                model="gemini-1.5-flash",
                google_api_key=GOOGLE_API_KEY,
                temperature=0.2
            )
            print("✅ RAG Engine initialized successfully.")
        except Exception as e:
            print(f"❌ RAG Engine initialization error: {e}")

    def query(self, user_query: str, top_k: int = 4) -> Dict[str, Any]:
        """
        Executes RAG pipeline:
        1. Retrieve top-k relevant document chunks from ChromaDB.
        2. Extract document source names and text snippets.
        3. Format prompt with context and send to Gemini LLM.
        4. Return response answer, sources, and snippets.
        """
        if not self.vector_store or not self.llm:
            # Re-try initialization if it failed earlier
            self._initialize()
            if not self.vector_store or not self.llm:
                return {
                    "answer": "⚠️ Error: The AI Assistant is not configured properly. Please ensure a valid GOOGLE_API_KEY is set in the environment variables.",
                    "sources": [],
                    "snippets": []
                }

        try:
            # Retrieve relevant document chunks
            docs_and_scores = self.vector_store.similarity_search_with_score(user_query, k=top_k)
            
            context_blocks = []
            sources_set = set()
            snippets = []

            for doc, score in docs_and_scores:
                context_blocks.append(doc.page_content)
                source_path = doc.metadata.get("source", "Emergency Manual")
                source_filename = os.path.basename(source_path)
                sources_set.add(source_filename)
                
                snippets.append({
                    "source": source_filename,
                    "text": doc.page_content[:300] + "..." if len(doc.page_content) > 300 else doc.page_content
                })

            context = "\n\n".join(context_blocks) if context_blocks else "No specific document context found."

            # Construct Prompt
            prompt = EMERGENCY_PROMPT_TEMPLATE.format(context=context, query=user_query)

            # Generate response from Gemini
            response = self.llm.invoke(prompt)
            answer_text = response.content if hasattr(response, 'content') else str(response)

            return {
                "answer": answer_text,
                "sources": list(sources_set),
                "snippets": snippets
            }

        except Exception as e:
            print(f"❌ Error during RAG query execution: {str(e)}")
            return {
                "answer": f"⚠️ An error occurred while generating the emergency guidance: {str(e)}",
                "sources": [],
                "snippets": []
            }
