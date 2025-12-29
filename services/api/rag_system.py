"""
RAG (Retrieval-Augmented Generation) System
Embedding + Vector Search + Citation Enforcement
"""
import json
import numpy as np
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from sklearn.metrics.pairwise import cosine_similarity

from ollama_client import OllamaClient
from database import get_db, log_event


class EvidenceRef(BaseModel):
    """Evidence reference from RAG retrieval"""
    doc_id: str
    title: str
    snippet: str
    score: float
    category: Optional[str] = None


class RAGSystem:
    """RAG system with embedding and vector search"""
    
    def __init__(self):
        self.ollama = OllamaClient()
        self.db = get_db()
        self._doc_cache: Dict[str, Dict] = {}
    
    async def index_document(self, doc_id: str, content: str, title: str, category: str = None):
        """
        Generate embedding for document and store in database
        
        Args:
            doc_id: Unique document identifier
            content: Document text content
            title: Document title
            category: Document category (guideline, protocol, policy)
        """
        # Generate embedding
        embedding = await self.ollama.embed(content)
        embedding_bytes = np.array(embedding, dtype=np.float32).tobytes()
        
        # Store in database
        query = """
            INSERT OR REPLACE INTO documents (doc_id, title, category, content, embedding, active)
            VALUES (?, ?, ?, ?, ?, 1)
        """
        await self.db.execute(query, (doc_id, title, category, content, embedding_bytes))
        await self.db.commit()
        
        print(f"✓ Indexed document: {doc_id} ({len(embedding)} dims)")
    
    async def _ensure_embeddings(self):
        """Ensure all documents have embeddings (one-time setup)"""
        query = "SELECT id, doc_id, title, category, content, embedding FROM documents WHERE active = 1"
        docs = await self.db.fetch_all(query)
        
        for doc in docs:
            if not doc['embedding']:
                # Generate missing embedding
                print(f"Generating embedding for {doc['doc_id']}...")
                await self.index_document(
                    doc_id=doc['doc_id'],
                    content=doc['content'],
                    title=doc['title'],
                    category=doc['category']
                )
    
    async def retrieve(
        self,
        query: str,
        top_k: int = 3,
        category_filter: Optional[str] = None
    ) -> List[EvidenceRef]:
        """
        Retrieve relevant documents using semantic search
        
        Args:
            query: Search query
            top_k: Number of results to return
            category_filter: Optional category filter
        
        Returns:
            List of evidence references with citations
        """
        # Ensure embeddings exist
        await self._ensure_embeddings()
        
        # Generate query embedding
        query_embedding = await self.ollama.embed(query)
        query_vec = np.array(query_embedding, dtype=np.float32).reshape(1, -1)
        
        # Fetch all document embeddings
        if category_filter:
            db_query = "SELECT doc_id, title, category, content, embedding FROM documents WHERE active = 1 AND category = ?"
            docs = await self.db.fetch_all(db_query, (category_filter,))
        else:
            db_query = "SELECT doc_id, title, category, content, embedding FROM documents WHERE active = 1"
            docs = await self.db.fetch_all(db_query)
        
        if not docs:
            return []
        
        # Calculate similarities
        results = []
        for doc in docs:
            if not doc['embedding']:
                continue
            
            doc_vec = np.frombuffer(doc['embedding'], dtype=np.float32).reshape(1, -1)
            similarity = cosine_similarity(query_vec, doc_vec)[0][0]
            
            # Create snippet (first 200 chars)
            snippet = doc['content'][:200] + "..." if len(doc['content']) > 200 else doc['content']
            
            results.append(EvidenceRef(
                doc_id=doc['doc_id'],
                title=doc['title'],
                snippet=snippet,
                score=float(similarity),
                category=doc['category']
            ))
        
        # Sort by score and return top-k
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:top_k]
    
    async def validate_citations(self, content: str) -> Dict[str, Any]:
        """
        Validate that content contains proper citations
        
        Args:
            content: Generated content to check
        
        Returns:
            {
                "has_citations": bool,
                "citation_count": int,
                "cited_docs": list[str],
                "valid": bool
            }
        """
        import re
        
        # Find all citations in format [DOC:doc_id]
        citation_pattern = r'\[DOC:(\w+)\]'
        citations = re.findall(citation_pattern, content)
        
        has_citations = len(citations) > 0
        cited_docs = list(set(citations))  # Unique doc IDs
        
        return {
            "has_citations": has_citations,
            "citation_count": len(citations),
            "cited_docs": cited_docs,
            "valid": has_citations  # Must have at least one citation
        }
    
    async def enforce_citation_policy(
        self,
        content: str,
        evidence_refs: List[EvidenceRef],
        case_id: Optional[int] = None,
        draft_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Enforce mandatory citation policy (governance gate)
        
        Returns:
            {
                "allowed": bool,
                "reason": str,
                "validation_result": dict
            }
        """
        # Check if evidence refs are empty
        if not evidence_refs:
            await log_event(
                track="governance",
                event_type="policy_trigger",
                ollama_model="policy_engine",
                payload={
                    "policy": "mandatory_citations",
                    "violation": "no_evidence_retrieved",
                    "action": "block_write_back"
                },
                case_id=case_id,
                draft_id=draft_id,
                risk_level="high"
            )
            
            return {
                "allowed": False,
                "reason": "No evidence retrieved. RAG retrieval returned empty results. Cannot proceed without evidence base.",
                "validation_result": {"has_citations": False, "citation_count": 0, "cited_docs": []}
            }
        
        # Validate citations in content
        validation = await self.validate_citations(content)
        
        if not validation["valid"]:
            await log_event(
                track="governance",
                event_type="policy_trigger",
                ollama_model="policy_engine",
                payload={
                    "policy": "mandatory_citations",
                    "violation": "missing_citation_marks",
                    "action": "block_write_back",
                    "evidence_available": [ref.doc_id for ref in evidence_refs]
                },
                case_id=case_id,
                draft_id=draft_id,
                risk_level="high"
            )
            
            return {
                "allowed": False,
                "reason": f"Draft missing citation marks. Found evidence: {', '.join([r.doc_id for r in evidence_refs])}, but no [DOC:...] citations in content.",
                "validation_result": validation
            }
        
        # Policy passed
        return {
            "allowed": True,
            "reason": "Citation policy satisfied",
            "validation_result": validation
        }


# Singleton instance
rag_system = RAGSystem()


def get_rag() -> RAGSystem:
    """Get RAG system instance"""
    return rag_system
