<div align="center">
  <img src="../../app-icon.png" alt="Ícono de hajimi" width="120" height="120">
  <h1>hajimi</h1>
  <p>Aplicación de búsqueda de archivos para macOS más rápida y precisa.</p>
  <p>
    <a href="#usar-hajimi">Usar hajimi</a> ·
    <a href="#compilar-hajimi">Compilar hajimi</a>
  </p>
  <img src="UI.gif" alt="Vista previa de la interfaz de hajimi" width="720">
</div>

---

[English](../../README.md) · [Español](README.es-ES.md) · [한국어](README.ko-KR.md) · [Русский](README.ru-RU.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Português](README.pt-BR.md) · [Italiano](README.it-IT.md) · [日本語](README.ja-JP.md) · [Français](README.fr-FR.md) · [Deutsch](README.de-DE.md) · [Українська](README.uk-UA.md) · [العربية](README.ar-SA.md) · [हिन्दी](README.hi-IN.md) · [Türkçe](README.tr-TR.md)

## Usar hajimi

### Descarga

Descarga el paquete `.dmg` más reciente desde [GitHub Releases de hajimi](https://github.com/WaveF/hajimi/releases/).

### Soporte de i18n

¿Necesitas otro idioma? Haz clic en el botón ⚙️ de la barra de estado para cambiarlo al instante.

### Conceptos básicos de búsqueda

hajimi ahora incorpora una capa de sintaxis compatible con Everything sobre las coincidencias clásicas por subcadena/prefijo:

- `report draft` – el espacio actúa como `AND`, solo verás archivos cuyos nombres contengan ambos términos.
- `*.pdf briefing` – limita los resultados a PDF cuyo nombre incluya “briefing”.
- `*.zip size:>100MB` – busca archivos ZIP de más de 100MB.
- `in:/Users demo !.psd` – restringe la raíz de búsqueda a `/Users`, luego busca archivos cuyo nombre contenga `demo` pero excluya `.psd`.
- `tag:ProjectA;ProjectB` – filtra por etiquetas de Finder (macOS); `;` actúa como `OR`.
- `*.md content:"Bearer "` – muestra solo los Markdown que contengan la cadena `Bearer `.
- `"Application Support"` – usa comillas para coincidir frases exactas.
- `brary/Applicat` – usa `/` como separador de ruta para buscar subrutas, coincidiendo con directorios como `Library/Application Support`.
- `/report` · `draft/` · `/report/` – envuelve tokens con barras iniciales o finales para forzar coincidencias de prefijo, sufijo o nombre exacto cuando necesitas control de palabra completa más allá de la sintaxis de Everything.
- `~/**/.DS_Store` – el globstar (`**`) recorre todas las subcarpetas de tu carpeta de inicio para encontrar archivos `.DS_Store` sueltos.

Consulta el catálogo completo de operadores (agrupación booleana, alcance por carpeta, filtros por extensión, uso de regex y más ejemplos) en [`search-syntax.es-ES.md`](search-syntax.es-ES.md).

### Atajos de teclado y previsualizaciones

- `Cmd+Shift+Space` – activa o cierra la ventana de hajimi globalmente mediante el atajo rápido.
- `Cmd+,` – abre Preferencias.
- `Esc` – oculta la ventana de hajimi.
- `ArrowUp`/`ArrowDown` – mueve la selección.
- `Shift+ArrowUp`/`Shift+ArrowDown` – amplía la selección.
- `Space` – Quick Look de la fila seleccionada sin salir de hajimi.
- `Cmd+O` – abre el resultado seleccionado.
- `Cmd+R` – revela el resultado resaltado en Finder.
- `Cmd+C` – copia los archivos seleccionados al portapapeles.
- `Cmd+Shift+C` – copia las rutas seleccionadas al portapapeles.
- `Cmd+F` – devuelve el foco a la barra de búsqueda.
- `ArrowUp`/`ArrowDown` (en la barra de búsqueda) – recorre el historial de búsqueda.

¡Feliz búsqueda!

---

## Compilar hajimi

### Requisitos

- macOS 12+
- Toolchain de Rust
- Node.js 18+ con npm
- Xcode command-line tools y requisitos previos de Tauri (<https://tauri.app/start/prerequisites/>)

### Modo de desarrollo

```bash
cd cardinal
npm run tauri dev -- --release --features dev
```

### Compilación de producción

```bash
cd cardinal
npm run tauri build
```

## Agradecimientos

hajimi nació a partir de [Cardinal](https://github.com/cardisoft/cardinal). Muchas gracias a sus autores y colaboradores por dejarnos una base tan sólida; nosotros seguimos trasteando desde aquí.
