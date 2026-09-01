<div align="center">
  <img src="../../app-icon.png" alt="Icône de hajimi" width="120" height="120">
  <h1>hajimi</h1>
  <p>Application de recherche de fichiers pour macOS la plus rapide et la plus précise.</p>
  <p>
    <a href="#utiliser-hajimi">Utiliser hajimi</a> ·
    <a href="#compiler-hajimi">Compiler hajimi</a>
  </p>
  <img src="UI.gif" alt="Aperçu de l’interface hajimi" width="720">
</div>

---

[English](../../README.md) · [Español](README.es-ES.md) · [한국어](README.ko-KR.md) · [Русский](README.ru-RU.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Português](README.pt-BR.md) · [Italiano](README.it-IT.md) · [日本語](README.ja-JP.md) · [Français](README.fr-FR.md) · [Deutsch](README.de-DE.md) · [Українська](README.uk-UA.md) · [العربية](README.ar-SA.md) · [हिन्दी](README.hi-IN.md) · [Türkçe](README.tr-TR.md)

## Utiliser hajimi

### Téléchargement

Installez via Homebrew :

```bash
brew install --cask hajimi
```

Vous pouvez aussi récupérer les derniers paquets sur les [GitHub Releases de hajimi](https://github.com/WaveF/hajimi/releases/).

### Prise en charge i18n

Besoin d’une autre langue ? Cliquez sur le bouton ⚙️ dans la barre d’état pour changer instantanément.

### Principes de base de la recherche

hajimi ajoute désormais une couche de syntaxe compatible Everything en plus des correspondances classiques par sous-chaîne/préfixe :

- `report draft` – l’espace agit comme `AND`, vous ne voyez que les fichiers dont le nom contient les deux termes.
- `*.pdf briefing` – filtre les PDF dont le nom inclut « briefing ».
- `*.zip size:>100MB` – recherche des fichiers ZIP de plus de 100MB.
- `in:/Users demo !.psd` – limite la racine de recherche à `/Users`, puis cherche les fichiers dont le nom contient `demo` en excluant `.psd`.
- `tag:ProjectA;ProjectB` – filtre sur les tags Finder (macOS) ; `;` agit comme `OR`.
- `*.md content:"Bearer "` – n’affiche que les Markdown contenant la chaîne `Bearer `.
- `"Application Support"` – placez les phrases exactes entre guillemets.
- `brary/Applicat` – utilisez `/` comme séparateur pour chercher des sous-chemins, en correspondant à des dossiers comme `Library/Application Support`.
- `/report` · `draft/` · `/report/` – entourez les tokens de barres en début/fin pour forcer les correspondances de préfixe, suffixe ou nom exact lorsque vous avez besoin d’un contrôle mot à mot au-delà de la syntaxe Everything.
- `~/**/.DS_Store` – le globstar (`**`) descend dans tous les sous-dossiers de votre répertoire personnel pour trouver les `.DS_Store` égarés.

Consultez le catalogue complet des opérateurs (groupement booléen, périmètre de dossiers, filtres d’extension, usage des regex et autres exemples) dans [`search-syntax.fr-FR.md`](search-syntax.fr-FR.md).

### Raccourcis clavier et aperçus

- `Cmd+Shift+Space` – bascule la fenêtre hajimi globalement via le raccourci rapide.
- `Cmd+,` – ouvre les Préférences.
- `Esc` – masque la fenêtre hajimi.
- `ArrowUp`/`ArrowDown` – déplace la sélection.
- `Shift+ArrowUp`/`Shift+ArrowDown` – étend la sélection.
- `Space` – Quick Look de la ligne sélectionnée sans quitter hajimi.
- `Cmd+O` – ouvre le résultat sélectionné.
- `Cmd+R` – affiche le résultat sélectionné dans Finder.
- `Cmd+C` – copie les fichiers sélectionnés dans le presse-papiers.
- `Cmd+Shift+C` – copie les chemins sélectionnés dans le presse-papiers.
- `Cmd+F` – ramène le focus sur la barre de recherche.
- `ArrowUp`/`ArrowDown` (dans la barre de recherche) – parcourt l’historique de recherche.

Bonne recherche !

---

## Compiler hajimi

### Prérequis

- macOS 12+
- Toolchain Rust
- Node.js 18+ avec npm
- Outils en ligne de commande Xcode et prérequis Tauri (<https://tauri.app/start/prerequisites/>)

### Mode développement

```bash
cd cardinal
npm run tauri dev -- --release --features dev
```

### Build de production

```bash
cd cardinal
npm run tauri build
```

## Remerciements

hajimi s’appuie sur [Cardinal](https://github.com/cardisoft/cardinal). Nous remercions sincèrement les auteurs et contributeurs du projet original pour leur inspiration et leur travail fondateur.
