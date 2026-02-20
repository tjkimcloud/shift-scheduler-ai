from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
import os
from dotenv import load_dotenv

load_dotenv()

embeddings_model = OpenAIEmbeddings(api_key=os.getenv("OPENAI_API_KEY"))

def chunk_text(text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    return splitter.split_text(text)

def get_embeddings(chunks: list[str]) -> list[list[float]]:
    return embeddings_model.embed_documents(chunks)