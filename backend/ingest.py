import os
from dotenv import load_dotenv
from langchain_community.document_loaders import DirectoryLoader, TextLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma

# Load environment variables
load_dotenv()

DATA_DIR = os.getenv("DATA_DIR", "../data")
CHROMA_DB_DIR = os.getenv("CHROMA_DB_DIR", "./chroma_db")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

def run_ingestion(data_dir: str = DATA_DIR, chroma_dir: str = CHROMA_DB_DIR):
    """
    Ingests text and PDF files from data_dir, chunks them, generates Gemini embeddings,
    and stores them in ChromaDB.
    """
    if not GOOGLE_API_KEY or GOOGLE_API_KEY == "your_gemini_api_key_here":
        raise ValueError("GOOGLE_API_KEY is missing or invalid in environment variables.")

    if not os.path.exists(data_dir):
        # Fallback to current directory data folder if relative path differs
        if os.path.exists("./data"):
            data_dir = "./data"
        elif os.path.exists("../data"):
            data_dir = "../data"
        else:
            raise FileNotFoundError(f"Data directory not found at: {data_dir}")

    print(f"📁 Loading documents from: {os.path.abspath(data_dir)}")
    documents = []

    # Load text files
    txt_loader = DirectoryLoader(
        data_dir,
        glob="**/*.txt",
        loader_cls=TextLoader,
        loader_kwargs={"encoding": "utf-8"}
    )
    documents.extend(txt_loader.load())

    # Load PDF files if present
    pdf_loader = DirectoryLoader(
        data_dir,
        glob="**/*.pdf",
        loader_cls=PyPDFLoader
    )
    documents.extend(pdf_loader.load())

    if not documents:
        print("⚠️ No documents found to ingest!")
        return 0

    print(f"📄 Found {len(documents)} document(s). Splitting into text chunks...")

    # Split documents into chunks
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=700,
        chunk_overlap=120,
        separators=["\n\n", "\n", " ", ""]
    )
    chunks = text_splitter.split_documents(documents)
    print(f"🧩 Created {len(chunks)} text chunks.")

    print("🧠 Generating Google Gemini Embeddings and updating ChromaDB...")
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/text-embedding-004",
        google_api_key=GOOGLE_API_KEY
    )

    vector_store = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=chroma_dir
    )

    print(f"✅ Ingestion complete! {len(chunks)} chunks stored in '{chroma_dir}'.")
    return len(chunks)

if __name__ == "__main__":
    try:
        total = run_ingestion()
        print(f"Successfully processed {total} chunks.")
    except Exception as e:
        print(f"❌ Ingestion failed: {str(e)}")
