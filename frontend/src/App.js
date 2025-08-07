import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { 
  Shield, 
  Upload, 
  FileText, 
  Settings, 
  Download, 
  Eye, 
  Search,
  BarChart3,
  Filter,
  Edit3,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  Building,
  Phone,
  Mail,
  MapPin,
  FileImage
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Badge } from './components/ui/badge';
import { Checkbox } from './components/ui/checkbox';
import { Progress } from './components/ui/progress';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Zustand-like store with useState
const useAppStore = () => {
  const [currentMode, setCurrentMode] = useState('standard');
  const [ollamaConfig, setOllamaConfig] = useState({
    url: 'http://localhost:11434',
    model: 'llama3.2:3b',
    custom_prompt: null,
    timeout: 30
  });
  const [document, setDocument] = useState(null);
  const [entities, setEntities] = useState([]);
  const [selectedEntities, setSelectedEntities] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [systemStatus, setSystemStatus] = useState({ spacy_available: false, ollama_available: false });

  return {
    currentMode, setCurrentMode,
    ollamaConfig, setOllamaConfig,
    document, setDocument,
    entities, setEntities,
    selectedEntities, setSelectedEntities,
    processing, setProcessing,
    systemStatus, setSystemStatus
  };
};

const ModeCard = ({ mode, title, description, features, duration, icon, disabled, isSelected, onSelect }) => (
  <Card className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${
    isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  onClick={() => !disabled && onSelect(mode)}>
    <CardContent className="p-6">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            {title}
            {disabled && <AlertCircle className="w-4 h-4 text-amber-500" />}
          </h3>
          <p className="text-gray-600 mb-3">{description}</p>
          <div className="flex flex-wrap gap-1 mb-3">
            {features.map((feature, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">{feature}</Badge>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>{duration}</span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

const EntityCard = ({ entity, onToggle, onEdit }) => {
  const getEntityIcon = (type) => {
    const icons = {
      phone: Phone,
      email: Mail,
      address: MapPin,
      person: Users,
      organization: Building,
      siret: Building,
      legal: FileText,
      ssn: FileImage
    };
    const Icon = icons[type] || FileText;
    return <Icon className="w-4 h-4" />;
  };

  const getSourceBadgeColor = (source) => {
    const colors = {
      REGEX: 'bg-blue-100 text-blue-800',
      NER: 'bg-green-100 text-green-800',
      OLLAMA: 'bg-purple-100 text-purple-800',
      MANUAL: 'bg-gray-100 text-gray-800'
    };
    return colors[source] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox 
            checked={entity.selected}
            onCheckedChange={() => onToggle(entity.id)}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {getEntityIcon(entity.type)}
              <Badge className={getSourceBadgeColor(entity.source)}>
                {entity.source}
              </Badge>
              {entity.confidence < 1 && (
                <Badge variant="outline">
                  {Math.round(entity.confidence * 100)}%
                </Badge>
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(entity)}
          >
            <Edit3 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const UploadPage = ({ store, onProcessingComplete }) => {
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState('unknown');

  const testOllamaConnection = async () => {
    try {
      const response = await axios.post(`${API}/test-ollama`, store.ollamaConfig);
      setOllamaStatus(response.data.connected ? 'connected' : 'disconnected');
      return response.data.connected;
    } catch (error) {
      setOllamaStatus('disconnected');
      return false;
    }
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    
    // Simple text extraction (in real app, would handle PDF/DOCX)
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target.result;
      
      store.setDocument({ filename: file.name, content });
      store.setProcessing(true);
      
      try {
        const response = await axios.post(`${API}/process`, {
          content,
          filename: file.name,
          mode: store.currentMode,
          ollama_config: store.ollamaConfig
        });
        
        store.setEntities(response.data.entities);
        toast.success(`Document traité avec succès! ${response.data.total_occurrences} entités détectées.`);
        onProcessingComplete();
      } catch (error) {
        toast.error('Erreur lors du traitement du document');
        console.error(error);
      } finally {
        store.setProcessing(false);
      }
    };
    
    reader.readAsText(file);
  }, [store, onProcessingComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 50 * 1024 * 1024 // 50MB
  });

  const modes = [
    {
      mode: 'standard',
      title: '⚡ Standard - REGEX',
      description: 'Détection par expressions régulières uniquement',
      features: ['📞 Téléphones', '📧 Emails', '🏭 SIRET', '🆔 N° Sécu', '🏠 Adresses', '⚖️ Références juridiques'],
      duration: '2-5 secondes',
      icon: <RefreshCw className="w-6 h-6" />,
      disabled: false
    },
    {
      mode: 'advanced',
      title: '🧠 Approfondi - NER',
      description: 'REGEX + Reconnaissance d\'entités nommées',
      features: ['✅ Toutes détections REGEX', '👤 Personnes', '🏢 Organisations', '🎯 Scores de confiance'],
      duration: '5-15 secondes',
      icon: <Users className="w-6 h-6" />,
      disabled: !store.systemStatus.spacy_available
    },
    {
      mode: 'ollama',
      title: '🚀 Ollama Local - IA',
      description: 'REGEX + Analyse sémantique par IA locale',
      features: ['✅ Toutes détections REGEX', '🧠 Entités complexes', '🎯 Prompt personnalisable', '🏠 100% Local'],
      duration: '10-30 secondes',
      icon: <Settings className="w-6 h-6" />,
      disabled: !store.systemStatus.ollama_available
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Shield className="w-10 h-10 text-blue-600" />
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
            {modes.map((modeConfig) => (
              <ModeCard
                key={modeConfig.mode}
                {...modeConfig}
                isSelected={store.currentMode === modeConfig.mode}
                onSelect={store.setCurrentMode}
              />
            ))}
          </div>
          
          {store.currentMode === 'ollama' && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      ollamaStatus === 'connected' ? 'bg-green-500' : 
                      ollamaStatus === 'disconnected' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                    <span className="font-medium">
                      Status Ollama: {
                        ollamaStatus === 'connected' ? 'Connecté' :
                        ollamaStatus === 'disconnected' ? 'Déconnecté' : 'Vérification...'
                      }
                    </span>
                  </div>
                  <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Settings className="w-4 h-4 mr-2" />
                        Configurer
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>⚙️ Configuration Ollama</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="url">URL Ollama</Label>
                          <div className="flex gap-2">
                            <Input
                              id="url"
                              value={store.ollamaConfig.url}
                              onChange={(e) => store.setOllamaConfig({
                                ...store.ollamaConfig,
                                url: e.target.value
                              })}
                            />
                            <Button size="sm" onClick={testOllamaConnection}>
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="model">Modèle</Label>
                          <Input
                            id="model"
                            value={store.ollamaConfig.model}
                            onChange={(e) => store.setOllamaConfig({
                              ...store.ollamaConfig,
                              model: e.target.value
                            })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="prompt">Prompt personnalisé (optionnel)</Label>
                          <Textarea
                            id="prompt"
                            placeholder="Laissez vide pour utiliser le prompt par défaut..."
                            value={store.ollamaConfig.custom_prompt || ''}
                            onChange={(e) => store.setOllamaConfig({
                              ...store.ollamaConfig,
                              custom_prompt: e.target.value || null
                            })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="timeout">Timeout (secondes)</Label>
                          <Input
                            id="timeout"
                            type="number"
                            value={store.ollamaConfig.timeout}
                            onChange={(e) => store.setOllamaConfig({
                              ...store.ollamaConfig,
                              timeout: parseInt(e.target.value)
                            })}
                          />
                        </div>
                        <Button 
                          className="w-full"
                          onClick={() => setConfigModalOpen(false)}
                        >
                          💾 Sauvegarder
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Upload Zone */}
        <Card className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
          <CardContent className="p-12">
            <div
              {...getRootProps()}
              className={`text-center space-y-4 cursor-pointer ${
                isDragActive ? 'text-blue-600' : 'text-gray-600'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-16 h-16 mx-auto text-gray-400" />
              <div>
                <h3 className="text-xl font-semibold mb-2">
                  {isDragActive ? 
                    'Déposez votre document ici...' : 
                    '📁 Déposez votre document juridique'
                  }
                </h3>
                <p className="text-gray-500">
                  Formats acceptés: PDF, DOCX, TXT • Limite: 50MB
                </p>
              </div>
              <Button className="mt-4">
                <FileText className="w-4 h-4 mr-2" />
                Sélectionner un fichier
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Processing Status */}
        {store.processing && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="animate-spin">
                  <RefreshCw className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900">
                    Traitement en cours...
                  </h3>
                  <p className="text-blue-700">
                    Mode {store.currentMode} - Analyse du document
                  </p>
                  <Progress value={65} className="mt-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

const DashboardPage = ({ store, onBackToUpload }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

  const filteredEntities = store.entities.filter(entity => {
    const matchesSearch = entity.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entity.replacement.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = sourceFilter === 'all' || entity.source === sourceFilter;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: store.entities.length,
    regex: store.entities.filter(e => e.source === 'REGEX').length,
    ner: store.entities.filter(e => e.source === 'NER').length,
    ollama: store.entities.filter(e => e.source === 'OLLAMA').length,
    selected: store.entities.filter(e => e.selected).length
  };

  const toggleEntity = (entityId) => {
    store.setEntities(store.entities.map(entity => 
      entity.id === entityId 
        ? { ...entity, selected: !entity.selected }
        : entity
    ));
  };

  const generateDocument = async () => {
    try {
      const response = await axios.post(`${API}/generate-document`, {
        entities: store.entities,
        original_content: store.document.content,
        filename: `${store.document.filename.split('.')[0]}_anonymise.docx`
      }, {
        responseType: 'blob'
      });
      
      // Download file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${store.document.filename.split('.')[0]}_anonymise.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Document anonymisé généré avec succès!');
    } catch (error) {
      toast.error('Erreur lors de la génération du document');
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Shield className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-xl font-semibold">RGPD Anonymizer</h1>
                  <p className="text-sm text-gray-600">📄 {store.document?.filename}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onBackToUpload}>
                  <Upload className="w-4 h-4 mr-2" />
                  Nouveau document
                </Button>
                <Button onClick={generateDocument} className="bg-green-600 hover:bg-green-700">
                  <Download className="w-4 h-4 mr-2" />
                  Générer DOCX
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold">Détections:</span>
                  <Badge variant="outline">{stats.total} Total</Badge>
                  <Badge className="bg-blue-100 text-blue-800">{stats.regex} REGEX</Badge>
                  <Badge className="bg-green-100 text-green-800">{stats.ner} NER</Badge>
                  <Badge className="bg-purple-100 text-purple-800">{stats.ollama} OLLAMA</Badge>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Mode utilisé: {store.currentMode} • {stats.selected} entités sélectionnées
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Rechercher une entité..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="REGEX">REGEX</SelectItem>
                  <SelectItem value="NER">NER</SelectItem>
                  <SelectItem value="OLLAMA">OLLAMA</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  const allSelected = store.entities.every(e => e.selected);
                  store.setEntities(store.entities.map(e => ({ ...e, selected: !allSelected })));
                }}
              >
                {store.entities.every(e => e.selected) ? '✗ Décocher tout' : '✓ Tout sélectionner'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Entities List */}
        <div className="space-y-3">
          {filteredEntities.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Aucune entité trouvée</p>
              </CardContent>
            </Card>
          ) : (
            filteredEntities.map(entity => (
              <EntityCard
                key={entity.id}
                entity={entity}
                onToggle={toggleEntity}
                onEdit={(entity) => {
                  // TODO: Implement edit functionality
                  toast.info('Édition à implémenter');
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

function App() {
  const store = useAppStore();
  const [currentPage, setCurrentPage] = useState('upload');

  // Check system status on load
  useEffect(() => {
    const checkSystemStatus = async () => {
      try {
        const response = await axios.get(`${API}/health`);
        store.setSystemStatus(response.data);
      } catch (error) {
        console.error('Failed to check system status:', error);
      }
    };
    
    checkSystemStatus();
  }, []);

  return (
    <div className="App">
      <Toaster />
      {currentPage === 'upload' ? (
        <UploadPage 
          store={store}
          onProcessingComplete={() => setCurrentPage('dashboard')}
        />
      ) : (
        <DashboardPage
          store={store}
          onBackToUpload={() => setCurrentPage('upload')}
        />
      )}
    </div>
  );
}

export default App;