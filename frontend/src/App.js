import React, { useState } from 'react';
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

  React.useEffect(() => {
    // Check system status
    const checkStatus = async () => {
      try {
        const response = await axios.get(`${API}/health`);
        setSystemStatus(response.data);
      } catch (error) {
        console.error('Status check failed:', error);
      }
    };
    checkStatus();
  }, []);

  const onDrop = React.useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const content = event.target.result;
      setDocument({ filename: file.name, content });
      setProcessing(true);
      
      try {
        const response = await axios.post(`${API}/process`, {
          content,
          filename: file.name,
          mode: currentMode
        });
        
        setEntities(response.data.entities);
        alert(`Document traité avec succès! ${response.data.total_occurrences} entités détectées.`);
        setCurrentPage('dashboard');
      } catch (error) {
        alert('Erreur lors du traitement du document');
        console.error(error);
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
      alert('Erreur lors de la génération du document');
      console.error(error);
    }
  };

  const toggleEntity = (entityId) => {
    setEntities(entities.map(entity => 
      entity.id === entityId 
        ? { ...entity, selected: !entity.selected }
        : entity
    ));
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
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 bg-white hover:bg-gray-50'
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
                      <span className="px-2 py-1 bg-gray-200 rounded-md text-sm">📞 Téléphones</span>
                      <span className="px-2 py-1 bg-gray-200 rounded-md text-sm">📧 Emails</span>
                      <span className="px-2 py-1 bg-gray-200 rounded-md text-sm">🏭 SIRET</span>
                      <span className="px-2 py-1 bg-gray-200 rounded-md text-sm">🏠 Adresses</span>
                    </div>
                    <div className="text-sm text-gray-500">⏱️ 2-5 secondes</div>
                  </div>
                </div>
              </div>

              {/* Advanced Mode */}
              <div 
                className={`cursor-pointer p-6 rounded-lg border-2 transition-all ${
                  currentMode === 'advanced' 
                    ? 'border-blue-500 bg-blue-50' 
                    : systemStatus.spacy_available 
                      ? 'border-gray-200 bg-white hover:bg-gray-50'
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
                    <p className="text-gray-600 mb-3">REGEX + Reconnaissance d'entités nommées</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="px-2 py-1 bg-gray-200 rounded-md text-sm">✅ Toutes détections REGEX</span>
                      <span className="px-2 py-1 bg-gray-200 rounded-md text-sm">👤 Personnes</span>
                      <span className="px-2 py-1 bg-gray-200 rounded-md text-sm">🏢 Organisations</span>
                    </div>
                    <div className="text-sm text-gray-500">⏱️ 5-15 secondes</div>
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
                    <p className="text-gray-600 mb-3">REGEX + Analyse sémantique par IA locale</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="px-2 py-1 bg-gray-200 rounded-md text-sm">🧠 Entités complexes</span>
                      <span className="px-2 py-1 bg-gray-200 rounded-md text-sm">🏠 100% Local</span>
                    </div>
                    <div className="text-sm text-gray-500">⏱️ 10-30 secondes</div>
                  </div>
                </div>
              </div>
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
                    Mode {currentMode} - Analyse du document
                  </p>
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-blue-600 rounded text-white flex items-center justify-center font-bold">🛡️</div>
              <div>
                <h1 className="text-xl font-semibold">RGPD Anonymizer</h1>
                <p className="text-sm text-gray-600">📄 {document?.filename}</p>
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
                💾 Générer DOCX
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="font-semibold">📊 Détections:</span>
                <span className="px-2 py-1 border rounded">{entities.length} Total</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  {entities.filter(e => e.source === 'REGEX').length} REGEX
                </span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                  {entities.filter(e => e.source === 'NER').length} NER
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Mode utilisé: {currentMode} • {entities.filter(e => e.selected).length} entités sélectionnées
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="🔍 Rechercher une entité..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <button
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              onClick={() => {
                const allSelected = entities.every(e => e.selected);
                setEntities(entities.map(e => ({ ...e, selected: !allSelected })));
              }}
            >
              {entities.every(e => e.selected) ? '☑️ Décocher tout' : '✅ Tout sélectionner'}
            </button>
          </div>
        </div>

        {/* Entities List */}
        <div className="space-y-3">
          {entities.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="text-gray-600">Aucune entité trouvée</p>
            </div>
          ) : (
            entities.map(entity => (
              <div key={entity.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={entity.selected}
                    onChange={() => toggleEntity(entity.id)}
                    className="mt-1"
                  />
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
                      <span className={`px-2 py-1 text-xs rounded ${
                        entity.source === 'REGEX' ? 'bg-blue-100 text-blue-800' :
                        entity.source === 'NER' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {entity.source}
                      </span>
                      {entity.confidence < 1 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          {Math.round(entity.confidence * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="font-medium">Texte: </span>
                        <code className="bg-gray-100 px-1 rounded">{entity.text}</code>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Remplacement: </span>
                        <code className="bg-green-100 px-1 rounded">{entity.replacement}</code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;