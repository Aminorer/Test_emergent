from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import logging
import re
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Union
from enum import Enum
import uuid
from datetime import datetime
import io
from docx import Document
import tempfile
import json

# Try to load spaCy
nlp = None
try:
    import spacy
    nlp = spacy.load("fr_core_news_lg")
    print("✅ spaCy French model loaded successfully")
except Exception as e:
    print(f"⚠️ spaCy French model not found: {e}")
    nlp = None

# Try to load httpx for Ollama
httpx = None
try:
    import httpx
    print("✅ httpx loaded for Ollama integration")
except ImportError:
    print("⚠️ httpx not found - Ollama integration disabled")

# Create the main app
app = FastAPI(title="Anonymiseur Juridique RGPD v3.0")
api_router = APIRouter(prefix="/api")

# Models
class ProcessingMode(str, Enum):
    STANDARD = "standard"
    ADVANCED = "advanced" 
    OLLAMA = "ollama"

class EntityType(str, Enum):
    PHONE = "phone"
    EMAIL = "email"
    SIRET = "siret"
    SSN = "ssn"
    ADDRESS = "address"
    LEGAL = "legal"
    PERSON = "person"
    ORGANIZATION = "organization"

class EntitySource(str, Enum):
    REGEX = "REGEX"
    NER = "NER"
    OLLAMA = "OLLAMA"
    MANUAL = "MANUAL"

class Position(BaseModel):
    start: int
    end: int

class Entity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    type: EntityType
    source: EntitySource
    confidence: float
    replacement: str
    positions: List[Position]
    selected: bool = True

class OllamaConfig(BaseModel):
    url: str = "http://localhost:11434"
    model: str = "llama3.2:3b"
    custom_prompt: Optional[str] = None
    timeout: int = 30

class DocumentRequest(BaseModel):
    content: str
    filename: str
    mode: ProcessingMode
    ollama_config: Optional[OllamaConfig] = None

class ProcessingResponse(BaseModel):
    entities: List[Entity]
    processing_time: float
    mode_used: ProcessingMode
    total_occurrences: int
    spacy_available: bool
    ollama_available: bool

class EntityUpdateRequest(BaseModel):
    id: str
    replacement: str
    selected: bool

class GroupCreateRequest(BaseModel):
    entity_ids: List[str]
    group_replacement: str

# Services
class RegexService:
    def __init__(self):
        # French phone patterns
        self.phone_patterns = [
            r'\b0[1-9](?:[.\-\s]?\d{2}){4}\b',  # 06.12.34.56.78
            r'\+33[.\-\s]?[1-9](?:[.\-\s]?\d{2}){4}\b', # +33 6 12 34 56 78
        ]
        
        # Email pattern
        self.email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        
        # SIRET pattern (14 digits)
        self.siret_pattern = r'\b\d{14}\b'
        
        # French SSN pattern (15 digits with spaces)
        self.ssn_pattern = r'\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b'
        
        # French address patterns
        self.address_patterns = [
            r'\b\d+\s+(?:rue|avenue|boulevard|place|impasse|allée|chemin|route|bis|ter)\s+[A-Za-z\s\-\']+\b',
            r'\b\d{5}\s+[A-Z][a-zA-Z\s\-\']+\b'  # Code postal + ville
        ]
        
        # Legal references
        self.legal_patterns = [
            r'\bRG\s+\d+/\d+\b',
            r'\bdossier\s+(?:n°?|numéro)\s*\d+[-/]\d+\b',
            r'\barticle\s+\d+(?:-\d+)?\b'
        ]

    def luhn_check(self, number: str) -> bool:
        """Validate SIRET using Luhn algorithm"""
        try:
            def luhn_checksum(card_num):
                def digits_of(n):
                    return [int(d) for d in str(n)]
                digits = digits_of(card_num)
                odd_digits = digits[-1::-2]
                even_digits = digits[-2::-2]
                checksum = sum(odd_digits)
                for d in even_digits:
                    checksum += sum(digits_of(d*2))
                return checksum % 10
            return luhn_checksum(number) == 0
        except:
            return False

    def extract_entities(self, text: str) -> List[Entity]:
        entities = []
        
        # Phone numbers
        for pattern in self.phone_patterns:
            for match in re.finditer(pattern, text):
                entities.append(Entity(
                    text=match.group(),
                    type=EntityType.PHONE,
                    source=EntitySource.REGEX,
                    confidence=1.0,
                    replacement=self._generate_phone_replacement(),
                    positions=[Position(start=match.start(), end=match.end())]
                ))
        
        # Emails
        for match in re.finditer(self.email_pattern, text):
            entities.append(Entity(
                text=match.group(),
                type=EntityType.EMAIL,
                source=EntitySource.REGEX,
                confidence=1.0,
                replacement="email.anonymise@exemple.fr",
                positions=[Position(start=match.start(), end=match.end())]
            ))
        
        # SIRET with Luhn validation
        for match in re.finditer(self.siret_pattern, text):
            siret = match.group()
            if self.luhn_check(siret):
                entities.append(Entity(
                    text=siret,
                    type=EntityType.SIRET,
                    source=EntitySource.REGEX,
                    confidence=1.0,
                    replacement="[SIRET Anonymisé]",
                    positions=[Position(start=match.start(), end=match.end())]
                ))
        
        # SSN
        for match in re.finditer(self.ssn_pattern, text):
            entities.append(Entity(
                text=match.group(),
                type=EntityType.SSN,
                source=EntitySource.REGEX,
                confidence=1.0,
                replacement="[N° Sécurité Sociale Anonymisé]",
                positions=[Position(start=match.start(), end=match.end())]
            ))
        
        # Addresses
        for pattern in self.address_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                entities.append(Entity(
                    text=match.group(),
                    type=EntityType.ADDRESS,
                    source=EntitySource.REGEX,
                    confidence=1.0,
                    replacement="[Adresse Anonymisée]",
                    positions=[Position(start=match.start(), end=match.end())]
                ))
        
        # Legal references
        for pattern in self.legal_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                entities.append(Entity(
                    text=match.group(),
                    type=EntityType.LEGAL,
                    source=EntitySource.REGEX,
                    confidence=1.0,
                    replacement="[Référence Anonymisée]",
                    positions=[Position(start=match.start(), end=match.end())]
                ))
        
        return entities
    
    def _generate_phone_replacement(self):
        return "06 XX XX XX XX"

class NERService:
    def __init__(self):
        self.nlp = nlp
        self.person_counter = 1
        self.org_counter = 1
    
    def extract_entities(self, text: str) -> List[Entity]:
        if not self.nlp:
            return []
        
        entities = []
        doc = self.nlp(text)
        
        for ent in doc.ents:
            if ent.label_ == "PER":  # Person
                entities.append(Entity(
                    text=ent.text,
                    type=EntityType.PERSON,
                    source=EntitySource.NER,
                    confidence=0.9,
                    replacement=f"Personne {chr(64 + self.person_counter)}",
                    positions=[Position(start=ent.start_char, end=ent.end_char)]
                ))
                self.person_counter += 1
            
            elif ent.label_ == "ORG":  # Organization
                entities.append(Entity(
                    text=ent.text,
                    type=EntityType.ORGANIZATION,
                    source=EntitySource.NER,
                    confidence=0.85,
                    replacement=f"Organisation {chr(64 + self.org_counter)}",
                    positions=[Position(start=ent.start_char, end=ent.end_char)]
                ))
                self.org_counter += 1
        
        return entities

class OllamaService:
    def __init__(self, config: OllamaConfig):
        self.config = config
    
    async def check_availability(self) -> bool:
        """Test Ollama connection"""
        if not httpx:
            return False
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.config.url}/api/tags", timeout=3.0)
                return response.status_code == 200
        except:
            return False
    
    async def get_available_models(self) -> List[str]:
        """Get installed models"""
        if not httpx:
            return []
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.config.url}/api/tags", timeout=5.0)
                if response.status_code == 200:
                    data = response.json()
                    return [model["name"] for model in data.get("models", [])]
        except:
            pass
        return []
    
    async def extract_entities(self, text: str) -> List[Entity]:
        """Extract entities using Ollama (placeholder for now)"""
        return []

# Document processor
class DocumentProcessor:
    @staticmethod
    def apply_anonymization(content: str, entities: List[Entity]) -> str:
        """Apply entity replacements to text content"""
        # Sort by position (start) in descending order to avoid position shifts
        sorted_entities = sorted(
            [e for e in entities if e.selected], 
            key=lambda x: x.positions[0].start, 
            reverse=True
        )
        
        result = content
        for entity in sorted_entities:
            pos = entity.positions[0]
            result = result[:pos.start] + entity.replacement + result[pos.end:]
        
        return result

# Initialize services
regex_service = RegexService()
ner_service = NERService()

# API Endpoints
@api_router.get("/")
async def root():
    return {"message": "Anonymiseur Juridique RGPD v3.0"}

@api_router.get("/health")
async def health_check():
    """Check system status"""
    return {
        "status": "healthy",
        "spacy_available": nlp is not None,
        "ollama_available": False  # Will be updated when testing Ollama
    }

@api_router.post("/process", response_model=ProcessingResponse)
async def process_document(request: DocumentRequest):
    """Process document with selected mode"""
    start_time = datetime.now()
    
    all_entities = []
    
    print(f"🔄 Processing document in {request.mode} mode...")
    
    # Always run REGEX
    regex_entities = regex_service.extract_entities(request.content)
    all_entities.extend(regex_entities)
    print(f"📊 REGEX found {len(regex_entities)} entities")
    
    # Run NER if Advanced mode and spaCy available
    if request.mode == ProcessingMode.ADVANCED and nlp:
        ner_entities = ner_service.extract_entities(request.content)
        all_entities.extend(ner_entities)
        print(f"📊 NER found {len(ner_entities)} entities")
    
    # Ollama mode (placeholder for now)
    if request.mode == ProcessingMode.OLLAMA:
        pass
    
    # Remove duplicates based on text and position
    unique_entities = []
    seen = set()
    for entity in all_entities:
        key = (entity.text, entity.positions[0].start, entity.positions[0].end)
        if key not in seen:
            seen.add(key)
            unique_entities.append(entity)
    
    processing_time = (datetime.now() - start_time).total_seconds()
    
    print(f"✅ Processing completed: {len(unique_entities)} entities in {processing_time:.2f}s")
    
    return ProcessingResponse(
        entities=unique_entities,
        processing_time=processing_time,
        mode_used=request.mode,
        total_occurrences=len(unique_entities),
        spacy_available=nlp is not None,
        ollama_available=False
    )

@api_router.post("/test-ollama")
async def test_ollama_connection(config: OllamaConfig):
    """Test Ollama connection"""
    service = OllamaService(config)
    available = await service.check_availability()
    models = await service.get_available_models() if available else []
    
    return {
        "connected": available,
        "models": models,
        "config": config.dict()
    }

@api_router.get("/ollama-models")
async def get_ollama_models(url: str = "http://localhost:11434"):
    """Get available Ollama models"""
    config = OllamaConfig(url=url)
    service = OllamaService(config)
    models = await service.get_available_models()
    return {"models": models}

@api_router.post("/generate-document")
async def generate_anonymized_document(
    entities: List[Entity],
    original_content: str = Form(...),
    filename: str = Form("document_anonymise.docx")
):
    """Generate anonymized DOCX document"""
    try:
        # Create new document
        doc = Document()
        
        # Apply anonymization
        anonymized_content = DocumentProcessor.apply_anonymization(original_content, entities)
        
        # Add content to document
        paragraphs = anonymized_content.split('\n')
        for paragraph in paragraphs:
            if paragraph.strip():
                doc.add_paragraph(paragraph)
        
        # Save to memory
        doc_io = io.BytesIO()
        doc.save(doc_io)
        doc_io.seek(0)
        
        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(doc_io.getvalue()),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    except Exception as e:
        print(f"❌ Error generating document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating document: {str(e)}")

@api_router.put("/entity/{entity_id}")
async def update_entity(entity_id: str, update: EntityUpdateRequest):
    """Update entity replacement and selection"""
    # In a real app, you'd store entities in a database
    return {"message": f"Entity {entity_id} updated", "entity": update.dict()}

@api_router.post("/entities/group")
async def create_entity_group(request: GroupCreateRequest):
    """Create a group from multiple entities"""
    return {
        "message": f"Group created for {len(request.entity_ids)} entities",
        "group_replacement": request.group_replacement
    }

@api_router.post("/entity/manual")
async def add_manual_entity(
    text: str = Form(...),
    entity_type: EntityType = Form(...),
    replacement: str = Form(...),
    start_pos: int = Form(...),
    end_pos: int = Form(...)
):
    """Add manual entity"""
    entity = Entity(
        text=text,
        type=entity_type,
        source=EntitySource.MANUAL,
        confidence=1.0,
        replacement=replacement,
        positions=[Position(start=start_pos, end=end_pos)]
    )
    return {"message": "Manual entity added", "entity": entity.dict()}

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Anonymiseur Juridique RGPD v3.0 Backend")
    print("📍 Backend URL: http://localhost:8001")
    print(f"🧠 spaCy Available: {nlp is not None}")
    print(f"🔗 Ollama Support: {httpx is not None}")
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)