<div align="center">
  <img src="../../app-icon.png" alt="Иконка hajimi" width="120" height="120">
  <h1>hajimi</h1>
  <p>Самое быстрое и точное приложение для поиска файлов на macOS.</p>
  <p>
    <a href="#использование-hajimi">Использование hajimi</a> ·
    <a href="#сборка-hajimi">Сборка hajimi</a>
  </p>
  <img src="UI.gif" alt="Предпросмотр интерфейса hajimi" width="720">
</div>

---

[English](../../README.md) · [Español](README.es-ES.md) · [한국어](README.ko-KR.md) · [Русский](README.ru-RU.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Português](README.pt-BR.md) · [Italiano](README.it-IT.md) · [日本語](README.ja-JP.md) · [Français](README.fr-FR.md) · [Deutsch](README.de-DE.md) · [Українська](README.uk-UA.md) · [العربية](README.ar-SA.md) · [हिन्दी](README.hi-IN.md) · [Türkçe](README.tr-TR.md)

## Использование hajimi

### Загрузка

Установите через Homebrew:

```bash
brew install --cask hajimi
```

Свежие установочные пакеты можно взять на [GitHub Releases hajimi](https://github.com/WaveF/hajimi/releases/).

### Поддержка i18n

Нужен другой язык? Нажмите кнопку ⚙️ на статусной панели, чтобы мгновенно переключить интерфейс.

### Основы поиска

hajimi теперь поддерживает совместимую с Everything синтаксическую надстройку поверх классического поиска по подстроке/префиксу:

- `report draft` – пробел работает как `AND`, поэтому отображаются только файлы, имена которых содержат оба токена.
- `*.pdf briefing` – отфильтруйте PDF, в имени которых есть “briefing”.
- `*.zip size:>100MB` – ищите ZIP-файлы размером более 100MB.
- `in:/Users demo !.psd` – ограничьте корень поиска `/Users`, затем ищите файлы с `demo` в имени, исключая `.psd`.
- `tag:ProjectA;ProjectB` – фильтр по тегам Finder (macOS); `;` работает как `OR`.
- `*.md content:"Bearer "` – показывать только Markdown, содержащие строку `Bearer `.
- `"Application Support"` – берите точные фразы в кавычки.
- `brary/Applicat` – используйте `/` как разделитель пути для поиска подкаталогов, совпадая с путями вроде `Library/Application Support`.
- `/report` · `draft/` · `/report/` – добавляйте косые черты в начале или конце токена, чтобы принудить совпадения по префиксу, суффиксу или точному имени, когда нужен контроль на уровне слова, выходящий за рамки синтаксиса Everything.
- `~/**/.DS_Store` – `**` углубляется во все вложенные папки домашнего каталога, чтобы найти разбросанные `.DS_Store`.

Каталог поддерживаемых операторов (булева группировка, ограничение папок, фильтры по расширению, регулярные выражения и дополнительные примеры) смотрите в [`search-syntax.ru-RU.md`](search-syntax.ru-RU.md).

### Горячие клавиши и предпросмотры

- `Cmd+Shift+Space` – глобальная горячая клавиша для показа/скрытия окна hajimi.
- `Cmd+,` – открывает настройки.
- `Esc` – скрывает окно hajimi.
- `ArrowUp`/`ArrowDown` – перемещает выделение.
- `Shift+ArrowUp`/`Shift+ArrowDown` – расширяет выделение.
- `Space` – Quick Look выделенной строки, не выходя из hajimi.
- `Cmd+O` – открыть выбранный результат.
- `Cmd+R` – показать выбранный результат в Finder.
- `Cmd+C` – скопировать выбранные файлы в буфер обмена.
- `Cmd+Shift+C` – скопировать выбранные пути в буфер обмена.
- `Cmd+F` – вернуть фокус в поисковую строку.
- `ArrowUp`/`ArrowDown` (в строке поиска) – листает историю поиска.

Удачных поисков!

---

## Сборка hajimi

### Требования

- macOS 12+
- Инструментарий Rust
- Node.js 18+ с npm
- Инструменты командной строки Xcode и зависимости Tauri (<https://tauri.app/start/prerequisites/>)

### Режим разработки

```bash
cd cardinal
npm run tauri dev -- --release --features dev
```

### Продакшн-сборка

```bash
cd cardinal
npm run tauri build
```

## Благодарности

hajimi создан на основе [Cardinal](https://github.com/cardisoft/cardinal). Мы искренне благодарим авторов и участников исходного проекта за вдохновение и фундаментальную работу.
