import type { AdvisorPersona, EvaluationCriterion } from "./types.js";
import { ADVISORS } from "./personas.js";

// ─── Simulation Mode ───
// When no LLM provider is configured, return a structured prompt
// that the calling AI agent executes using its own intelligence.

export function buildCouncilSimulation(
  question: string,
  advisorIds: string[],
  fastMode: boolean,
  context?: string,
): string {
  const advisors = advisorIds
    .map((id) => ADVISORS[id])
    .filter(Boolean);
  const list = fastMode ? advisors.slice(0, 3) : advisors;

  const advisorSections = list
    .map(
      (a: AdvisorPersona) => `### ${a.emoji} ${a.name}

**Karakter:** ${a.description}

**Odak açıları:**
${a.focusAreas.map((f: string) => `- ${f}`).join("\n")}

**Ses tonu:** ${a.systemPrompt.slice(0, 200)}
`,
    )
    .join("\n");

  const contextBlock = context ? `\n## Ek Bağlam\n${context}\n` : "";

  return `# 🤖 AI Orchestrator — Council Strategy

## Talimat
API anahtarı yapılandırılmadığı için bu değerlendirmeyi **kendi AI yeteneklerinle** gerçekleştireceksin. Aşağıdaki adımları sırayla uygula.

## Değerlendirilecek Karar
"${question}"${contextBlock}

## Kullanılacak Danışmanlar
${advisorSections}

---

## Aşama 1: Bağımsız Görüşler (Paralel)

Her danışman için aşağıdaki kuralları uygulayarak **150-200 kelimelik** bir değerlendirme yaz:

1. **${list[0]?.name ?? "Advisor 1"}** — ${list[0]?.description ?? ""}
2. **${list[1]?.name ?? "Advisor 2"}** — ${list[1]?.description ?? ""}
${list[2] ? `3. **${list[2].name}** — ${list[2].description}` : ""}
${list[3] ? `4. **${list[3].name}** — ${list[3].description}` : ""}
${list[4] ? `5. **${list[4].name}** — ${list[4].description}` : ""}
${list[5] ? `6. **${list[5].name}** — ${list[5].description}` : ""}

**Önemli:** Her danışman diğerlerinin cevabını GÖRMEMELİ. Her birini ayrı bir oturumda değerlendiriyormuş gibi düşün. Dengeli olmaya çalışma — her danışman kendi bakış açısına tam yaslansın.

## Aşama 2: Anonim Akran Değerlendirmesi

Tüm cevapları topla. Hangisinin hangi danışmana ait olduğunu **gizle** (Danışman A, B, C, D, E olarak etiketle). Her danışmanın perspektifinden şu soruları cevapla:
- En güçlü argüman hangisi? Neden?
- En zayıf/riskli argüman hangisi? Neden?
- Hangi cevabın kör noktası var?

## Aşama 3: Başkan Sentezi

Şimdi BAŞKAN olarak tüm veriyi değerlendir. Aşağıdaki formatta kesin bir karar yaz:

> **AKIL KURULU KARARI**
>
> **Hemfikir Olunan Yer:** [ortak noktalar]
>
> **Çatışılan Yer:** [görüş ayrılıkları]
>
> **Kör Noktalar:** [kaçırılan unsurlar]
>
> **Tavsiye:** [net karar, "duruma bağlı" deme]
>
> **İlk Yapılması Gereken Tek Şey:** [somut adım]

---

Şimdi adımları uygula ve sonucu bu formatta döndür.`;
}

export function buildDebateSimulation(topic: string, rounds: number): string {
  return `# 🤖 AI Orchestrator — Debate Strategy

## Talimat
Bu tartışmayı **kendi AI yeteneklerinle** gerçekleştireceksin. Aşağıdaki rolleri canlandır:

## Tartışma Konusu
"${topic}"

## Format: ${rounds} Turlu Münazara

### Roller
- **🟢 PRO Savunucusu** — Lehte argümanlar. İkna edici, kanıta dayalı, güçlü.
- **🔴 KARŞI Savunucusu** — Aleyhte argümanlar. Eleştirel, kanıta dayalı, güçlü.
- **⚖️ Hakem** — Tarafsız değerlendirme, kazananı belirler.

### Tur 0: Açılış Konuşmaları
Hem PRO hem KARŞI 100-150 kelimelik açılış konuşması yapsın.

${Array.from({ length: rounds }, (_, i) => `### Tur ${i + 1}: Rebuttal
Her iki taraf da rakibinin bir önceki argümanına yanıt versin. Doğrudan karşı atağa geç, spesifik ol.`).join("\n\n")}

### Karar Turu
Hakem olarak değerlendir:
- Kim daha ikna ediciydi?
- Kanıt kalitesi hangi taraftaydı?
- Mantıksal tutarlılık?

**KAZANAN:** [PRO/KARŞI]
**GEREKÇE:** [2-3 cümle]

---

Şimdi tüm turları oyna ve sonucu bildir.`;
}

export function buildBrainstormSimulation(topic: string, targetCount: number): string {
  return `# 🤖 AI Orchestrator — Brainstorm Strategy

## Talimat
Beyin fırtınasını **kendi AI yeteneklerinle** gerçekleştireceksin.

## Konu
"${topic}"

## Aşama 1: Iraksak Düşünme (Fikir Üretimi)

4 farklı perspektiften ${targetCount} fikir üret:

### 🌙 Hayalperest
Sınırsız, yaratıcı, bilim-kurgu seviyesinde fikirler. Hiçbir kısıtlama yok.

### 💻 Korsan
Akıllı kestirmeler, growth hack'ler, sıra dışı çözümler. 80/20 kuralı.

### 🎨 Sanatçı
Estetik, deneyim, duygusal etki. İnsan merkezli, güzel, akılda kalıcı.

### 🚀 Füturist
5-10 yıl sonrası. Trendler, gelişen teknolojiler, paradigma değişimleri.

Her perspektiften 3-4 fikir. Toplam ${targetCount} fikir. Her fikir 1-2 cümle.

## Aşama 2: Yakınsak Düşünme (Değerlendirme)

Tüm fikirleri değerlendir:
1. **Puanla** — Her fikre yenilik (1-10) ve uygulanabilirlik (1-10) puanı ver
2. **Kümele** — Benzer fikirleri tematik gruplara ayır
3. **Seç** — En yüksek puanlı fikri "en iyi fikir" olarak belirle

## Sonuç Formatı

**En İyi Fikir:** [içerik]
**Puanı:** [yenilik]/10 + [uygulanabilirlik]/10

**Kümeler:**
- [Küme adı]: [fikirler]

**Tüm Fikirler:**
1. [fikir] (Y:8 U:6 = 7.0)

---

Şimdi tüm adımları uygula.`;
}

export function buildEvaluateSimulation(
  question: string,
  options: string[],
  criteria: EvaluationCriterion[],
  context?: string,
): string {
  const criteriaText = criteria
    .map((c) => `- **${c.name}** (ağırlık: ${c.weight}): ${c.description}`)
    .join("\n");

  const optionsText = options
    .map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`)
    .join("\n");

  const contextBlock = context ? `\n## Ek Bağlam\n${context}\n` : "";

  return `# 🤖 AI Orchestrator — Evaluate Strategy

## Talimat
Bu çok kriterli değerlendirmeyi **kendi AI yeteneklerinle** gerçekleştir.

## Değerlendirme Sorusu
"${question}"${contextBlock}

## Seçenekler
${optionsText}

## Kriterler
${criteriaText}

## Adımlar

### 1. Her Seçeneği Puanla
Her seçeneği her kriter için **1-10** arası puanla. Hesaplama: TOPLAM = Σ(puan × ağırlık)

### 2. Analiz Et
- Her seçeneğin güçlü ve zayıf yönlerini yaz
- En iyi seçeneği belirle

### 3. Sonuç Formatı
\`\`\`
Seçenek A: [toplam puan]
  + [kriter]: [puan]
  + Artılar: [...]
  + Eksiler: [...]

Seçenek B: [toplam puan]
  ...

KAZANAN: [seçenek]
ANALİZ: [gerekçe]
\`\`\`

---

Şimdi değerlendirmeyi yap.`;
}

export function buildSpecReviewSimulation(spec: string): string {
  return `# 🤖 AI Orchestrator — Spec Review Strategy

## Talimat
Bu spesifikasyon/plan incelemesini **kendi AI yeteneklerinle** gerçekleştir.

## İncelenecek Doküman
${spec}

## İnceleme Perspektifleri

Her perspektiften ayrı ayrı değerlendir:

### 🔒 Güvenlik
- Açık/zafiyet var mı?
- Veri maruziyeti?
- Yetkilendirme kontrolleri?
- Bağımlılık güvenliği?

### 🎨 Kullanıcı Deneyimi
- Kullanıcı yolculuğu tutarlı mı?
- Erişilebilirlik?
- Kavramsal yük?
- Keyif anları?

### ⚡ Performans
- Darboğazlar?
- Ölçeklenme?
- Önbellekleme stratejisi?
- Veritabanı sorguları?

### ⚙️ Operasyon
- Dağıtım/geri alma?
- İzleme?
- Hata senaryoları?
- Altyapı maliyeti?

### 📊 İş Değeri
- ROI?
- Pazar uyumu?
- Fırsat maliyeti?

## Format

### [Perspektif] İncelemesi
- ✅ İyi: ...
- ❌ Eksik: ...
- 🔧 Öneri: ...

## Risk Matrisi
| Kategori | Şiddet | Açıklama | Çözüm |
|---|---|---|---|
| ... | Critical/High/Medium/Low | ... | ... |

## Genel Puan: [1-10]
[2-3 cümle özet]

---

Şimdi spesifikasyonu satır satır incele.`;
}
