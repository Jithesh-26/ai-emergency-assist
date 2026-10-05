import os
import sys
from pathlib import Path
from dotenv import load_dotenv

from langchain_community.document_loaders import DirectoryLoader, TextLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma

load_dotenv()

# Determine paths relative to project root or current directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DOCUMENTS_DIR = os.getenv("DOCUMENTS_DIR", str(BASE_DIR / "data" / "documents"))
CHROMA_DB_DIR = os.getenv("CHROMA_DB_DIR", str(BASE_DIR / "chroma_db"))


def get_embedding_model(api_key: str = None):
    """Initialize Google Gemini Embeddings model."""
    key = api_key or os.getenv("GOOGLE_API_KEY")
    if not key or key == "your_gemini_api_key_here":
        raise ValueError(
            "GOOGLE_API_KEY is missing or unconfigured. Please set it in your environment or .env file."
        )
    return GoogleGenerativeAIEmbeddings(
        model="models/text-embedding-004",
        google_api_key=key
    )


def run_ingestion(doc_dir: str = DOCUMENTS_DIR, chroma_dir: str = CHROMA_DB_DIR):
    """
    Ingests PDF and TXT documents from doc_dir, splits into chunks,
    generates embeddings using Google Gemini, and persists to ChromaDB.
    """
    doc_path = Path(doc_dir)
    
    # 1. Create document directory if it doesn't exist
    if not doc_path.exists():
        print(f"📁 Directory {doc_path} does not exist. Creating it now...")
        doc_path.mkdir(parents=True, exist_ok=True)
        print(f"⚠️ Please add emergency documents (.txt or .pdf) to: {doc_path}")

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
        print(f"⚠️ Warning loading TXT documents: {e}")

    # Load PDF files
    try:
        pdf_loader = DirectoryLoader(
            str(doc_path),
            glob="**/*.pdf",
            loader_cls=PyPDFLoader
        )
        documents.extend(pdf_loader.load())
    except Exception as e:
        print(f"⚠️ Warning loading PDF documents: {e}")

    if not documents:
        print(f"⚠️ No documents found in '{doc_path}'. Aborting ingestion.")
        return 0

    print(f"📄 Loaded {len(documents)} document(s) from '{doc_path}'.")

    # 3. Text Chunking
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=700,
        chunk_overlap=120,
        separators=["\n\n", "\n", " ", ""]
    )
    chunks = text_splitter.split_documents(documents)
    print(f"🧩 Split documents into {len(chunks)} text chunks.")

    # Format source metadata to store clean filenames
    for chunk in chunks:
        raw_source = chunk.metadata.get("source", "unknown")
        chunk.metadata["source"] = Path(raw_source).name

    # 4. Generate Embeddings & Store in ChromaDB
    print("🧠 Generating embeddings via Google Gemini API...")
    embeddings = get_embedding_model()

    # Re-initialize collection to avoid duplicates on re-runs
    if os.path.exists(chroma_dir):
        print(f"🧹 Replacing existing vector DB collection at '{chroma_dir}'...")

    vector_store = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=chroma_dir
    )

    print(f"✅ Ingestion successful! {len(chunks)} chunks stored in ChromaDB at '{chroma_dir}'.")
    return len(chunks)


if __name__ == "__main__":
    try:
        print("🚀 Starting Document Ingestion Pipeline...")
        count = run_ingestion()
        print(f"🎉 Completed ingestion of {count} chunks.")
    except Exception as err:
        print(f"❌ Ingestion Error: {err}", file=sys.stderr)
        sys.exit(1)
