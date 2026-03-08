<div align="center">

# 🛒 Onlineshoplist

**Application de courses collaborative en temps réel, propulsée par Firebase.**

[![Live Demo](https://img.shields.io/badge/🌐%20Live%20Demo-momort02.github.io-4CAF50?style=for-the-badge)](https://momort02.github.io/Onlineshoplist)
[![Firebase](https://img.shields.io/badge/Firebase-10.12-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![JavaScript](https://img.shields.io/badge/Vanilla%20JS-ES%20Modules-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://github.com/momort02/Onlineshoplist)

<br/>

<img src="https://img.shields.io/badge/Auth-Firebase%20Auth-orange?style=flat-square&logo=firebase" />
<img src="https://img.shields.io/badge/DB-Firestore%20Realtime-orange?style=flat-square&logo=firebase" />
<img src="https://img.shields.io/badge/UI-Dark%20Theme-1a1e2a?style=flat-square" />
<img src="https://img.shields.io/badge/Mobile-First-6c8fff?style=flat-square" />

</div>

---

## 📖 Présentation

**Onlineshoplist** est une application web progressive de gestion de listes de courses, entièrement pensée pour le mobile. Contrairement à une simple liste locale, Onlineshoplist est **collaborative en temps réel** : plusieurs personnes peuvent modifier la même liste simultanément, voir les modifications à la volée, et partager leurs achats instantanément.

> Aucun framework frontend — uniquement HTML, CSS et JavaScript Vanilla (ES Modules) + Firebase pour le backend.

---

## ✨ Fonctionnalités

### 👤 Authentification
- Inscription et connexion par email / mot de passe via **Firebase Auth**
- Gestion des erreurs (email invalide, mot de passe incorrect, compte existant…)
- Session persistante entre les visites

### 📋 Gestion des listes
- **Listes multiples** : créez autant de listes que vous voulez
- Bascule rapide entre vos listes depuis la sidebar
- Suppression de liste avec nettoyage complet des articles en base
- Dernière liste active mémorisée localement

### 👥 Collaboration temps réel
- **Partage par lien** : générez un lien d'invitation unique (`?join=token`)
- Tout utilisateur avec le lien peut rejoindre et modifier la liste instantanément
- **Membres visibles** : avatars et compteur de participants affichés dans l'interface
- Chaque modification est attribuée à son auteur (nom affiché sur la carte article)
- Partage d'invitation via **WhatsApp** ou **SMS** en un tap

### 🛍️ Articles
- Ajout rapide : nom, quantité, catégorie, prix unitaire
- **10 catégories** prédéfinies avec emojis (Fruits & Légumes, Viandes, Boulangerie, Surgelés, Hygiène…)
- Modification complète via modale dédiée
- Suppression individuelle
- Case à cocher pour marquer un article comme acheté (effet barré + opacité)
- Groupement automatique par catégorie

### 💰 Budget
- Définition d'un budget par liste
- **Barre de progression** dynamique (verte → orange → rouge selon l'avancement)
- Total des dépenses calculé en temps réel sur les articles cochés
- Affichage du total général de la liste

### 🔍 Filtres
- Filtres rapides : **Tout / À acheter / Achetés**
- Filtres par **catégorie** (chips dynamiques générés selon les articles présents)

### 📤 Export & Partage
- Export de la liste formatée (avec emojis, catégories, prix, total)
- Envoi via **WhatsApp**, **SMS** ou copie dans le presse-papier

### 🎨 Interface
- **Thème sombre** complet
- Design mobile-first, responsive desktop
- Indicateur de synchronisation temps réel (🟢 en ligne / 🟠 sync / ⚫ hors-ligne)
- Notifications toast légères
- Animations d'entrée sur les cartes articles
- Support des zones sûres iOS (`safe-area-inset`)

---

## 🏗️ Architecture

```
Onlineshoplist/
├── index.html      # Structure complète de l'app (Auth, Sidebar, Header, Modals…)
├── style.css       # Thème sombre, layout, composants UI
└── script.js       # Logique métier ES Module (Firebase, Firestore, Auth, UI)
```

### Modèle de données Firestore

```
lists/{listId}
  ├── name            string
  ├── ownerId         string (uid)
  ├── ownerName       string
  ├── budget          number | null
  ├── shareToken      string  ← token unique d'invitation
  ├── members         map<uid, displayName>
  ├── createdAt       timestamp
  └── items/{itemId}
        ├── name          string
        ├── qty           number
        ├── category      string
        ├── price         number | null
        ├── done          boolean
        ├── addedBy       string (uid)
        ├── addedByName   string
        ├── editedBy      string | null
        ├── editedByName  string | null
        ├── createdAt     timestamp
        └── updatedAt     timestamp
```

---

## 🚀 Démo en ligne

👉 **[momort02.github.io/Onlineshoplist](https://momort02.github.io/Onlineshoplist)**

Créez un compte, ajoutez des articles, puis partagez le lien 🔗 à un proche pour tester la collaboration en temps réel.

---

## ⚙️ Installation & Configuration

### 1. Cloner le dépôt

```bash
git clone https://github.com/momort02/Onlineshoplist.git
cd Onlineshoplist
```

### 2. Créer un projet Firebase

1. Rendez-vous sur [console.firebase.google.com](https://console.firebase.google.com)
2. Créez un nouveau projet
3. Activez **Authentication** → méthode Email / Mot de passe
4. Activez **Firestore Database** en mode production

### 3. Configurer Firebase

Dans `script.js`, remplacez le bloc `FIREBASE_CONFIG` :

```js
const FIREBASE_CONFIG = {
  apiKey:            "VOTRE_API_KEY",
  authDomain:        "votre-projet.firebaseapp.com",
  projectId:         "votre-projet",
  storageBucket:     "votre-projet.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId:             "VOTRE_APP_ID",
};
```

### 4. Règles Firestore recommandées

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /lists/{listId} {
      allow read, write: if request.auth != null
        && request.auth.uid in resource.data.members;

      match /items/{itemId} {
        allow read, write: if request.auth != null
          && request.auth.uid in get(
              /databases/$(database)/documents/lists/$(listId)
             ).data.members;
      }
    }
  }
}
```

### 5. Lancer localement

Les ES Modules nécessitent un serveur HTTP (pas d'ouverture directe en `file://`) :

```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .
```

Ouvrez ensuite [http://localhost:8080](http://localhost:8080).

---

## 📖 Guide d'utilisation

| Étape | Action |
|---|---|
| 1 | Créez un compte ou connectez-vous |
| 2 | Une liste est créée automatiquement au premier accès |
| 3 | Ajoutez des articles via le formulaire en bas de page |
| 4 | Cochez un article pour le marquer comme acheté |
| 5 | Appuyez sur 🔗 pour générer un lien d'invitation |
| 6 | Appuyez sur ⬆ pour exporter la liste (WhatsApp, SMS, presse-papier) |
| 7 | Appuyez sur ✏ pour définir ou modifier le budget de la liste |

---

## 🛠️ Technologies

| Technologie | Usage |
|---|---|
| **HTML5** | Structure de l'interface |
| **CSS3** | Thème sombre, responsive, animations |
| **JavaScript ES Modules** | Logique métier, Firestore, Auth |
| **Firebase Auth 10.12** | Authentification email / mot de passe |
| **Cloud Firestore** | Base de données et synchronisation temps réel |
| **Google Fonts** | Syne (titres) + DM Sans (corps) |

> Aucune dépendance npm, aucun bundler — le projet est 100% statique et déployable sur GitHub Pages tel quel.

---

## 📜 Licence

Ce projet est distribué sous licence **MIT** — libre d'utilisation, modification et redistribution.

---

## 👤 Auteur

**Amaury Goemaere**  
GitHub : [@momort02](https://github.com/momort02)

---

<div align="center">

*Fait avec ❤️ — Firebase + Vanilla JS, sans compromis.*

</div>
