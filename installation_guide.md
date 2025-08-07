# 🚀 Guide d'Installation Complet - Anonymiseur Juridique RGPD v3.0

## 📁 Structure de Fichiers à Créer

Créez cette structure sur votre machine locale :

```
anonymiseur-rgpd-v3/
├── backend/
│   ├── server.py                 # ← Copier complete_backend_server.py ici
│   ├── requirements.txt          # ← Copier requirements_local.txt ici
├── frontend/
│   ├── src/
│   │   ├── App.js               # ← Copier complete_frontend_app.js ici
│   │   ├── App.css              # ← Créer avec styles basiques
│   │   └── index.js             # ← Fichier React standard
│   ├── public/
│   │   └── index.html           # ← Fichier HTML standard React
│   ├── package.json             # ← Copier package_local.json ici
└── README.md                    # ← Copier README_COMPLET.md ici
```

## 🛠️ Installation Étape par Étape

### **Étape 1 : Création des Dossiers**

```bash
mkdir anonymiseur-rgpd-v3
cd anonymiseur-rgpd-v3
mkdir backend frontend
mkdir frontend/src frontend/public
```

### **Étape 2 : Configuration Backend**

```bash
cd backend

# Créer l'environnement virtuel Python
python -m venv venv

# Activer l'environnement
# Windows :
venv\Scripts\activate
# MacOS/Linux :
source venv/bin/activate

# Copier les fichiers fournis :
# - complete_backend_server.py → server.py  
# - requirements_local.txt → requirements.txt

# Installer les dépendances
pip install -r requirements.txt

# Installer spaCy français
python -m spacy download fr_core_news_lg

# Tester le backend
python server.py
```

Vous devriez voir :
```
🚀 Starting Anonymiseur Juridique RGPD v3.0 Backend
📍 Backend URL: http://localhost:8001
🧠 spaCy Available: True
🔗 Ollama Support: True
INFO:     Uvicorn running on http://0.0.0.0:8001
```

### **Étape 3 : Configuration Frontend**

```bash
# Aller dans le dossier frontend
cd ../frontend

# Copier les fichiers fournis :
# - package_local.json → package.json
# - complete_frontend_app.js → src/App.js

# Créer src/index.js
cat > src/index.js << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
EOF

# Créer public/index.html
cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Anonymiseur Juridique RGPD v3.0</title>
    <style>
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; }
    </style>
</head>
<body>
    <div id="root"></div>
</body>
</html>
EOF

# Créer src/App.css basique
cat > src/App.css << 'EOF'
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'Inter', sans-serif;
  background-color: #f8fafc;
}

.App {
  min-height: 100vh;
}

button, input, select, textarea {
  transition: all 0.2s ease-in-out;
}

button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
EOF

# Installer les dépendances
npm install
# ou si vous préférez yarn :
# yarn install

# Lancer le frontend
npm start
# ou yarn start
```

### **Étape 4 : Vérification**

1. **Backend** : http://localhost:8001/docs (Documentation API)
2. **Frontend** : http://localhost:3000 (Interface utilisateur)
3. **Test API** : http://localhost:8001/api/health

## 🧪 Test Complet

1. **Créer un fichier `test.txt`** avec :
```
Monsieur Jean DUPONT, domicilié au 123 rue de la Paix, 75001 Paris, joignable au 06.12.34.56.78 ou par email jean.dupont@cabinet-martin.fr, travaille pour le Cabinet Juridique Martin. Le dossier RG 24/12345 concerne cette affaire.
```

2. **Ouvrir http://localhost:3000**
3. **Sélectionner mode "Approfondi"** (si spaCy fonctionne)
4. **Déposer le fichier test.txt**
5. **Vérifier les détections** (9+ entités attendues)
6. **Modifier quelques remplacements**
7. **Générer le DOCX** anonymisé

## ❗ Résolution des Problèmes Courants

### **Problème : "spaCy non disponible"**
```bash
cd backend
pip install spacy
python -m spacy download fr_core_news_lg
python -c "import spacy; nlp = spacy.load('fr_core_news_lg'); print('✅ spaCy OK')"
```

### **Problème : "Can't resolve 'react-dropzone'"**
```bash
cd frontend
npm install react-dropzone axios
# ou
yarn add react-dropzone axios
```

### **Problème : "CORS Error"**
Vérifiez que :
- Backend tourne sur port 8001
- Frontend tourne sur port 3000  
- `package.json` contient `"proxy": "http://localhost:8001"`

### **Problème : "Aucune entité détectée"**
1. Vérifiez les logs backend dans le terminal
2. Testez l'API directement :
```bash
curl -X POST http://localhost:8001/api/process \
  -H "Content-Type: application/json" \
  -d '{"content":"Jean DUPONT habite au 06.12.34.56.78","filename":"test.txt","mode":"standard"}'
```

### **Problème : Port déjà utilisé**
```bash
# Changer le port backend dans server.py :
uvicorn.run(app, host="0.0.0.0", port=8002, reload=True)

# Et mettre à jour le proxy frontend dans package.json :
"proxy": "http://localhost:8002"
```

## 🔧 Personnalisation

### **Ajouter de nouveaux patterns REGEX**
Dans `server.py`, modifiez la classe `RegexService` :

```python
def __init__(self):
    # Vos nouveaux patterns
    self.custom_patterns = [
        r'\bpattern_custom\b'  # Votre pattern
    ]
```

### **Modifier les remplacements par défaut**
```python
# Dans RegexService.extract_entities()
replacement="Votre remplacement personnalisé"
```

### **Changer les couleurs de l'interface**
Dans `App.css`, modifiez les classes CSS.

## 📊 Métriques de Performance

- **Mode Standard** : ~2-5s pour 1000 mots
- **Mode Approfondi** : ~5-15s pour 1000 mots
- **RAM utilisée** : ~200MB (backend) + ~100MB (frontend)
- **Fichiers supportés** : Jusqu'à 50MB

## 🚀 Déploiement Production

### **Backend (FastAPI)**
```bash
pip install gunicorn
gunicorn server:app --host 0.0.0.0 --port 8001 --workers 4
```

### **Frontend (React)**  
```bash
npm run build
# Servir le dossier build/ avec nginx ou autre
```

## 🔐 Sécurité

- ✅ **Pas de sauvegarde** des documents
- ✅ **Traitement local uniquement**
- ✅ **Sessions en mémoire** seulement
- ✅ **Validation des inputs**
- ✅ **CORS configuré**

---

**Avec ce guide, vous devriez avoir une installation complète et fonctionnelle de l'Anonymiseur Juridique RGPD v3.0 ! 🎉**