# 🍿 Culture Tracker — Extension Firefox (TMDb, TheGamesDB & Notion)

Extension Firefox conçue sur mesure pour votre tableau de bord **Tracking Culture** dans Notion. Elle permet de rechercher n'importe quel film ou série (via **TMDb**) ainsi que des jeux vidéo multiplateformes (via **TheGamesDB**) et de les ajouter en 1 clic dans vos bases de données Notion avec leurs métadonnées, jaquettes officielles et **leurs templates de page Notion pré-remplis**.

---

## 🚀 Installation / Mise à jour dans Firefox

1. Ouvrez **Firefox**.
2. Dans la barre d'adresse, accédez à :
   ```text
   about:debugging#/runtime/this-firefox
   ```
3. Si l'extension est déjà chargée, cliquez simplement sur le bouton **« Recharger »** (*Reload*).
4. Si vous l'installez pour la première fois :
   * Cliquez sur **« Charger un module temporaire... »** (*Load Temporary Add-on*).
   * Sélectionnez le fichier `manifest.json` à la racine de ce dossier.

---

## 🔑 Clés d'API & Services intégrés

Renseignez vos clés d'API dans l'onglet **Paramètres** de l'extension :
* **The Movie Database (TMDb)** : recherche de films et séries avec affiches, castings, nombre d'épisodes et fournisseurs de streaming français ([Obtenir une clé TMDb](https://www.themoviedb.org/settings/api)).
* **TheGamesDB** : recherche de jeux vidéo PC et consoles (PlayStation, Xbox, Nintendo Switch, rétro...) avec jaquettes avant (boxart) et fonds d'écran (fanart) ([Obtenir une clé TheGamesDB](https://thegamesdb.net/)).
* **Steam Storefront API** : recherche et complétion de jeux vidéo PC Steam (aucune clé requise).
* **Notion API** : création automatique des entrées et application des modèles de page ([Créer une intégration Notion](https://www.notion.so/my-integrations)).

---

## 📄 Application des Templates de Page Notion

L'extension reproduit fidèlement la structure interne de vos modèles de page :

### 🎮 Jeux Vidéo (Modèle "Game Title Here")
* **Colonne gauche** :
  * Titre bleu `Game Cover Image` + Jaquette officielle TheGamesDB / Steam
  * Titres bleus déroulants : `DLC`, `Walkthrough Link`, `Useful Guides `, `Favorite Soundtracks`
* **Colonne droite** :
  * Titre bleu `Game Summary` + Résumé officiel du jeu
  * Titre bleu `Game Reflection`
  * Sections déroulantes `Pros` (3 puces) et `Cons` (3 puces)
* **Relations et propriétés automatiques** :
  * `Game Platform` : liaison directe avec votre base Notion (Steam, Switch, PS5, PS4, Xbox One, NES, SNES, etc.)
  * `Genres` : liaison avec votre base dédiée de 58 genres (Action, RPG, Metroidvania, Roguelike, etc.)
  * `Game Status`, `Overall Rating`, `Player Support` (Singleplayer, Multi...), `Copy` (Digital / Physical), `Year Played`
* **Base Notion** : `All Games` (`312aec4b-87d9-815b-bf60-d3fc5847d424`)

### 📺 Séries TV (Modèle "TV Title")
* **Colonne gauche** : `TV Show Cover` + Affiche TMDb + `Screenshots`
* **Colonne droite** : `TV Show Summary` + Synopsis TMDb + `Thoughts` + `Standouts`
* **Base Notion** : [`All TV Shows`](https://app.notion.com/p/312aec4b87d9812882c4fa8ad991cf87)

### 🎥 Films (Modèle "Movie Title")
* **Colonne gauche** : `Movie Cover` + Affiche TMDb + `Screenshots`
* **Colonne droite** : `Movie Summary` + Synopsis TMDb + `Thoughts` + `Standouts`
* **Base Notion** : [`All Movies`](https://app.notion.com/p/312aec4b87d98111b530d4af0c22d898)
