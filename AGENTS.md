# 🤖 AGENTS.md — Guide de Personnalisation pour Agents IA

Ce document est spécialement rédigé pour les agents d'intelligence artificielle (Claude Code, Cursor, Copilot, Antigravity, Hermes, etc.) et les développeurs souhaitant **adapter, étendre ou reconfigurer** cette extension pour n'importe quel espace ou modèle Notion.

---

## 🧭 Vue d'ensemble du Projet

**Culture Tracker** est une extension pour Mozilla Firefox (Manifest V3) qui importe des **Films & Séries** (TMDb) et des **Jeux Vidéo** (TheGamesDB & Steam) directement dans Notion.

Elle dispose d'une **double interface** :
1. **Popup classique** dans la barre d'outils Firefox (`popup/popup.html`).
2. **Panneau latéral rétractable in-page** intégré dans l'UI de Notion (`content/notion-inject.js`), affiché via une pilule flottante `🍿 Culture Tracker` ou le raccourci `Alt + C`.

---

## 📂 Carte des Fichiers Clés

```text
├── config/
│   └── schema.default.json      <-- 🎯 LE fichier central de configuration du schéma Notion
├── content/
│   ├── notion-inject.js        <-- Content script (Shadow DOM, tiroir latéral droit 460px)
│   └── notion-inject.css       <-- Styles du bouton flottant et du tiroir latéral
├── popup/
│   ├── popup.html              <-- Vue principale (recherche, détails, paramètres)
│   ├── popup.css               <-- Styles sombres et responsive (mode standalone et embedded)
│   └── popup.js                <-- Contrôleur UI, gestion des onglets et événements
├── services/
│   ├── config.js               <-- Stockage local (browser.storage.local) et tables de lookup
│   ├── notion-adapter.js       <-- ⚡ Adaptateur universel de types (relation, select, etc.)
│   ├── template-engine.js      <-- 📄 Moteur de blocs de page Notion déclaratif
│   ├── schema-discovery.js     <-- 🔍 Introspection d'une base Notion (GET /v1/databases/:id)
│   ├── notion.js               <-- Client API Notion (création de pages, vérification)
│   ├── tmdb.js                 <-- Client API The Movie Database (v3)
│   ├── thegamesdb.js           <-- Client API TheGamesDB
│   ├── steam.js                <-- Client API Steam Storefront
│   └── fetch-proxy.js          <-- Relais fetch sécurisé via le background script (anti-CORS & anti-CSP)
├── background.js               <-- Service worker Firefox (headers CORS et relais PROXY_FETCH)
└── manifest.json               <-- Déclaration Firefox MV3
```

---

## 🛠️ Comment Adapter le Projet à un Nouveau Schéma Notion en 3 Étapes

Lorsqu'un utilisateur vous demande : *« Adapte l'extension à mes propres bases Notion »* :

### Étape 1 : Analyser la structure de sa base avec `schema-discovery.js`
Si vous disposez de l'ID de sa base et de sa clé secrète Notion, vous pouvez inspecter les colonnes exactes :

```javascript
import { inspectDatabase, generateSchemaRecommendation } from './services/schema-discovery.js';

const metadata = await inspectDatabase(userDatabaseId, notionApiKey);
console.log('Colonnes détectées :', metadata.properties);

const recommendation = generateSchemaRecommendation(metadata, 'game');
console.log('Recommandation de mapping :', recommendation);
```

### Étape 2 : Modifier `config/schema.default.json`
Modifiez les noms et types de colonnes pour qu'ils correspondent exactement à la base de l'utilisateur :

```json
{
  "mediaTypes": {
    "game": {
      "databaseKey": "gamesDbId",
      "template": "game-default",
      "usePageTemplate": true,
      "properties": {
        "title": { "notionName": "Nom du jeu", "type": "title" },
        "platform": { "notionName": "Plateforme", "type": "select" },
        "genres": { "notionName": "Tags", "type": "multi_select" },
        "status": { "notionName": "Statut", "type": "select", "defaultValue": "À faire" },
        "rating": { "notionName": "Note", "type": "number" },
        "releaseDate": { "notionName": "Sortie", "type": "date" }
      }
    }
  }
}
```

> **Types supportés par l'adaptateur (`notion-adapter.js`)** :
> * `title` : titre de l'entrée.
> * `relation` : lié à une autre base via un dictionnaire de mapping (`lookupTable`).
> * `select` : tag unique (ex: `"Steam"`, `"Terminé"`).
> * `multi_select` : plusieurs tags (ex: `["Action", "RPG"]`).
> * `number` : nombre ou note (ex: `8.5`).
> * `date` : date au format `YYYY-MM-DD`.
> * `rich_text` : texte long.
> * `url` : lien hypertexte.
> * `status` : propriété Notion Status.

### Étape 3 : Choisir le modèle de page (`template-engine.js`)
Si l'utilisateur :
* **Veut la structure 2 colonnes par défaut** : `"template": "game-default"` (ou `"movie-default"`).
* **Veut un résumé simple** : `"template": "simple-summary"`.
* **Ne veut aucun contenu dans le corps de la page** (seulement les propriétés de tableau) : `"template": "blank"` ou `"usePageTemplate": false`.

---

## ➕ Comment Ajouter un Nouveau Type de Média (ex: Livres / BDs)

Pour ajouter un nouveau fournisseur (ex: OpenLibrary / Google Books) :
1. **Créer le client API** dans `services/books.js` exportant `searchBooks(query)` et `getBookDetails(id)`.
2. **Ajouter le mapping** dans `config/schema.default.json` sous `"book": { ... }`.
3. **Ajouter un onglet de filtre** dans `popup/popup.html` (`<button class="tab" data-type="book">📚 Livres</button>`).
4. **Relier la recherche** dans `popup/popup.js` sous `performSearch()`.

---

## 🔒 Règles de Sécurité Critiques pour les Agents

> [!CAUTION]
> **JAMAIS de clés d'API en dur dans le code source ou dans les commits !**
> * Toutes les clés doivent rester vides (`''`) par défaut dans `services/config.js`.
> * L'utilisateur doit renseigner ses clés via l'onglet **Paramètres** de l'extension (stockées localement dans `browser.storage.local`).
> * Avant chaque commit / push, exécutez toujours un scan pour vérifier l'absence de tokens ou de clés secrètes.

---

## 🧪 Commandes de Validation pour l'Agent

* **Vérification de la syntaxe JS** :
  ```powershell
  node -c background.js content/notion-inject.js popup/popup.js services/*.js
  ```
* **Exécution des tests unitaires** :
  ```powershell
  node test/adapter.test.js
  ```
* **Régénération du paquet ZIP Firefox** :
  ```powershell
  powershell -Command "Remove-Item culture-tracker-firefox.zip -Force; Compress-Archive -Path 'manifest.json', 'background.js', 'README.md', 'icons', 'popup', 'services', 'content', 'config' -DestinationPath 'culture-tracker-firefox.zip' -Force"
  ```
