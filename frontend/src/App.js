import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './App.css';

// CORRECTED: Configuration backend - Port cohérent avec le serveur
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
const API = `${BACKEND_URL}/api`;

function App() {
  const [currentMode, setCurrentMode] = useState('standard');
  const [document, setDocument] = useState(null);
  const [entities, setEntities] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState('upload');
  const [systemStatus, setSystemStatus] = useState({ spacy_available: false, ollama_available: false });
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedEntities, setSelectedEntities] = useState([]);
  const [editingEntity, setEditingEntity] = useState(null);

  // CORRECTED: Check system status on load avec timeout réduit
  useEffect(() => {
    const checkStatus = async () => {
      try {
        console.log('🔍 Checking backend status at:', API);
        const response = await axios.get(`${API}/health`, {
          timeout: 10000 // 10 secondes timeout
        });
        console.log('✅ Backend Response:', response.data);
        setSystemStatus(response.data);
      } catch (error) {
        console.error('❌ Backend connection failed:', error);
        console.error('❌ Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          code: error.code
        });
        setSystemStatus({ spacy_available: false, ollama_available: false });
        
        // Show user-friendly error
        if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
          alert('⚠️ Impossible de se connecter au backend.\nVérifiez que le serveur backend tourne sur http://localhost:8080');
        }
      }
    };
    checkStatus();
  }, []);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    console.log('📄 File selected:', file.name, file.size, 'bytes', file.type);
    
    // Validation du fichier
    if (file.size > 50 * 1024 * 1024) { // 50MB
      alert('❌ Fichier trop volumineux. Taille maximum : 50MB');
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const content = event.target.result;
      
      // Validation du contenu
      if (!content || content.trim().length === 0) {
        alert('❌ Fichier vide ou illisible');
        return;
      }
      
      console.log('📝 File content length:', content.length);
      console.log('📝 Content preview:', content.substring(0, 200));
      
      setDocument({ filename: file.name, content });
      setProcessing(true);
      setEntities([]); // Reset entities
      
      try {
        console.log(`🔄 Sending request to: ${API}/process`);
        console.log(`🔄 Processing mode: ${currentMode}`);
        
        const payload = {
          content: content.trim(),
          filename: file.name,
          mode: currentMode
        };
        console.log('📤 Request payload size:', JSON.stringify(payload).length, 'chars');
        
        const response = await axios.post(`${API}/process`, payload, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 60000 // CORRECTED: 60 secondes timeout pour traitement long
        });
        
        console.log('✅ Processing response:', response.data);
        const responseEntities = response.data.entities || [];
        setEntities(responseEntities);
        
        // CORRECTED: Messages plus informatifs
        if (responseEntities.length === 0) {
          alert(`📊 Analyse terminée !\n\n` +
                `❌ Aucune entité détectée dans le document\n` +
                `Mode utilisé: ${response.data.mode_used}\n` +
                `Temps de traitement: ${response.data.processing_time?.toFixed(2)}s\n\n` +
                `💡 Assurez-vous que votre document contient des données personnelles françaises :\n` +
                `• Téléphones (06.12.34.56.78)\n` +
                `• Emails (nom@domaine.fr)\n` +
                `• Adresses (123 rue de la Paix, 75001 Paris)\n` +
                `• SIRET (14 chiffres)\n` +
                `• Références juridiques (RG 24/12345)`);
        } else {
          alert(`✅ Document traité avec succès !\n\n` +
                `📊 ${response.data.total_occurrences} entités détectées :\n` +
                `• ${responseEntities.filter(e => e.source === 'REGEX').length} par REGEX\n` +
                `• ${responseEntities.filter(e => e.source === 'NER').length} par NER\n` +
                `⏱️ Temps de traitement: ${response.data.processing_time?.toFixed(2)}s`);
          setCurrentPage('dashboard');
        }
      } catch (error) {
        console.error('❌ Processing error:', error);
        console.error('❌ Error response:', error.response?.data);
        console.error('❌ Error status:', error.response?.status);
        
        let errorMessage = 'Erreur inconnue';
        
        if (error.code === 'ECONNABORTED') {
          errorMessage = 'Timeout - Le traitement a pris trop de temps (>60s).\nEssayez avec un document plus petit.';
        } else if (error.response?.status === 500) {
          errorMessage = `Erreur serveur: ${error.response?.data?.detail || 'Erreur interne'}`;
        } else if (error.response?.status === 422) {
          errorMessage = 'Format de données invalide. Vérifiez le contenu du fichier.';
        } else if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
          errorMessage = 'Impossible de se connecter au backend.\nVérifiez que le serveur tourne sur http://localhost:8080';
        } else if (error.response?.data?.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        alert(`❌ Erreur lors du traitement :\n\n${errorMessage}\n\n🔧 Vérifications :\n• Backend actif sur localhost:8080\n• Fichier lisible et contenu valide\n• Connexion réseau stable`);
      } finally {
        setProcessing(false);
      }
    };
    
    reader.onerror = () => {
      console.error('❌ File reading error');
      alert('❌ Erreur lors de la lecture du fichier.\nVérifiez que le fichier n\'est pas corrompu.');
      setProcessing(false);
    };
    
    reader.readAsText(file, 'UTF-8');
  }, [currentMode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
    onDropRejected: (fileRejections) => {
      const rejectedFile = fileRejections[0];
      const errors = rejectedFile.errors.map(e => e.message).join('\n');
      alert(`❌ Fichier rejeté :\n\n${errors}\n\nFormats acceptés: TXT, PDF, DOCX\nTaille max: 50MB`);
    }
  });

  const generateDocument = async () => {
    if (!entities || entities.length === 0) {
      alert('❌ Aucune entité à traiter pour la génération du document');
      return;
    }

    const selectedCount = entities.filter(e => e.selected).length;
    if (selectedCount === 0) {
      alert('❌ Sélectionnez au moins une entité à anonymiser');
      return;
    }

    try {
      console.log('📄 Generating document with entities:', entities.filter(e => e.selected));
      
      const payload = {
        entities: entities,
        original_content: document.content,
        filename: `${document.filename.split('.')[0]}_anonymise.docx`
      };
      
      console.log('📤 Document generation request...');
      
      const response = await axios.post(`${API}/generate-document`, payload, {
        responseType: 'blob',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      
      console.log('✅ Document generated, size:', response.data.size);
      
      // CORRECTED: Création du lien de téléchargement améliorée
      const url = window.URL.createObjectURL(new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${document.filename.split('.')[0]}_anonymise.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      alert(`✅ Document anonymisé généré avec succès !\n\n📄 Fichier: ${document.filename.split('.')[0]}_anonymise.docx\n📊 ${selectedCount} entités anonymisées`);
    } catch (error) {
      console.error('❌ Document generation error:', error);
      console.error('❌ Error response:', error.response?.data);
      
      let errorMessage = 'Erreur lors de la génération du document';
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Timeout lors de la génération (>30s)';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`❌ ${errorMessage}\n\n🔧 Essayez de :\n• Réduire le nombre d'entités sélectionnées\n• Vérifier la connexion backend`);
    }
  };

  const toggleEntity = (entityId) => {
    setEntities(entities.map(entity => 
      entity.id === entityId 
        ? { ...entity, selected: !entity.selected }
        : entity
    ));
  };

  const updateEntityReplacement = (entityId, newReplacement) => {
    if (!newReplacement || newReplacement.trim() === '') {
      alert('❌ Le remplacement ne peut pas être vide');
      return;
    }
    
    setEntities(entities.map(entity => 
      entity.id === entityId 
        ? { ...entity, replacement: newReplacement.trim() }
        : entity
    ));
  };

  const deleteEntity = (entityId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette entité ?')) {
      setEntities(entities.filter(entity => entity.id !== entityId));
      // Remove from selection if selected
      setSelectedEntities(selectedEntities.filter(id => id !== entityId));
    }
  };

  const createGroup = () => {
    if (selectedEntities.length < 2) {
      alert('❌ Sélectionnez au moins 2 entités pour créer un groupe');
      return;
    }
    
    const groupReplacement = prompt('Nom du groupe (remplacement commun) :');
    if (groupReplacement && groupReplacement.trim()) {
      setEntities(entities.map(entity => 
        selectedEntities.includes(entity.id)
          ? { ...entity, replacement: groupReplacement.trim() }
          : entity
      ));
      setSelectedEntities([]);
      alert(`✅ Groupe "${groupReplacement}" créé avec ${selectedEntities.length} entités`);
    }
  };

  // CORRECTED: Filter entities with better search
  const filteredEntities = entities.filter(entity => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = entity.text.toLowerCase().includes(searchLower) ||
                         entity.replacement.toLowerCase().includes(searchLower) ||
                         entity.type.toLowerCase().includes(searchLower);
    const matchesFilter = sourceFilter === 'all' || entity.source === sourceFilter;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: entities.length,
    regex: entities.filter(e => e.source === 'REGEX').length,
    ner: entities.filter(e => e.source === 'NER').length,
    ollama: entities.filter(e => e.source === 'OLLAMA').length,
    manual: entities.filter(e => e.source === 'MANUAL').length,
    selected: entities.filter(e => e.selected).length
  };

  if (currentPage === 'upload') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">🛡️</div>
              <h1 className="text-4xl font-bold text-gray-900">
                Anonymiseur Juridique RGPD v3.0
              </h1>
            </div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Anonymisation sécurisée de documents juridiques avec 3 modes de traitement. 
              100% local et conforme RGPD.
            </p>
            
            {/* CORRECTED: System Status amélioré */}
            <div className="flex justify-center gap-4 text-sm">
              <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${
                systemStatus.spacy_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${systemStatus.spacy_available ? 'bg-green-500' : 'bg-red-500'}`}></div>
                spaCy {systemStatus.spacy_available ? 'Disponible ✅' : 'Indisponible ❌'}
              </div>
              <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${
                systemStatus.ollama_available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}>
                <div className={`w-2 h-2 rounded-full ${systemStatus.ollama_available ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                Ollama {systemStatus.ollama_available ? 'Disponible ✅' : 'Non disponible ❌'}
              </div>
            </div>
            
            {/* Debug Info - Only in development */}
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
                🔧 Debug: Backend URL = {BACKEND_URL} | API = {API}
              </div>
            )}
          </div>

          {/* Mode Selection */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 text-center">
              Choisissez votre mode de traitement
            </h2>
            
            <div className="grid gap-4">
              {/* Standard Mode */}
              <div 
                className={`cursor-pointer p-6 rounded-lg border-2 transition-all ${
                  currentMode === 'standard' 
                    ? 'border-blue-500 bg-blue-50 shadow-lg' 
                    : 'border-gray-200 bg-white hover:bg-gray-50 hover:shadow-md'
                }`}
                onClick={() => setCurrentMode('standard')}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${
                    currentMode === 'standard' ? 'bg-blue-500 text-white' : 'bg-gray-100'
                  }`}>
                    ⚡
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">Standard - REGEX</h3>
                    <p className="text-gray-600 mb-3">Détection par expressions régulières uniquement</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">📞 Téléphones</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">📧 Emails</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">🏭 SIRET</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">🆔 N° Sécu</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">🏠 Adresses</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">⚖️ Références juridiques</span>
                    </div>
                    <div className="text-sm text-gray-500">⏱️ 2-5 secondes • Toujours disponible</div>
                  </div>
                </div>
              </div>

              {/* Advanced Mode */}
              <div 
                className={`cursor-pointer p-6 rounded-lg border-2 transition-all ${
                  currentMode === 'advanced' 
                    ? 'border-blue-500 bg-blue-50 shadow-lg' 
                    : systemStatus.spacy_available 
                      ? 'border-gray-200 bg-white hover:bg-gray-50 hover:shadow-md'
                      : 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                }`}
                onClick={() => systemStatus.spacy_available && setCurrentMode('advanced')}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${
                    currentMode === 'advanced' ? 'bg-blue-500 text-white' : 'bg-gray-100'
                  }`}>
                    🧠
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">
                      Approfondi - NER
                      {!systemStatus.spacy_available && <span className="text-amber-500 ml-2">⚠️</span>}
                    </h3>
                    <p className="text-gray-600 mb-3">REGEX + Reconnaissance d'entités nommées (spaCy)</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-sm">✅ Toutes détections REGEX</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-sm">👤 Personnes (NER)</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-sm">🏢 Organisations (NER)</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-sm">🎯 Scores confiance</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      ⏱️ 5-15 secondes • 
                      {systemStatus.spacy_available ? (
                        <span className="text-green-600"> spaCy français installé ✅</span>
                      ) : (
                        <span className="text-red-600"> Nécessite: pip install spacy && python -m spacy download fr_core_news_lg</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ollama Mode */}
              <div className="p-6 rounded-lg border-2 border-gray-200 bg-gray-100 opacity-50">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-gray-200">🚀</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">
                      Ollama Local - IA
                      <span className="text-amber-500 ml-2">⚠️ Non disponible</span>
                    </h3>
                    <p className="text-gray-600 mb-3">REGEX + Analyse sémantique par IA locale (Ollama)</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="px-2 py-1 bg-gray-200 rounded-md text-sm">🧠 Entités complexes</span>
                      <span className="px-2 py-1 bg-gray-200 rounded-md text-sm">🎯 Prompt personnalisable</span>
                      <span className="px-2 py-1 bg-gray-200 rounded-md text-sm">🏠 100% Local</span>
                    </div>
                    <div className="text-sm text-gray-500">⏱️ 10-30 secondes • Nécessite installation Ollama</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CORRECTED: Test Sample amélioré */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">🧪 Exemple de test</h3>
            <p className="text-sm text-yellow-700 mb-2">
              Vous pouvez tester avec ce contenu juridique français (copiez-le dans un fichier .txt) :
            </p>
            <div className="bg-white p-3 rounded border text-sm font-mono break-all">
              Monsieur Jean DUPONT, domicilié au 123 rue de la Paix, 75001 Paris, joignable au 06.12.34.56.78 ou par email jean.dupont@cabinet-martin.fr, travaille pour le Cabinet Juridique Martin. Son numéro SIRET est 12345678901234. Le dossier RG 24/12345 concerne cette affaire juridique.
            </div>
            <div className="text-xs text-yellow-600 mt-2 space-y-1">
              <div>💡 Ce texte contient : téléphone, email, adresse, SIRET, nom, organisation, référence juridique</div>
              <div>📊 Attendu : ~7-9 entités en mode Standard, ~9-11 en mode Approfondi</div>
            </div>
          </div>

          {/* Upload Zone */}
          <div className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors rounded-lg p-12">
            <div
              {...getRootProps()}
              className={`text-center space-y-4 cursor-pointer ${
                isDragActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
              }`}
            >
              <input {...getInputProps()} />
              <div className="text-6xl">{isDragActive ? '📥' : '📁'}</div>
              <div>
                <h3 className="text-xl font-semibold mb-2">
                  {isDragActive ? 
                    'Déposez votre document ici...' : 
                    'Déposez votre document juridique'
                  }
                </h3>
                <p className="text-gray-500">
                  Formats acceptés: PDF, DOCX, TXT • Limite: 50MB
                </p>
              </div>
              <button type="button" className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                📄 Sélectionner un fichier
              </button>
            </div>
          </div>

          {/* CORRECTED: Processing Status amélioré */}
          {processing && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-6">
              <div className="flex items-center gap-4">
                <div className="animate-spin text-2xl">🔄</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900">
                    Traitement en cours...
                  </h3>
                  <p className="text-blue-700">
                    Mode {currentMode} - Analyse avec {currentMode === 'standard' ? 'REGEX uniquement' : 'REGEX + spaCy NER'}
                  </p>
                  <p className="text-blue-600 text-sm mt-1">
                    {document?.filename} ({document?.content?.length} caractères)
                  </p>
                  <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                    <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                  </div>
                  <p className="text-xs text-blue-500 mt-1">Patience, cela peut prendre jusqu'à 60 secondes...</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Dashboard Page
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-blue-600 rounded text-white flex items-center justify-center font-bold">🛡️</div>
              <div>
                <h1 className="text-xl font-semibold">Anonymiseur RGPD v3.0</h1>
                <p className="text-sm text-gray-600">📄 {document?.filename} • Mode: {currentMode}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => {
                  setCurrentPage('upload');
                  setEntities([]);
                  setDocument(null);
                }}
              >
                📤 Nouveau document
              </button>
              <button 
                className={`px-4 py-2 rounded-lg transition-colors ${
                  stats.selected > 0 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                onClick={generateDocument}
                disabled={stats.selected === 0}
              >
                💾 Générer DOCX ({stats.selected}/{stats.total})
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.regex}</div>
              <div className="text-sm text-gray-600">REGEX</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.ner}</div>
              <div className="text-sm text-gray-600">NER</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.manual}</div>
              <div className="text-sm text-gray-600">Manuel</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.ollama}</div>
              <div className="text-sm text-gray-600">Ollama</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">{stats.selected}</div>
              <div className="text-sm text-gray-600">Sélectionnées</div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder="🔍 Rechercher une entité..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition-colors"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="all">Toutes sources ({entities.length})</option>
              <option value="REGEX">REGEX ({stats.regex})</option>
              <option value="NER">NER ({stats.ner})</option>
              <option value="OLLAMA">OLLAMA ({stats.ollama})</option>
              <option value="MANUAL">Manuelle ({stats.manual})</option>
            </select>
            <button
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => {
                const allSelected = entities.every(e => e.selected);
                setEntities(entities.map(e => ({ ...e, selected: !allSelected })));
              }}
            >
              {entities.every(e => e.selected) ? '☑️ Tout décocher' : '✅ Tout sélectionner'}
            </button>
            <button
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedEntities.length >= 2
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              onClick={createGroup}
              disabled={selectedEntities.length < 2}
            >
              👥 Grouper ({selectedEntities.length})
            </button>
          </div>
        </div>

        {/* Entities List */}
        <div className="space-y-3">
          {filteredEntities.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-4xl mb-4">😕</div>
              <p className="text-gray-600 text-lg mb-2">
                {entities.length === 0 
                  ? 'Aucune entité détectée dans ce document' 
                  : 'Aucune entité ne correspond à votre recherche'
                }
              </p>
              {entities.length === 0 && (
                <div className="mt-4 text-sm text-gray-500 space-y-1">
                  <div>💡 Assurez-vous que votre document contient des données personnelles françaises :</div>
                  <div>📞 Téléphones (06.12.34.56.78) • 📧 Emails • 🏠 Adresses complètes</div>
                  <div>🏭 SIRET (14 chiffres) • ⚖️ Références juridiques (RG 24/12345)</div>
                  <div className="mt-2 p-2 bg-yellow-50 rounded text-yellow-700">
                    Testez avec l'exemple fourni ci-dessus pour vérifier le fonctionnement
                  </div>
                </div>
              )}
            </div>
          ) : (
            filteredEntities.map((entity, index) => (
              <div key={entity.id} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-2">
                    <input
                      type="checkbox"
                      checked={entity.selected}
                      onChange={() => toggleEntity(entity.id)}
                      className="w-4 h-4"
                      title="Sélectionner pour anonymisation"
                    />
                    <input
                      type="checkbox"
                      checked={selectedEntities.includes(entity.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEntities([...selectedEntities, entity.id]);
                        } else {
                          setSelectedEntities(selectedEntities.filter(id => id !== entity.id));
                        }
                      }}
                      className="w-3 h-3"
                      title="Sélectionner pour grouper"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">
                        {entity.type === 'phone' && '📞'}
                        {entity.type === 'email' && '📧'}
                        {entity.type === 'address' && '🏠'}
                        {entity.type === 'person' && '👤'}
                        {entity.type === 'organization' && '🏢'}
                        {entity.type === 'siret' && '🏭'}
                        {entity.type === 'legal' && '⚖️'}
                        {entity.type === 'ssn' && '🆔'}
                      </span>
                      <span className="text-xs text-gray-500">#{index + 1}</span>
                      <span className={`px-2 py-1 text-xs rounded font-medium ${
                        entity.source === 'REGEX' ? 'bg-blue-100 text-blue-800' :
                        entity.source === 'NER' ? 'bg-green-100 text-green-800' :
                        entity.source === 'MANUAL' ? 'bg-orange-100 text-orange-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {entity.source}
                      </span>
                      {entity.confidence < 1 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          {Math.round(entity.confidence * 100)}%
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        pos: {entity.positions[0].start}-{entity.positions[0].end}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="font-medium text-gray-700">Texte original: </span>
                        <code className="bg-red-50 text-red-800 px-2 py-1 rounded border break-all">{entity.text}</code>
                      </div>
                      
                      <div className="text-sm">
                        <span className="font-medium text-gray-700">Remplacement: </span>
                        {editingEntity === entity.id ? (
                          <div className="inline-flex items-center gap-2">
                            <input
                              type="text"
                              defaultValue={entity.replacement}
                              className="px-2 py-1 border rounded text-sm min-w-48 focus:ring-2 focus:ring-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updateEntityReplacement(entity.id, e.target.value);
                                  setEditingEntity(null);
                                }
                                if (e.key === 'Escape') {
                                  setEditingEntity(null);
                                }
                              }}
                              onBlur={(e) => {
                                updateEntityReplacement(entity.id, e.target.value);
                                setEditingEntity(null);
                              }}
                            />
                            <span className="text-xs text-gray-500">↵ Valider • Echap Annuler</span>
                          </div>
                        ) : (
                          <code 
                            className="bg-green-50 text-green-800 px-2 py-1 rounded border cursor-pointer hover:bg-green-100 transition-colors break-all"
                            onClick={() => setEditingEntity(entity.id)}
                            title="Cliquer pour modifier"
                          >
                            {entity.replacement}
                          </code>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <button
                      className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm transition-colors"
                      onClick={() => setEditingEntity(entity.id)}
                      title="Modifier le remplacement"
                    >
                      ✏️
                    </button>
                    <button
                      className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-sm transition-colors"
                      onClick={() => deleteEntity(entity.id)}
                      title="Supprimer l'entité"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Stats */}
        <div className="bg-white rounded-lg shadow p-4 text-center text-sm text-gray-600">
          📊 {filteredEntities.length} entités affichées sur {entities.length} total • 
          {stats.selected} sélectionnées pour anonymisation • 
          Mode {currentMode} utilisé
          {searchTerm && (
            <span className="text-blue-600"> • Recherche: "{searchTerm}"</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
