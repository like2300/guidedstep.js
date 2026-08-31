# GuidedStep JS

Bibliothèque **JavaScript zéro dépendance** pour créer des tutoriels et parcours d'onboarding interactifs et accessibles (a11y).

> Cible visible, étape par étape, 100 % responsive, accessible (ARIA + clavier), et un **bouton flottant de relance** grâce à `gs-player="true"`.

![version](https://img.shields.io/npm/v/guidedstep.js) ![license](https://img.shields.io/npm/l/guidedstep.js) ![npm](https://img.shields.io/npm/dt/guidedstep.js)

---

## ✨ Fonctionnalités

- 🎯 Mise en avant de la **cible visible** (avec recadrage / "cutout")
- 📱 100 % responsive
- ♿ Accessible (Focus piégé, attributs ARIA, navigation clavier)
- 🎨 Personnalisation CSS via variables (`--guidedstep-*`)
- 💾 Sauvegarde de la progression (localStorage)
- 🔁 **Bouton flottant de relance** (`gs-player="true"` sur le `<body>`)

---

## 📦 Installation

### Via npm

```bash
npm install guidedstep.js
```

Puis importez le CSS et le JS :

```html
<link rel="stylesheet" href="node_modules/guidedstep.js/guidedstep.css" />
<script src="node_modules/guidedstep.js/guidedstep.js"></script>
```

### Via CDN (jsDelivr)

```html
<script src="https://cdn.jsdelivr.net/npm/guidedstep.js@2.4.1/guidedstep.js"></script>
<link href="https://cdn.jsdelivr.net/npm/guidedstep.js@2.4.1/guidedstep.css" rel="stylesheet" />
```

### Mode local (CDN / hôte)

```html
<link rel="stylesheet" href="guidedstep.css" />
<script src="guidedstep.js"></script>
```

---

## 🚀 Utilisation de base

### 1. Attributs HTML `gs-*`

Ajoutez ces attributs directement sur les éléments du DOM à mettre en avant :

| Attribut | Description | Exemple |
|----------|-------------|---------|
| `gs-step` | Ordre numérique de l'étape dans le parcours. | `gs-step="1"` |
| `gs-title` | Titre affiché en haut de la carte du tutoriel. | `gs-title="Bienvenue"` |
| `gs-content` | Texte descriptif de l'étape (HTML basique autorisé). | `gs-content="Ceci est le menu"` |
| `gs-position` | Position préférée de la carte (`top`, `bottom`, `left`, `right`, `auto`). | `gs-position="bottom"` |
| `gs-transition` | Position de transition de la carte entre les étapes. | `gs-transition="right"` |

### 2. Le bouton flottant — `gs-player="true"`

Placez l'attribut **`gs-player="true"`** sur l'élément `<body>` pour afficher automatiquement un **bouton flottant** (FAB) **"Revoir le guide"** :

```html
<body gs-player="true">
```

- Le bouton apparaît à l'écran dès que le script est chargé.
- Un clic relance le tutoriel **depuis la première étape** (appelle `GuidedStep.restart()`).
- Il est automatiquement **masqué pendant** que le guide est actif, puis **réaffiché** à la fin (ou à l'abandon/skip).
- Totalement stylable via les variables CSS de la bibliothèque (classe `.guidedstep-fab`).

> ✅ L'attribut est **optionnel**. Sans lui, aucun bouton flottant n'est créé et le guide ne démarre que via JavaScript.

### 3. Initialisation JavaScript

```js
// 1. Initialiser avec les options souhaitées
GuidedStep.init({
  persist: true, // Sauvegarde la progression dans le localStorage
  overlayMode: 'blur', // 'color' = voile coloré | 'blur' = flou d'arrière-plan
  overlayBlur: 8, // Intensité du flou en px (mode 'blur')
  theme: {
    primaryColor: '#000000',
    borderRadius: '12px',
    overlayColor: 'rgba(0, 0, 0, 0.65)', // Voile en mode 'color'
    overlayTint: 'rgba(0, 0, 0, 0.3)', // Léger voile en mode 'blur'
  },
});

// 2. Démarrer le tutoriel (au chargement ou au clic d'un bouton)
document.getElementById('start-tour').addEventListener('click', () => {
  GuidedStep.start(0); // Commence à l'index 0
});
```

---

## ⚙️ API JavaScript

L'objet global `GuidedStep` est exposé sur `window`.

| Méthode | Description |
|---------|-------------|
| `GuidedStep.init(options)` | Initialise la configuration (optionnel, appelé automatiquement avec les défauts). |
| `GuidedStep.start(stepIndex)` | Démarre le tutoriel à l'index donné (défaut `0`). |
| `GuidedStep.stop()` | Alias de `skip()`, arrête le tutoriel. |
| `GuidedStep.restart()` | Arrête puis redémarre le tutoriel depuis la première étape. |
| `GuidedStep.next()` | Passe à l'étape suivante. |
| `GuidedStep.prev()` | Revient à l'étape précédente. |
| `GuidedStep.skip()` | Arrête le tutoriel (skippe). |
| `GuidedStep.goTo(index)` | Va directement à l'étape `index`. |
| `GuidedStep.parseSteps()` | Re-parse les étapes `[gs-step]` du DOM. |
| `GuidedStep.isActive()` | Retourne `true` si le guide est actif. |
| `GuidedStep.getCurrentStep()` | Retourne l'index de l'étape courante. |
| `GuidedStep.getSteps()` | Retourne la liste des étapes parsées. |

### Options de configuration

| Option | Type | Défaut | Description |
|--------|------|--------|-------------|
| `persist` | `boolean` | `true` | Sauvegarde la progression dans le `localStorage`. |
| `storageKey` | `string` | `"gs_state"` | Clé `localStorage` utilisée pour la persistance. |
| `autoScroll` | `boolean` | `true` | Active le défilement automatique vers la cible. |
| `scrollBehavior` | `string` | `"smooth"` | Comportement de défilement (`smooth`/`auto`). |
| `overlayMode` | `string` | `"color"` | `color` = voile coloré, `blur` = flou d'arrière-plan. |
| `overlayBlur` | `number` | `8` | Intensité du flou en px (mode `blur`). |
| `theme.primaryColor` | `string` | `"#141414"` | Couleur de la carte. |
| `theme.overlayColor` | `string` | `"rgba(253,253,252,0.85)"` | Voile en mode `color`. |
| `theme.overlayTint` | `string` | `"rgba(0,0,0,0.28)"` | Léger voile en mode `blur`. |
| `onStart` | `function` | `null` | Callback au démarrage. |
| `onComplete` | `function` | `null` | Callback à la fin du guide. |
| `onSkip` | `function` | `null` | Callback quand le guide est skippé. |
| `onElementMissing` | `function` | `null` | Callback si un élément cible est introuvable. |

---

## 🎨 Personnalisation CSS

Toutes les variables de thème sont exposées sur `:root` :

```css
:root {
  --guidedstep-primary: #141414;
  --guidedstep-radius: 12px;
  --guidedstep-overlay: rgba(253, 253, 252, 0.85);
  --gs-accent: #141414;
  --gs-veil: rgba(0, 0, 0, 0.28);
  --gs-overlay-blur: 8px;
}
```

La classe du bouton flottant de relance est **`.guidedstep-fab`**.

---

## 🧩 Intégration aux frameworks

Comme la bibliothèque fonctionne en `window.GuidedStep`, elle fonctionne avec n'importe quel framework (React, Vue, Angular) via un simple `<script>` ou un import du paquet. Vérifiez que `window.GuidedStep` est disponible avant de l'utiliser (par ex. dans `useEffect`/`onMounted`/`ngOnInit`).

---

## 🔗 Documentation complète

La documentation complète se trouve dans le dossier [`docs/`](docs/) — ouvrez `docs/index.html` dans votre navigateur.

---

## 📄 Licence

[MIT](LICENSE) © omerlinks
