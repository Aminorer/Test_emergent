# 🛡️ Anonymiseur Juridique RGPD v3.0

Application complète d'anonymisation de documents juridiques français conforme RGPD.

## ✨ Fonctionnalités

### 🔍 **3 Modes de Traitement**
- **Standard (REGEX)** : Détection par expressions régulières (téléphones, emails, SIRET, adresses, références juridiques)
- **Approfondi (NER)** : REGEX + Intelligence Artificielle spaCy pour noms et organisations
- **Ollama (Futur)** : IA locale avancée avec prompts personnalisables

### 🎯 **Détections Automatiques**
- 📞 **Téléphones français** (06.12.34.56.78, +33 formats)
- 📧 **Emails** avec validation RFC
- 🏭 **SIRET** avec validation Luhn
- 🆔 **Numéros Sécurité Sociale** français
- 🏠 **Adresses** (rues, codes postaux, villes)
- ⚖️ **Références juridiques** (RG, dossiers, articles)
- 👤 **Personnes** (noms, prénoms) via NER
- 🏢 **Organisations** (entreprises, cabinets) via NER

### 🛠️ **Interface Avancée**
- ✅ **Drag & Drop** pour upload
- ✅ **Dashboard complet** de gestion des entités
- ✅ **Édition en temps réel** des remplacements
- ✅ **Groupage d'entités** avec nom commun
- ✅ **Ajout manuel** d'entités personnalisées
- ✅ **Filtres et recherche** avancés
- ✅ **Export DOCX** avec formatage préservé
- ✅ **Statistiques détaillées**

## 🚀 Installation Locale

### **Prérequis**
- Python 3.10+
- Node.js 16+
- Git

### **1. Backend (FastAPI)**

```bash
# Cloner et aller dans le dossier backend
git clone <votre-repo>
cd backend

# Créer un environnement virtuel
python -m venv venv
# Windows
venv\Scripts\activate
# MacOS/Linux  
source venv/bin/activate

# Installer les dépendances
pip install -r requirements_local.txt

# Installer le modèle spaCy français
python -m spacy download fr_core_news_lg

# Lancer le serveur backend
python complete_backend_server.py
```

Le backend sera accessible sur : http://localhost:8001

### **2. Frontend (React)**

```bash
# Aller dans le dossier frontend
cd ../frontend

# Copier les fichiers
# - Copier complete_frontend_app.js vers src/App.js
# - Copier package_local.json vers package.json

# Installer les dépendances
npm install
# ou
yarn install

# Lancer le frontend
npm start
# ou  
yarn start
```

Le frontend sera accessible sur : http://localhost:3000

## 📋 Structure des Fichiers

```
anonymiseur-rgpd-v3/
├── backend/
│   ├── complete_backend_server.py    # Serveur FastAPI complet
│   ├── requirements_local.txt        # Dépendances Python
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── App.js                   # complete_frontend_app.js
│   │   ├── App.css                  # Styles
│   │   └── index.js
│   ├── package.json                 # package_local.json
│   └── public/
└── README.md                        # Ce fichier
```

## 🧪 Test Rapide

1. **Démarrer backend et frontend**
2. **Ouvrir http://localhost:3000**
3. **Créer un fichier test.txt** avec ce contenu :
```
Monsieur Jean DUPONT, domicilié au 123 rue de la Paix, 75001 Paris, joignable au 06.12.34.56.78 ou par email jean.dupont@cabinet-martin.fr, travaille pour le Cabinet Juridique Martin. Son numéro SIRET est 12345678901234. Le dossier RG 24/12345 concerne cette affaire juridique.
```
4. **Déposer le fichier** dans l'interface
5. **Choisir le mode** Standard ou Approfondi
6. **Gérer les entités** détectées
7. **Télécharger le DOCX** anonymisé

## 🎯 Utilisation

### **Page d'Accueil**
1. **Sélectionner le mode** de traitement
2. **Vérifier le status** des services (spaCy, Ollama)
3. **Déposer ou sélectionner** un document
4. **Attendre le traitement** automatique

### **Dashboard de Gestion**
1. **Visualiser toutes les entités** détectées
2. **Filtrer par source** (REGEX, NER, Manuel)
3. **Rechercher** des entités spécifiques
4. **Modifier les remplacements** en cliquant dessus
5. **Grouper des entités** similaires
6. **Ajouter des entités manuelles**
7. **Générer le document** anonymisé final

### **Fonctionnalités Avancées**
- **Édition en temps réel** : Cliquez sur un remplacement pour le modifier
- **Groupage** : Sélectionnez plusieurs entités et créez un groupe
- **Ajout manuel** : Ajoutez vos propres règles d'anonymisation
- **Statistiques** : Visualisez le nombre d'entités par type et source

## 🔧 Configuration

### **Variables d'Environnement**
```bash
# Frontend (.env)
REACT_APP_BACKEND_URL=http://localhost:8001

# Backend (optionnel)
OLLAMA_URL=http://localhost:11434
```

### **Ports par Défaut**
- **Backend** : 8001
- **Frontend** : 3000
- **Ollama** : 11434 (si installé)

## 🔍 Dépannage

### **"spaCy non disponible"**
```bash
pip install spacy
python -m spacy download fr_core_news_lg
```

### **"Erreur CORS"**
Vérifiez que le backend tourne sur le bon port (8001)

### **"Aucune entité détectée"**
- Vérifiez que le texte contient des données françaises
- Essayez le mode Approfondi si spaCy est installé
- Consultez la console du navigateur pour les erreurs

### **"Erreur de génération DOCX"**
```bash
pip install python-docx
```

## 📊 Performance

- **Mode Standard** : ~2-5 secondes
- **Mode Approfondi** : ~5-15 secondes  
- **Capacité** : Fichiers jusqu'à 50MB
- **Formats** : TXT, PDF, DOCX

## 🛡️ Sécurité RGPD

- ✅ **Traitement 100% local** (pas de cloud)
- ✅ **Aucune sauvegarde** des données
- ✅ **Sessions temporaires** uniquement
- ✅ **Anonymisation réversible** impossible
- ✅ **Code source ouvert** pour audit

## 🚧 Roadmap

- [ ] **Support Ollama** complet avec prompts personnalisés
- [ ] **OCR intégré** pour PDF scannés  
- [ ] **Export** vers autres formats (PDF, HTML)
- [ ] **API REST** complète pour intégrations
- [ ] **Interface multilingue**
- [ ] **Règles personnalisables** par utilisateur

## 🤝 Contribution

1. **Fork** le projet
2. **Créer** une branche feature
3. **Commiter** vos changements
4. **Push** vers la branche
5. **Ouvrir** une Pull Request

## 📄 License

MIT License - Voir [LICENSE](LICENSE) pour plus de détails.

## 📞 Support

- **Issues** : [GitHub Issues](https://github.com/votre-repo/issues)
- **Documentation** : Ce README
- **Email** : votre-email@domaine.com

---

**🛡️ Anonymiseur Juridique RGPD v3.0** - *Anonymisation sécurisée et conforme pour documents juridiques français*