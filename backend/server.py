from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import spacy
import httpx
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from enum import Enum
import uuid
from datetime import datetime
import io
from docx import Document
from docx.shared import Inches
import tempfile

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Load spaCy model (with error handling)
nlp = None
try:
    nlp = spacy.load("fr_core_news_lg")
    print("✅ spaCy French model loaded successfully")
except IOError:
    print("⚠️ spaCy French model not found. NER mode will be disabled.")

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

# Services
class RegexService:
    def __init__(self):
        # French phone patterns
        self.phone_patterns = [
            r'\b0[1-9](?:[.\-\s]?\d{2}){4}\b',  # 06.12.34.56.78
            r'\+33[1-9](?:[.\-\s]?\d{2}){4}\b', # +33 6 12 34 56 78
        ]
        
        # Email pattern
        self.email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        
        # SIRET pattern (14 digits)
        self.siret_pattern = r'\b\d{14}\b'
        
        # French SSN pattern (13 digits)
        self.ssn_pattern = r'\b[12]\d{12}\b'
        
        # French address patterns
        self.address_patterns = [
            r'\b\d+\s+(?:rue|avenue|boulevard|place|impasse|allée|chemin|route)\s+[A-Za-z\s]+\b',
            r'\b\d{5}\s+[A-Z][a-zA-Z\s-]+\b'  # Code postal + ville
        ]
        
        # Legal references
        self.legal_patterns = [
            r'\bRG\s+\d+/\d+\b',
            r'\bdossier\s+n°?\s*\d+[-/]\d+\b',
            r'\barticle\s+\d+(?:-\d+)?\b'
        ]

    def luhn_check(self, number: str) -> bool:
        """Validate SIRET using Luhn algorithm"""
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
                replacement="[email.anonymise@exemple.fr]",
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
                    confidence=round(ent._.confidence if hasattr(ent._, 'confidence') else 0.9, 2),
                    replacement=f"Personne {chr(64 + self.person_counter)}",
                    positions=[Position(start=ent.start_char, end=ent.end_char)]
                ))
                self.person_counter += 1
            
            elif ent.label_ == "ORG":  # Organization
                entities.append(Entity(
                    text=ent.text,
                    type=EntityType.ORGANIZATION,
                    source=EntitySource.NER,
                    confidence=round(ent._.confidence if hasattr(ent._, 'confidence') else 0.85, 2),
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
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.config.url}/api/tags", timeout=3.0)
                return response.status_code == 200
        except:
            return False
    
    async def get_available_models(self) -> List[str]:
        """Get installed models"""
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
        # This will be implemented when Ollama is available
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
    
    # Always run REGEX
    regex_entities = regex_service.extract_entities(request.content)
    all_entities.extend(regex_entities)
    
    # Run NER if Advanced mode and spaCy available
    if request.mode == ProcessingMode.ADVANCED and nlp:
        ner_entities = ner_service.extract_entities(request.content)
        all_entities.extend(ner_entities)
    
    # Ollama mode (placeholder for now)
    if request.mode == ProcessingMode.OLLAMA:
        # Will implement when Ollama integration is ready
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
    original_content: str,
    filename: str = "document_anonymise.docx"
):
    """Generate anonymized DOCX document"""
    try:
        # Create new document
        doc = Document()
        
        # Apply anonymization
        anonymized_content = DocumentProcessor.apply_anonymization(original_content, entities)
        
        # Add content to document
        doc.add_paragraph(anonymized_content)
        
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
        raise HTTPException(status_code=500, detail=f"Error generating document: {str(e)}")

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()