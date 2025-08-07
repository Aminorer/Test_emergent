#!/usr/bin/env python3
"""
Backend API Tests for Anonymiseur Juridique RGPD v3.0
Tests all API endpoints with French legal document sample
"""

import requests
import json
import sys
from datetime import datetime

class AnonymiseurAPITester:
    def __init__(self, base_url="https://3520f254-452f-4e2a-90b1-b48f00576f05.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        
        # French legal document sample for testing
        self.test_document = """Monsieur Jean DUPONT, domicilié au 123 rue de la Paix, 75001 Paris, joignable au 06.12.34.56.78 ou par email jean.dupont@cabinet-martin.fr, travaille pour le Cabinet Juridique Martin. Son numéro SIRET est 12345678901234. Le dossier RG 24/12345 concerne cette affaire juridique."""

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED")
        
        if details:
            print(f"   Details: {details}")
        print()

    def test_health_endpoint(self):
        """Test GET /api/health"""
        try:
            response = requests.get(f"{self.api_url}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                expected_keys = ['status', 'spacy_available', 'ollama_available']
                
                if all(key in data for key in expected_keys):
                    details = f"Status: {data['status']}, SpaCy: {data['spacy_available']}, Ollama: {data['ollama_available']}"
                    self.log_test("Health Check", True, details)
                    return data
                else:
                    self.log_test("Health Check", False, f"Missing keys in response: {data}")
                    return None
            else:
                self.log_test("Health Check", False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
            return None

    def test_process_standard_mode(self):
        """Test POST /api/process with STANDARD mode"""
        try:
            payload = {
                "content": self.test_document,
                "filename": "test_document.txt",
                "mode": "standard"
            }
            
            response = requests.post(
                f"{self.api_url}/process", 
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                expected_keys = ['entities', 'processing_time', 'mode_used', 'total_occurrences', 'spacy_available', 'ollama_available']
                
                if all(key in data for key in expected_keys):
                    entities = data['entities']
                    entity_types = [e['type'] for e in entities]
                    
                    # Check for expected entity types in STANDARD mode
                    expected_types = ['phone', 'email', 'address', 'legal']
                    found_types = [t for t in expected_types if t in entity_types]
                    
                    details = f"Found {len(entities)} entities, Types: {found_types}, Time: {data['processing_time']:.2f}s"
                    self.log_test("Process Document (STANDARD)", True, details)
                    return data
                else:
                    self.log_test("Process Document (STANDARD)", False, f"Missing keys: {data}")
                    return None
            else:
                self.log_test("Process Document (STANDARD)", False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Process Document (STANDARD)", False, f"Exception: {str(e)}")
            return None

    def test_process_advanced_mode(self):
        """Test POST /api/process with ADVANCED mode"""
        try:
            payload = {
                "content": self.test_document,
                "filename": "test_document.txt",
                "mode": "advanced"
            }
            
            response = requests.post(
                f"{self.api_url}/process", 
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                entities = data['entities']
                entity_types = [e['type'] for e in entities]
                entity_sources = [e['source'] for e in entities]
                
                # Check for NER entities (person, organization)
                ner_entities = [e for e in entities if e['source'] == 'NER']
                regex_entities = [e for e in entities if e['source'] == 'REGEX']
                
                details = f"Total: {len(entities)}, REGEX: {len(regex_entities)}, NER: {len(ner_entities)}, Time: {data['processing_time']:.2f}s"
                self.log_test("Process Document (ADVANCED)", True, details)
                return data
            else:
                self.log_test("Process Document (ADVANCED)", False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Process Document (ADVANCED)", False, f"Exception: {str(e)}")
            return None

    def test_ollama_connection(self):
        """Test POST /api/test-ollama"""
        try:
            payload = {
                "url": "http://localhost:11434",
                "model": "llama3.2:3b",
                "custom_prompt": None,
                "timeout": 30
            }
            
            response = requests.post(
                f"{self.api_url}/test-ollama", 
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                expected_keys = ['connected', 'models', 'config']
                
                if all(key in data for key in expected_keys):
                    details = f"Connected: {data['connected']}, Models: {len(data['models'])}"
                    self.log_test("Ollama Connection Test", True, details)
                    return data
                else:
                    self.log_test("Ollama Connection Test", False, f"Missing keys: {data}")
                    return None
            else:
                self.log_test("Ollama Connection Test", False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Ollama Connection Test", False, f"Exception: {str(e)}")
            return None

    def test_generate_document(self):
        """Test POST /api/generate-document"""
        try:
            # First get entities from processing
            process_result = self.test_process_standard_mode()
            if not process_result:
                self.log_test("Generate Document", False, "Could not get entities for document generation")
                return None
            
            # Prepare form data
            form_data = {
                "original_content": self.test_document,
                "filename": "test_anonymized.docx"
            }
            
            # Send entities as JSON in the body and other params as form data
            response = requests.post(
                f"{self.api_url}/generate-document", 
                json=process_result['entities'],  # Send entities as JSON body
                params=form_data,  # Send other params as query parameters
                timeout=30
            )
            
            if response.status_code == 200:
                # Check if response is a DOCX file
                content_type = response.headers.get('content-type', '')
                content_length = len(response.content)
                
                if 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' in content_type:
                    details = f"DOCX generated successfully, Size: {content_length} bytes"
                    self.log_test("Generate Document", True, details)
                    return True
                else:
                    details = f"Unexpected content type: {content_type}"
                    self.log_test("Generate Document", False, details)
                    return None
            else:
                self.log_test("Generate Document", False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Generate Document", False, f"Exception: {str(e)}")
            return None

    def test_root_endpoint(self):
        """Test GET /api/ root endpoint"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'message' in data and 'Anonymiseur Juridique RGPD v3.0' in data['message']:
                    self.log_test("Root Endpoint", True, f"Message: {data['message']}")
                    return data
                else:
                    self.log_test("Root Endpoint", False, f"Unexpected response: {data}")
                    return None
            else:
                self.log_test("Root Endpoint", False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Root Endpoint", False, f"Exception: {str(e)}")
            return None

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Anonymiseur Juridique RGPD v3.0 API Tests")
        print(f"📍 Testing API at: {self.api_url}")
        print(f"📄 Test document: {self.test_document[:50]}...")
        print("=" * 80)
        
        # Test all endpoints
        self.test_root_endpoint()
        health_data = self.test_health_endpoint()
        self.test_process_standard_mode()
        self.test_process_advanced_mode()
        self.test_ollama_connection()
        self.test_generate_document()
        
        # Print summary
        print("=" * 80)
        print(f"📊 TEST SUMMARY")
        print(f"✅ Tests Passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}/{self.tests_run}")
        
        if health_data:
            print(f"🔧 System Status:")
            print(f"   - SpaCy Available: {health_data.get('spacy_available', 'Unknown')}")
            print(f"   - Ollama Available: {health_data.get('ollama_available', 'Unknown')}")
        
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    tester = AnonymiseurAPITester()
    success = tester.run_all_tests()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())