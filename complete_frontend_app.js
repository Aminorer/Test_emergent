import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
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
  const [showManualAdd, setShowManualAdd] = useState(false);

  // Check system status on load
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await axios.get(`${API}/health`);
        setSystemStatus(response.data);
        console.log('✅ System Status:', response.data);
      } catch (error) {
        console.error('❌ Status check failed:', error);
        // Set defaults if backend is not available
        setSystemStatus({ spacy_available: false, ollama_available: false });
      }
    };
    checkStatus();
  }, []);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const content = event.target.result;
      setDocument({ filename: file.name, content });
      setProcessing(true);
      
      try {
        console.log(`🔄 Processing with mode: ${currentMode}`);
        console.log(`📄 Content length: ${content.length} chars`);
        
        const response = await axios.post(`${API}/process`, {
          content,
          filename: file.name,
          mode: currentMode
        });
        
        console.log('✅ Processing response:', response.data);
        setEntities(response.data.entities);
        alert(`Document traité avec succès! ${response.data.total_occurrences} entités détectées en ${response.data.processing_time.toFixed(2)}s`);
        setCurrentPage('dashboard');
      } catch (error) {
        console.error('❌ Processing error:', error);
        alert('Erreur lors du traitement du document: ' + (error.response?.data?.detail || error.message));
      } finally {
        setProcessing(false);
      }
    };
    
    reader.readAsText(file);
  }, [currentMode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 50 * 1024 * 1024
  });

  const generateDocument = async () => {
    try {
      const formData = new FormData();
      formData.append('original_content', document.content);
      formData.append('filename', `${document.filename.split('.')[0]}_anonymise.docx`);

      const response = await axios.post(`${API}/generate-document`, entities, {
        params: {
          original_content: document.content,
          filename: `${document.filename.split('.')[0]}_anonymise.docx`
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${document.filename.split('.')[0]}_anonymise.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      alert('Document anonymisé généré avec succès!');
    } catch (error) {
      console.error('❌ Document generation error:', error);
      alert('Erreur lors de la génération du document: ' + (error.response?.data?.detail || error.message));
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
    setEntities(entities.map(entity => 
      entity.id === entityId 
        ? { ...entity, replacement: newReplacement }
        : entity
    ));
  };

  const deleteEntity = (entityId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette entité ?')) {
      setEntities(entities.filter(entity => entity.id !== entityId));
    }
  };

  const createGroup = () => {
    if (selectedEntities.length < 2) {
      alert('Sélectionnez au moins 2 entités pour créer un groupe');
      return;
    }
    
    const groupReplacement = prompt('Nom du groupe:');
    if (groupReplacement) {
      setEntities(entities.map(entity => 
        selectedEntities.includes(entity.id)
          ? { ...entity, replacement: groupReplacement }
          : entity
      ));
      setSelectedEntities([]);
      alert(`Groupe "${groupReplacement}" créé avec ${selectedEntities.length} entités`);
    }
  };

  const addManualEntity = (text, type, replacement, startPos, endPos) => {
    const newEntity = {
      id: Date.now().toString(),
      text,
      type,
      source: 'MANUAL',
      confidence: 1.0,
      replacement,
      positions: [{ start: startPos, end: endPos }],
      selected: true
    };
    setEntities([...entities, newEntity]);
    alert('Entité manuelle ajoutée avec succès!');
  };

  // Filter entities
  const filteredEntities = entities.filter(entity => {
    const matchesSearch = entity.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entity.replacement.toLowerCase().includes(searchTerm.toLowerCase());
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
            
            {/* System Status */}
            <div className="flex justify-center gap-4 text-sm">
              <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${
                systemStatus.spacy_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${systemStatus.spacy_available ? 'bg-green-500' : 'bg-red-500'}`}></div>
                spaCy {systemStatus.spacy_available ? 'Disponible' : 'Indisponible'}
              </div>
              <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${
                systemStatus.ollama_available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}>
                <div className={`w-2 h-2 rounded-full ${systemStatus.ollama_available ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                Ollama {systemStatus.ollama_available ? 'Disponible' : 'Non disponible'}
              </div>
            </div>
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

          {/* Test Sample */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">🧪 Exemple de test</h3>
            <p className="text-sm text-yellow-700 mb-2">
              Vous pouvez tester avec ce contenu juridique français :
            </p>
            <div className="bg-white p-3 rounded border text-sm font-mono">
              Monsieur Jean DUPONT, domicilié au 123 rue de la Paix, 75001 Paris, joignable au 06.12.34.56.78 ou par email jean.dupont@cabinet-martin.fr, travaille pour le Cabinet Juridique Martin. Son numéro SIRET est 12345678901234. Le dossier RG 24/12345 concerne cette affaire juridique.
            </div>
            <div className="text-xs text-yellow-600 mt-2">
              💡 Copiez ce texte dans un fichier .txt et déposez-le ci-dessous
            </div>
          </div>

          {/* Upload Zone */}
          <div className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors rounded-lg p-12">
            <div
              {...getRootProps()}
              className={`text-center space-y-4 cursor-pointer ${
                isDragActive ? 'text-blue-600' : 'text-gray-600'
              }`}
            >
              <input {...getInputProps()} />
              <div className="text-6xl">📁</div>
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
              <button className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                📄 Sélectionner un fichier
              </button>
            </div>
          </div>

          {/* Processing Status */}
          {processing && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-6">
              <div className="flex items-center gap-4">
                <div className="animate-spin text-2xl">🔄</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900">
                    Traitement en cours...
                  </h3>
                  <p className="text-blue-700">
                    Mode {currentMode} - Analyse du document avec {currentMode === 'standard' ? 'expressions régulières' : 'IA (spaCy + REGEX)'}
                  </p>
                  <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                    <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                  </div>
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
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                onClick={() => setCurrentPage('upload')}
              >
                📤 Nouveau document
              </button>
              <button 
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                onClick={generateDocument}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="all">Toutes sources</option>
              <option value="REGEX">REGEX</option>
              <option value="NER">NER</option>
              <option value="OLLAMA">OLLAMA</option>
              <option value="MANUAL">Manuelle</option>
            </select>
            <button
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              onClick={() => {
                const allSelected = entities.every(e => e.selected);
                setEntities(entities.map(e => ({ ...e, selected: !allSelected })));
              }}
            >
              {entities.every(e => e.selected) ? '☑️ Tout décocher' : '✅ Tout sélectionner'}
            </button>
            <button
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              onClick={createGroup}
              disabled={selectedEntities.length < 2}
            >
              👥 Grouper ({selectedEntities.length})
            </button>
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              onClick={() => setShowManualAdd(!showManualAdd)}
            >
              ➕ Ajouter manuel
            </button>
          </div>
        </div>

        {/* Manual Add Form */}
        {showManualAdd && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">➕ Ajouter une entité manuelle</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              addManualEntity(
                formData.get('text'),
                formData.get('type'),
                formData.get('replacement'),
                parseInt(formData.get('startPos')),
                parseInt(formData.get('endPos'))
              );
              e.target.reset();
              setShowManualAdd(false);
            }} className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <input name="text" placeholder="Texte à anonymiser" className="px-3 py-2 border rounded" required />
              <select name="type" className="px-3 py-2 border rounded" required>
                <option value="person">👤 Personne</option>
                <option value="organization">🏢 Organisation</option>
                <option value="phone">📞 Téléphone</option>
                <option value="email">📧 Email</option>
                <option value="address">🏠 Adresse</option>
                <option value="legal">⚖️ Référence légale</option>
                <option value="siret">🏭 SIRET</option>
                <option value="ssn">🆔 N° Sécu</option>
              </select>
              <input name="replacement" placeholder="Remplacement" className="px-3 py-2 border rounded" required />
              <input name="startPos" type="number" placeholder="Position début" className="px-3 py-2 border rounded" required />
              <div className="flex gap-2">
                <input name="endPos" type="number" placeholder="Position fin" className="px-3 py-2 border rounded flex-1" required />
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                  ➕
                </button>
                <button type="button" onClick={() => setShowManualAdd(false)} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
                  ✖️
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Entities List */}
        <div className="space-y-3">
          {filteredEntities.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-4xl mb-4">😕</div>
              <p className="text-gray-600">
                {entities.length === 0 
                  ? 'Aucune entité détectée dans ce document' 
                  : 'Aucune entité ne correspond à votre recherche'
                }
              </p>
              {entities.length === 0 && (
                <div className="mt-4 text-sm text-gray-500">
                  💡 Essayez un document contenant des informations personnelles français : téléphones, emails, noms, adresses, etc.
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
                        <code className="bg-red-50 text-red-800 px-2 py-1 rounded border">{entity.text}</code>
                      </div>
                      
                      <div className="text-sm">
                        <span className="font-medium text-gray-700">Remplacement: </span>
                        {editingEntity === entity.id ? (
                          <div className="inline-flex items-center gap-2">
                            <input
                              type="text"
                              defaultValue={entity.replacement}
                              className="px-2 py-1 border rounded text-sm"
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
                          </div>
                        ) : (
                          <code 
                            className="bg-green-50 text-green-800 px-2 py-1 rounded border cursor-pointer hover:bg-green-100"
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
                      className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm"
                      onClick={() => setEditingEntity(entity.id)}
                      title="Modifier le remplacement"
                    >
                      ✏️
                    </button>
                    <button
                      className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
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
        </div>
      </div>
    </div>
  );
}

export default App;