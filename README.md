# 🍿 Culture Tracker — Extension Multi-Navigateurs pour Notion

[![Version](https://img.shields.io/badge/version-1.5.0-blue.svg)](https://github.com/Pixelzeus/notion-culture-tracker/releases/tag/v1.5.0)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3%20Ready-green.svg?logo=googlechrome)](https://github.com/Pixelzeus/notion-culture-tracker/releases/download/v1.5.0/culture-tracker-v1.5.0-chrome.zip)
[![Firefox MV3](https://img.shields.io/badge/Firefox-MV3%20Ready-orange.svg?logo=firefoxbrowser)](https://github.com/Pixelzeus/notion-culture-tracker/releases/download/v1.5.0/culture-tracker-v1.5.0-firefox.xpi)
[![Safari MV3](https://img.shields.io/badge/Safari-MV3%20Ready-blue.svg?logo=safari)](https://github.com/Pixelzeus/notion-culture-tracker/releases/download/v1.5.0/culture-tracker-v1.5.0-safari.zip)
[![Notion API](https://img.shields.io/badge/Notion-API%20v1-black.svg?logo=notion)](https://developers.notion.com/)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](./LICENSE)

Extension web multi-navigateurs conçue pour enrichir et automatiser votre tableau de bord **Tracking Culture** dans Notion. Compatible nativement avec **Google Chrome**, **Mozilla Firefox** et **Apple Safari** en **Manifest V3**, et optimisée pour les écrans tactiles mobiles et tablettes.

Elle permet de rechercher instantanément n'importe quel **film**, **série** (via **TMDb**) ou **jeu vidéo** (via **TheGamesDB** et **Steam**) et de l'importer en 1 clic avec ses métadonnées complètes, ses jaquettes officielles et des **modèles de page Notion pré-remplis**.

L'extension fonctionne aussi bien en **popup classique** qu'en **panneau latéral rétractable directement intégré dans l'interface web de Notion**.

---

## 📦 Téléchargements Directs (GitHub Releases v1.5.0)

Téléchargez le paquet correspondant à votre navigateur depuis la [Release GitHub v1.5.0](https://github.com/Pixelzeus/notion-culture-tracker/releases/tag/v1.5.0) :

| Navigateur / Plateforme | Type d'archive | Lien de Téléchargement Direct |
|---|---|---|
| 🌐 **Google Chrome & Chromium** (Edge, Brave, Opera, Vivaldi) | Archive ZIP (Manifest V3 avec Service Worker) | [📥 `culture-tracker-v1.5.0-chrome.zip`](https://github.com/Pixelzeus/notion-culture-tracker/releases/download/v1.5.0/culture-tracker-v1.5.0-chrome.zip) |
| 🦊 **Mozilla Firefox** | Fichier XPI (Installation directe d'Add-on) | [📥 `culture-tracker-v1.5.0-firefox.xpi`](https://github.com/Pixelzeus/notion-culture-tracker/releases/download/v1.5.0/culture-tracker-v1.5.0-firefox.xpi) |
| 🦊 **Mozilla Firefox** | Archive ZIP (Manifest V3 avec Event Script) | [📥 `culture-tracker-v1.5.0-firefox.zip`](https://github.com/Pixelzeus/notion-culture-tracker/releases/download/v1.5.0/culture-tracker-v1.5.0-firefox.zip) |
| 🧭 **Apple Safari** (macOS, iPadOS & iOS) | Archive ZIP WebExtension standard | [📥 `culture-tracker-v1.5.0-safari.zip`](https://github.com/Pixelzeus/notion-culture-tracker/releases/download/v1.5.0/culture-tracker-v1.5.0-safari.zip) |

---

## ✨ Fonctionnalités Principales

* 🌐 **Compatibilité Multi-Navigateurs Totale** : Prise en charge native de Google Chrome, Mozilla Firefox et Apple Safari avec adaptation transparente des APIs (`browser.*` vs `chrome.*`).
* 📱 **Ergonomie Mobile & Tactile (Touch-Friendly)** : Mise en page responsive fluide s'adaptant sans coupure visuelle ni défilement horizontal (largeurs $\le 420$px), cibles tactiles confortables ($\ge 44\times 44$px) et disposition empilable des formulaires sur petits écrans ($\le 380$px).
* ⚡ **Intégration directe dans Notion** : Un bouton flottant discret `🍿 Culture Tracker` et un raccourci clavier (`Alt + C`) déploient un tiroir latéral droit fluide (460px sur desktop, 100vw sur mobile) qui ne bloque pas votre navigation.
* 🎮 **Jeux Vidéo (TheGamesDB & Steam)** : Recherche multiplateforme (PC, PlayStation, Xbox, Nintendo Switch, rétro...) avec jaquettes haute définition, genres, plateformes, support joueurs et format (Digital / Physique).
* 🎬 **Films & Séries (TMDb)** : Affiches officielles, casting principal, nombre d'épisodes, date de sortie et fournisseurs de streaming français (Netflix, Prime, Disney+...).
* 📄 **Modèles de Page Notion Automatiques** : Mise en page complète en 2 colonnes avec sections dépliantes (*Pros/Cons*, *DLC*, *Guides*, *Screenshots*, *Notes*).
* 🔍 **Diagnostic en 1 Clic** : Un bouton `🔍 Tester toutes les APIs` dans les paramètres teste simultanément TMDb, Notion, TheGamesDB et Steam.
* 🤖 **100% Personnalisable par IA** : Architecture modulaire déclarative documentée dans [`AGENTS.md`](./AGENTS.md) pour adapter l'extension à n'importe quel template Notion en un seul prompt.

---

## 🚀 Guide d'Installation par Navigateur

### 1. Prérequis Généraux
* Un navigateur moderne parmi :
  * **Google Chrome** (version 88 ou supérieure) ou navigateurs basés sur Chromium (Edge, Brave, Opera, Vivaldi, Arc).
  * **Mozilla Firefox** (version 109 ou supérieure).
  * **Apple Safari** (version 15.4 ou supérieure sur macOS Monterey/Ventura/Sonoma/Sequoia ou iPadOS/iOS 15+).
* Un compte **Notion** avec une ou plusieurs bases de données.

---

### 2. Installation sur Google Chrome & Navigateurs Chromium

1. Téléchargez l'archive [**`culture-tracker-v1.5.0-chrome.zip`**](https://github.com/Pixelzeus/notion-culture-tracker/releases/download/v1.5.0/culture-tracker-v1.5.0-chrome.zip).
2. Décompressez l'archive ZIP dans un dossier dédié sur votre disque (par exemple `Documents/CultureTracker-Chrome`).
3. Ouvrez Chrome et accédez à la page des extensions via la barre d'adresse :
   ```text
   chrome://extensions
   ```
4. En haut à droite de la page, activez le bouton bascule **« Mode développeur »** (*Developer mode*).
5. En haut à gauche, cliquez sur le bouton **« Charger l'extension non empaquetée »** (*Load unpacked*).
6. Sélectionnez le dossier décompressé contenant le fichier `manifest.json`.
7. L'icône de **Culture Tracker** apparaît dans vos extensions. Cliquez sur l'icône de puzzle pour l'épingler à la barre d'outils !

> 💡 **Mises à jour sur Chrome** : Il vous suffit de remplacer les fichiers dans le dossier et de cliquer sur l'icône d'actualisation 🔄 dans `chrome://extensions`.

---

### 3. Installation sur Mozilla Firefox

#### Option A : Fichier XPI (Recommandé)
1. Téléchargez le fichier [**`culture-tracker-v1.5.0-firefox.xpi`**](https://github.com/Pixelzeus/notion-culture-tracker/releases/download/v1.5.0/culture-tracker-v1.5.0-firefox.xpi).
2. Ouvrez Firefox et entrez l'adresse suivante :
   ```text
   about:debugging#/runtime/this-firefox
   ```
3. Dans la section **Ce Firefox** (*This Firefox*), cliquez sur le bouton **« Charger un module temporaire... »** (*Load Temporary Add-on*).
4. Sélectionnez le fichier `.xpi` téléchargé.
5. L'extension s'active immédiatement dans votre barre d'outils !

#### Option B : Archive ZIP décompressée
1. Téléchargez et décompressez [**`culture-tracker-v1.5.0-firefox.zip`**](https://github.com/Pixelzeus/notion-culture-tracker/releases/download/v1.5.0/culture-tracker-v1.5.0-firefox.zip).
2. Rendez-vous sur `about:debugging#/runtime/this-firefox`.
3. Cliquez sur **« Charger un module temporaire... »** et sélectionnez le fichier `manifest.json` à la racine du dossier décompressé.

> ⚠️ **Remarque sur Firefox** : Sur les versions standard de Firefox, les modules non signés chargés via `about:debugging` restent actifs jusqu'à la fermeture du navigateur. Pour une installation permanente sans signature Mozilla AMO, utilisez **Firefox Developer Edition** ou **Firefox Nightly** avec le paramètre `xpinstall.signatures.required = false` dans `about:config`.

---

### 4. Installation sur Apple Safari (macOS & iPadOS)

#### Option A : Mode Développeur Safari (Direct, sans Xcode)
1. Téléchargez et décompressez l'archive [**`culture-tracker-v1.5.0-safari.zip`**](https://github.com/Pixelzeus/notion-culture-tracker/releases/download/v1.5.0/culture-tracker-v1.5.0-safari.zip).
2. Ouvrez **Safari** sur votre Mac.
3. Dans la barre de menus, allez dans **Safari** > **Réglages** (ou *Préférences*), onglet **Avancé**.
4. Cochez l'option **« Afficher les fonctionnalités pour les développeurs web »** (ou *Afficher le menu Développement*).
5. Dans la barre de menus en haut, ouvrez le nouveau menu **Développement** et cochez **« Autoriser les extensions non signées »** (*Allow Unsigned Extensions*).
6. Rendez-vous dans **Développement** > **Extensions web** > **Charger une extension non empaquetée...** et sélectionnez le dossier décompressé de Safari.
7. Activez l'extension dans **Safari** > **Réglages** > **Extensions**.

#### Option B : Conversion en Application Native macOS / iOS via Xcode
Si vous souhaitez compiler l'extension sous la forme d'une application macOS/iOS autonome signée avec votre compte Apple Developer :
1. Décompressez `culture-tracker-v1.5.0-safari.zip`.
2. Ouvrez un terminal et exécutez l'utilitaire Apple Xcode :
   ```bash
   xcrun safari-web-extension-converter path/to/culture-tracker-v1.5.0-safari --app-name "Culture Tracker"
   ```
3. Xcode ouvre automatiquement le projet généré.
4. Sélectionnez votre cible (Mac ou iPad/iPhone), choisissez votre équipe de signature et cliquez sur **Run (⌘ + R)**.

---

## ⚙️ Configuration de votre Espace Notion (3 minutes)

Pour que l'extension puisse écrire dans votre Notion, suivez ces étapes simples :

### A. Créer une clé secrète d'intégration Notion
1. Rendez-vous sur la page officielle : **[notion.so/my-integrations](https://www.notion.so/my-integrations)**.
2. Cliquez sur **« + Nouvelle intégration »** (*New integration*).
3. Donnez-lui un nom (ex: `Culture Tracker`) et associez-la à votre espace de travail.
4. Cliquez sur **Sauvegarder**, puis copiez le **Jeton d'intégration interne** (*Internal Integration Secret* qui commence par `secret_` ou `ntn_`).

### B. Autoriser l'intégration sur vos bases de données Notion *(Indispensable)*
Par défaut, Notion protège vos bases contre tout accès externe :
1. Ouvrez votre page ou votre base de données dans Notion (ex: votre base de films ou de jeux).
2. Cliquez sur les **trois petits points `•••`** en haut à droite de la page.
3. Descendez tout en bas du menu jusqu'à **« Connexions »** (*Connections*) ou **« Ajouter des connexions »**.
4. Recherchez et sélectionnez votre intégration **`Culture Tracker`**.
5. Répétez l'opération pour chacune des bases que vous souhaitez relier.

### C. Récupérer l'identifiant (ID) d'une base Notion
1. Ouvrez la base Notion en pleine page dans votre navigateur.
2. Regardez l'URL dans la barre d'adresse :
   ```text
   https://www.notion.so/mon-espace/312aec4b87d98111b530d4af0c22d898?v=...
                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   ```
3. La suite de **32 caractères hexadécimaux** située juste avant le `?v=` est l'**ID de votre base**.

---

## 🔑 Configurer vos Clés d'API dans l'Extension

1. Cliquez sur l'icône **Culture Tracker** dans la barre d'outils de votre navigateur (ou sur la pilule flottante sur Notion).
2. Cliquez sur l'icône d'engrenage **⚙️ Paramètres** en haut à droite.
3. Renseignez vos accès :
   * **Clé API TMDb** : Obtenez gratuitement votre clé v3 sur [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).
   * **Clé API Notion** : Votre jeton interne `secret_...` ou `ntn_...` copié à l'étape A.
   * **Clé API TheGamesDB** : Obtenez gratuitement une clé sur [thegamesdb.net](https://thegamesdb.net/) (pour les jeux consoles et rétro).
   * **IDs de vos bases Notion** : Collez les IDs de vos bases correspondantes (Films/Séries et Jeux Vidéo).
4. Cliquez sur **« 🔍 Tester toutes les APIs »** :
   * L'extension vérifie en parallèle TMDb, Notion, TheGamesDB et Steam et vous confirme en vert que tout est prêt !
5. Cliquez sur **« Enregistrer »**.

---

## 🎮 Guide d'Utilisation

### Mode 1 : Directement dans Notion (Recommandé)
1. Ouvrez votre page Notion (`https://www.notion.so/`).
2. Cliquez sur la pilule flottante **`🍿 Culture Tracker`** en bas à droite (ou appuyez sur **`Alt + C`**).
3. Le tiroir latéral s'ouvre à droite sans bloquer la vue de vos tableaux Notion.
4. Tapez le nom d'un film, d'une série ou d'un jeu vidéo :
   * Sélectionnez le résultat souhaité.
   * Choisissez la plateforme, le statut ou la note.
   * Cliquez sur **« Ajouter à Notion »**.
5. L'entrée apparaît instantanément dans votre base Notion en arrière-plan avec ses jaquettes et sa mise en page complète !
6. Appuyez sur **`Échap`** ou cliquez sur **`✕`** pour refermer le panneau.

### Mode 2 : Popup Classique
* Cliquez sur l'icône de l'extension dans la barre d'outils depuis n'importe quel onglet pour une recherche rapide.
* Si l'onglet en cours est Notion, un bouton **`📍 Intégrer à la page`** vous permet de basculer sur le tiroir latéral en un clic.

---

## 🔧 Dépannage & Erreurs Courantes

* **Erreur `HTTP 401 Unauthorized` ou `Clé API invalide`** :
  * Vérifiez que votre jeton Notion commence bien par `secret_` ou `ntn_` sans espace avant ou après.
  * Pour TMDb, assurez-vous d'utiliser la clé API v3 (chaîne hexadécimale de 32 caractères) et non un token de lecture v4.
* **Erreur `Object not found` lors de l'ajout dans Notion** :
  * L'intégration Notion n'a pas été autorisée sur la base ciblée. Retournez sur la base Notion, cliquez sur `•••` > *Connexions* et ajoutez votre intégration `Culture Tracker`.
* **Erreur CORS ou blocage réseau** :
  * L'extension intègre un proxy d'arrière-plan automatique (`services/fetch-proxy.js`) pour contourner les restrictions CORS selon le navigateur (Chrome, Firefox ou Safari). Si un pare-feu ou un bloqueur d'URL empêche la requête, utilisez le bouton *Tester toutes les APIs* pour localiser le service bloqué.

---

## 🤖 Personnalisation pour n'importe quel Espace Notion

Cette extension n'est pas limitée à un template figé :
* **Déclaratif** : Tout le schéma (noms de colonnes, types `relation`, `select`, `multi_select`, etc.) est configuré dans [`config/schema.default.json`](./config/schema.default.json).
* **Adaptateur universel** : [`services/notion-adapter.js`](./services/notion-adapter.js) s'adapte automatiquement et ignore les colonnes absentes sans crasher.
* **Guide IA** : Consultez [`AGENTS.md`](./AGENTS.md) pour les instructions destinées aux agents IA (Cursor, Claude Code, Copilot, Antigravity) souhaitant adapter le projet en un prompt.

---

## 🧪 Tests, Build & Publication

Le projet utilise des scripts Node.js sans aucune dépendance npm externe :

```bash
# Vérifier la syntaxe de tous les fichiers JavaScript
npm.cmd run test:syntax

# Lancer la suite de tests unitaires
npm.cmd test

# Lancer la suite complète de tests End-to-End (154 tests, Tiers 1 à 4)
npm.cmd run test:e2e

# Compiler les packages pour tous les navigateurs (Chrome, Firefox, Safari)
npm.cmd run build

# Publier la release sur GitHub avec l'ensemble des assets binaires
npm.cmd run release:publish
```

---

## 📄 Licence

Ce projet est sous licence [MIT](./LICENSE). Vous êtes libre de l'utiliser, de le modifier et de l'adapter à vos besoins personnels.
