<div align="center">
  <img src="../../app-icon.png" alt="hajimi simgesi" width="120" height="120">
  <h1>hajimi</h1>
  <p>macOS için en hızlı ve en doğru dosya arama uygulaması.</p>
  <p>
    <a href="#hajimii-kullanma">hajimi’i kullanma</a> ·
    <a href="#hajimii-derleme">hajimi’i derleme</a>
  </p>
  <img src="UI.gif" alt="hajimi arayüz önizlemesi" width="720">
</div>

---

[English](../../README.md) · [Español](README.es-ES.md) · [한국어](README.ko-KR.md) · [Русский](README.ru-RU.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Português](README.pt-BR.md) · [Italiano](README.it-IT.md) · [日本語](README.ja-JP.md) · [Français](README.fr-FR.md) · [Deutsch](README.de-DE.md) · [Українська](README.uk-UA.md) · [العربية](README.ar-SA.md) · [हिन्दी](README.hi-IN.md) · [Türkçe](README.tr-TR.md)

## hajimi’i kullanma

### İndirme

[hajimi GitHub Releases](https://github.com/WaveF/hajimi/releases/) üzerinden en güncel `.dmg` paketini indirin.

### i18n desteği

Farklı bir dil mi lazım? Durum çubuğundaki ⚙️ düğmesine tıklayarak anında değiştirin.

### Arama temelleri

hajimi artık klasik alt dize/ön ek eşleştirmesinin üzerine Everything uyumlu bir söz dizimi katmanı ekliyor:

- `report draft` – boşluk `AND` gibi davranır; yalnızca adında her iki belirteci de içeren dosyaları görürsünüz.
- `*.pdf briefing` – adında “briefing” geçen PDF sonuçlarını filtreler.
- `*.zip size:>100MB` – 100MB’den büyük ZIP dosyalarını arar.
- `in:/Users demo !.psd` – arama kökünü `/Users` ile sınırlar; ardından adında `demo` olanları bulur ama `.psd`’yi hariç tutar.
- `tag:ProjectA;ProjectB` – Finder etiketlerini (macOS) eşleştirir; `;` `OR` gibi çalışır.
- `*.md content:"Bearer "` – `Bearer ` dizgesini içeren Markdown dosyalarını filtreler.
- `"Application Support"` – tam ifadeler için tırnak kullanın.
- `brary/Applicat` – alt yol araması için `/` yol ayırıcısı olarak kullanılır; `Library/Application Support` gibi dizinlerle eşleşir.
- `/report` · `draft/` · `/report/` – belirtecin başına/sonuna `/` ekleyerek Everything söz diziminin ötesinde, ön ek, son ek veya tam ad eşleştirmesini zorlayın.
- `~/**/.DS_Store` – globstar (`**`) ev dizininizin altındaki tüm klasörlere iner ve her yerdeki `.DS_Store` dosyalarını bulur.

Desteklenen operatör kataloğu (mantıksal gruplama, klasör kapsamı, uzantı filtreleri, regex kullanımı ve daha fazla örnek) için [`search-syntax.tr-TR.md`](search-syntax.tr-TR.md) dosyasına bakın.

### Klavye kısayolları ve önizlemeler

- `Cmd+Shift+Space` – hızlı başlatma kısayoluyla hajimi penceresini global olarak aç/kapatın.
- `Cmd+,` – Tercihler’i açın.
- `Esc` – hajimi penceresini gizleyin.
- `ArrowUp`/`ArrowDown` – seçimi hareket ettirin.
- `Shift+ArrowUp`/`Shift+ArrowDown` – seçimi genişletin.
- `Space` – hajimi’den ayrılmadan seçili satırı Quick Look ile önizleyin.
- `Cmd+O` – seçili sonucu açın.
- `Cmd+R` – vurgulanan sonucu Finder’da gösterin.
- `Cmd+C` – seçili dosyaları panoya kopyalayın.
- `Cmd+Shift+C` – seçili yolları panoya kopyalayın.
- `Cmd+F` – odağı arama çubuğuna geri alın.
- `ArrowUp`/`ArrowDown` (arama çubuğunda) – arama geçmişinde gezin.

İyi aramalar!

---

## hajimi’i derleme

### Gereksinimler

- macOS 12+
- Rust toolchain
- npm’li Node.js 18+
- Xcode command-line tools ve Tauri prerequisites (<https://tauri.app/start/prerequisites/>)

### Geliştirme modu

```bash
cd cardinal
npm run tauri dev -- --release --features dev
```

### Üretim derlemesi

```bash
cd cardinal
npm run tauri build
```

## Teşekkür

hajimi, [Cardinal](https://github.com/cardisoft/cardinal) ile başladı. Böyle sağlam bir başlangıç hazırladıkları için özgün projenin yazarlarına ve katkıda bulunanlarına kocaman teşekkürler—buradan geliştirmeye devam ediyoruz.
