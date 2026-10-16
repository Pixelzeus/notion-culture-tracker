# 🍿 Culture Tracker — Extension Firefox pour Notion

[![Version](https://img.shields.io/badge/version-1.5.0-blue.svg)](https://github.com/Pixelzeus/notion-culture-tracker/releases)
[![Platform](https://img.shields.io/badge/platform-Firefox%20MV3-orange.svg)](https://www.mozilla.org/firefox/)
[![Notion API](https://img.shields.io/badge/Notion-API%20v1-black.svg)](https://developers.notion.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#)

Extension Firefox conçue pour enrichir et automatiser votre tableau de bord **Tracking Culture** dans Notion. Elle permet de rechercher instantanément n'importe quel **film**, **série** (via **TMDb**) ou **jeu vidéo** (via **TheGamesDB** et **Steam**) et de l'importer en 1 clic avec ses métadonnées complètes, ses jaquettes officielles et des **modèles de page Notion pré-remplis**.

L'extension fonctionne aussi bien en **popup classique** qu'en **panneau latéral directement intégré dans l'interface web de Notion**.

---

## ✨ Fonctionnalités Principales

* ⚡ **Intégration directe dans Notion** : Un bouton flottant discret `🍿 Culture Tracker` et un raccourci clavier (`Alt + C`) déploient un tiroir latéral droit fluide (460px) qui ne bloque pas votre navigation sur Notion.
* 🎮 **Jeux Vidéo (TheGamesDB & Steam)** : Recherche multiplateforme (PC, PlayStation, Xbox, Nintendo Switch, rétro...) avec jaquettes haute définition, genres, plateformes, support joueurs et format (Digital / Physique).
* 🎬 **Films & Séries (TMDb)** : Affiches officielles, casting principal, nombre d'épisodes, date de sortie et fournisseurs de streaming français (Netflix, Prime, Disney+...).
* 📄 **Modèles de Page Notion Automatiques** : Mise en page complète en 2 colonnes avec sections dépliantes (*Pros/Cons*, *DLC*, *Guides*, *Screenshots*, *Notes*).
* 🔍 **Diagnostic en 1 Clic** : Un bouton `🔍 Tester toutes les APIs` dans les paramètres teste simultanément TMDb, Notion, TheGamesDB et Steam.
* 🤖 **100% Personnalisable par IA** : Architecture modulaire déclarative documentée dans [`AGENTS.md`](./AGENTS.md) pour adapter l'extension à n'importe quel template Notion en un seul prompt.

---

## 🚀 Guide d'Installation Pas-à-Pas

### 1. Prérequis
* Navigateur **Mozilla Firefox** (version 109 ou supérieure).
* Un compte **Notion** avec une ou plusieurs bases de données.

---

### 2. Télécharger l'extension

Deux options au choix :

#### Option A : Via Git (Recommandé pour les mises à jour)
```bash
git clone https://github.com/Pixelzeus/notion-culture-tracker.git
```

#### Option B : Téléchargement direct du ZIP
1. Cliquez sur le bouton vert **`<> Code`** en haut du dépôt GitHub, puis sur **`Download ZIP`** (ou téléchargez `culture-tracker-firefox.zip`).
2. Décompressez l'archive dans le dossier de votre choix sur votre ordinateur.

---

### 3. Charger l'extension dans Firefox

1. Ouvrez Firefox.
2. Dans la barre d'adresse, saisissez :
   ```text
   about:debugging#/runtime/this-firefox
   ```
3. Dans la section **Ce Firefox** (*This Firefox*), cliquez sur le bouton **« Charger un module temporaire... »** (*Load Temporary Add-on*).
4. Naviguez dans le dossier du projet et sélectionnez le fichier :
   ```text
   manifest.json
   ```
5. L'icône de **Culture Tracker** apparaît désormais dans la barre d'outils de Firefox !

> 💡 **Pour les futures mises à jour** : Il vous suffira de revenir sur cette page `about:debugging` et de cliquer sur le bouton **« Recharger »** (*Reload*) sous l'extension.

---

### 4. Configuration de votre Espace Notion (3 minutes)

Pour que l'extension puisse écrire dans votre Notion, suivez ces étapes simples :

#### A. Créer une clé secrète d'intégration Notion
1. Rendez-vous sur la page officielle : **[notion.so/my-integrations](https://www.notion.so/my-integrations)**.
2. Cliquez sur **« + Nouvelle intégration »** (*New integration*).
3. Donnez-lui un nom (ex: `Culture Tracker`) et associez-la à votre espace de travail.
4. Cliquez sur **Sauvegarder**, puis copiez le **Jeton d'intégration interne** (*Internal Integration Secret* qui commence par `secret_` ou `ntn_`).

#### B. Autoriser l'intégration sur vos bases de données Notion *(Indispensable)*
Par défaut, Notion protège vos bases contre tout accès externe :
1. Ouvrez votre page ou votre base de données dans Notion (ex: votre base de films ou de jeux).
2. Cliquez sur les **trois petits points `•••`** en haut à droite de la page.
3. Descendez tout en bas du menu jusqu'à **« Connexions »** (*Connections*) ou **« Ajouter des connexions »**.
4. Recherchez et sélectionnez votre intégration **`Culture Tracker`**.
5. Répétez l'opération pour chacune des bases que vous souhaitez relier.

#### C. Récupérer l'identifiant (ID) d'une base Notion
1. Ouvrez la base Notion en pleine page dans votre navigateur.
2. Regardez l'URL dans la barre d'adresse :
   ```text
   https://www.notion.so/mon-espace/312aec4b87d98111b530d4af0c22d898?v=...
                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   ```
3. La suite de **32 caractères hexadécimaux** située juste avant le `?v=` est l'**ID de votre base**.

---

### 5. Configurer vos Clés dans l'Extension

1. Cliquez sur l'icône **Culture Tracker** dans la barre d'outils de Firefox (ou sur le bouton flottant sur Notion).
2. Cliquez sur l'icône d'engrenage **⚙️ Paramètres** en haut à droite.
3. Renseignez vos accès :
   * **Clé API TMDb** : Obtenez gratuitement votre clé v3 sur [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).
   * **Clé API Notion** : Votre jeton interne `secret_...` ou `ntn_...` copié à l'étape 4.A.
   * **Clé API TheGamesDB** : Obtenez gratuitement une clé sur [thegamesdb.net](https://thegamesdb.net/) (pour les jeux consoles et rétro).
   * **IDs de vos bases Notion** : Collez les IDs de vos bases correspondantes.
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
5. L'entrée apparaît instantanément dans votre base Notion en arrière-plan !
6. Appuyez sur **`Échap`** ou cliquez sur **`✕`** pour refermer le panneau.

### Mode 2 : Popup Classique
* Cliquez sur l'icône de l'extension dans la barre d'outils de Firefox depuis n'importe quel onglet pour une recherche rapide.
* Si l'onglet en cours est Notion, un bouton **`📍 Intégrer à la page`** vous permet de basculer sur le tiroir latéral en un clic.

---

## 🤖 Personnalisation pour n'importe quel Espace Notion

Cette extension n'est pas limitée à un template figé :
* **Déclaratif** : Tout le schéma (noms de colonnes, types `relation`, `select`, `multi_select`, etc.) est configuré dans [`config/schema.default.json`](./config/schema.default.json).
* **Adaptateur universel** : [`services/notion-adapter.js`](./services/notion-adapter.js) s'adapte automatiquement et ignore les colonnes absentes sans crasher.
* **Guide IA** : Consultez [`AGENTS.md`](./AGENTS.md) pour les instructions destinées aux agents IA (Cursor, Claude Code, Copilot, Antigravity) souhaitant adapter le projet en un prompt.

---

## 🧪 Tests & Développement

Pour exécuter la suite de tests automatisés (validation de l'adaptateur de types et du moteur de templates) :

```bash
# Vérifier la syntaxe de tous les fichiers JavaScript
node -c background.js content/notion-inject.js popup/popup.js services/*.js

# Lancer la suite de tests unitaires (25 tests)
node test/adapter.test.js
```

---

## 📄 Licence

Ce projet est sous licence [MIT](./LICENSE). Vous êtes libre de l'utiliser, de le modifier et de l'adapter à vos besoins personnels.
