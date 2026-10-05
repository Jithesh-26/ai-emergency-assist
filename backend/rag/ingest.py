import os
import sys
import gc
import shutil
from pathlib import Path
from dotenv import load_dotenv

from langchain_community.document_loaders import DirectoryLoader, TextLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_core.embeddings import FakeEmbeddings
from langchain_community.vectorstores import Chroma

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DOCUMENTS_DIR = os.getenv("DOCUMENTS_DIR", str(BASE_DIR / "data" / "documents"))
CHROMA_DB_DIR = os.getenv("CHROMA_DB_DIR", str(BASE_DIR / "chroma_db"))

PLACEHOLDER_KEYS = {"your_gemini_api_key_here", "PASTE_YOUR_KEY_HERE", "your_actual_gemini_api_key", ""}
COLLECTION_NAME = "emergency_guidance_v1"


def is_valid_api_key(api_key: str = None) -> bool:
    """Check if API Key is configured and not a placeholder."""
    key = (api_key or os.getenv("GOOGLE_API_KEY", "")).strip()
    return bool(key and key not in PLACEHOLDER_KEYS)


def get_embedding_model(api_key: str = None):
    """
    Initialize embedding model.
    Uses GoogleGenerativeAIEmbeddings (models/gemini-embedding-001) if GOOGLE_API_KEY is available and valid.
    Falls back to FakeEmbeddings for offline testing if unconfigured or key is invalid.
    """
    key = (api_key or os.getenv("GOOGLE_API_KEY", "")).strip()
    
    if is_valid_api_key(key):
        try:
            model = GoogleGenerativeAIEmbeddings(
                model="models/gemini-embedding-001",
                google_api_key=key
            )
            model.embed_query("test authentication")
            return model
        except Exception as err:
            print(f"[WARNING] Google Gemini API Embedding Error: {err}")
            print("[INFO] Falling back to local embeddings.")
    else:
        print("[INFO] GOOGLE_API_KEY is unconfigured or set to placeholder. Using fallback local embeddings for vector storage.")
        
    return FakeEmbeddings(size=768)


def run_ingestion(doc_dir: str = DOCUMENTS_DIR, chroma_dir: str = CHROMA_DB_DIR):
    """
    Ingests PDF and TXT documents from doc_dir, splits into chunks,
    generates embeddings, and persists to ChromaDB.
    """
    doc_path = Path(doc_dir)
    
    # 1. Create document directory if missing
    if not doc_path.exists():
        print(f"[INFO] Creating document directory at: {doc_path}")
        doc_path.mkdir(parents=True, exist_ok=True)

    # 2. Load Documents
    documents = []
    
    # Load TXT files
    try:
        txt_loader = DirectoryLoader(
            str(doc_path),
            glob="**/*.txt",
            loader_cls=TextLoader,
            loader_kwargs={"encoding": "utf-8"}
        )
        documents.extend(txt_loader.load())
    except Exception as e:
        print(f"[WARNING] Loading TXT documents: {e}")

    # Load PDF files
    try:
        pdf_loader = DirectoryLoader(
            str(doc_path),
            glob="**/*.pdf",
            loader_cls=PyPDFLoader
        )
        documents.extend(pdf_loader.load())
    except Exception as e:
        print(f"[WARNING] Loading PDF documents: {e}")

    if not documents:
        print(f"[WARNING] No documents found in '{doc_path}'. Aborting ingestion.")
        return 0

    print(f"[INFO] Loaded {len(documents)} document(s) from '{doc_path}'.")

    # 3. Text Chunking
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=700,
        chunk_overlap=120,
        separators=["\n\n", "\n", " ", ""]
    )
    chunks = text_splitter.split_documents(documents)
    print(f"[INFO] Split documents into {len(chunks)} text chunks.")

    # Format source metadata to store clean filenames
    for chunk in chunks:
        raw_source = chunk.metadata.get("source", "unknown")
        chunk.metadata["source"] = Path(raw_source).name

    # 4. Generate Embeddings & Store in ChromaDB
    embeddings = get_embedding_model()

    gc.collect()

    vector_store = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=chroma_dir
    )
    
    # Reset collection if exists
    try:
        vector_store.delete_collection()
    except Exception:
        pass

    vector_store = Chroma.from_documents(
        collection_name=COLLECTION_NAME,
        documents=chunks,
        embedding=embeddings,
        persist_directory=chroma_dir
    )

    print(f"[SUCCESS] Ingestion complete! {len(chunks)} chunks stored in ChromaDB at '{chroma_dir}'.")
    return len(chunks)


if __name__ == "__main__":
    try:
        print("[INFO] Starting Document Ingestion Pipeline...")
        count = run_ingestion()
        print(f"[SUCCESS] Completed ingestion of {count} chunks.")
    except Exception as err:
        print(f"[ERROR] Ingestion failed: {err}", file=sys.stderr)
        sys.exit(1)
