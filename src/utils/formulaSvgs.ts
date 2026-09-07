/**
 * Biblioteca Vetorial de Fórmulas Matemáticas em SVG (Padrão Energisa / ANEEL / IEEE)
 * Substitui imagens PNG bitmap por vetores matemáticos puros com resolução infinita,
 * adaptabilidade a tema claro/escuro e renderização cristalina em alta resolução no Laudo PDF.
 */

export type FormulaKey =
  | 'in_trifasica'
  | 'in_monofasica'
  | 'potencia_carregamento'
  | 'prodist_fdtp'
  | 'desequilibrio_bt';

/**
 * Retorna a string SVG com as cores apropriadas.
 * Se for para PDF, usa fundo branco e traços escuros (#0f172a / #1e3a8a).
 * Se for para Web, usa currentColor para herdar a cor do tema (Dark/Light).
 */
export function getFormulaSvgString(key: FormulaKey, forPdf = false): string {
  const mainColor = forPdf ? '#0f172a' : 'currentColor';
  const subColor = forPdf ? '#1e3a8a' : '#0284c7';
  const mutedColor = forPdf ? '#475569' : '#64748b';
  const alertColor = forPdf ? '#b45309' : '#d97706';
  const bgColor = forPdf ? '#ffffff' : 'transparent';

  switch (key) {
    case 'in_trifasica':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 95" width="100%" height="100%">
        <rect width="100%" height="100%" fill="${bgColor}" />
        <style>
          .var { font-family: 'Cambria Math', 'STIX Two Math', 'Times New Roman', serif; font-style: italic; font-weight: bold; }
          .sub { font-family: 'Segoe UI', Arial, sans-serif; font-style: normal; font-size: 13px; font-weight: bold; }
          .unit { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: normal; fill: ${mutedColor}; }
          .sym { font-family: 'Segoe UI', Arial, sans-serif; font-size: 20px; font-weight: bold; }
        </style>
        
        <!-- I_N = -->
        <text x="25" y="53" class="var" font-size="28" fill="${mainColor}">I</text>
        <text x="39" y="60" class="sub" fill="${mainColor}">N</text>
        <text x="58" y="52" class="sym" fill="${mainColor}">=</text>

        <!-- Fração 1: S / (√3 × V) -->
        <text x="120" y="34" class="var" font-size="22" fill="${subColor}">S</text>
        <text x="135" y="38" class="sub" font-size="11" fill="${subColor}">nom</text>
        <text x="165" y="34" class="unit">[kVA]</text>

        <line x1="82" y1="44" x2="225" y2="44" stroke="${mainColor}" stroke-width="2" />

        <!-- Raiz quadrada de 3 -->
        <path d="M 88 66 L 93 66 L 97 75 L 104 53 L 119 53" fill="none" stroke="${mainColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        <text x="107" y="68" class="sym" font-size="16" fill="${mainColor}">3</text>
        
        <text x="126" y="66" class="sym" font-size="16" fill="${mainColor}">×</text>
        
        <text x="142" y="67" class="var" font-size="22" fill="${subColor}">V</text>
        <text x="156" y="72" class="sub" font-size="11" fill="${subColor}">sec</text>
        <text x="180" y="67" class="unit">[kV]</text>

        <text x="238" y="52" class="sym" fill="${mainColor}">=</text>

        <!-- Fração 2: com 1,732 -->
        <text x="300" y="34" class="var" font-size="22" fill="${subColor}">S</text>
        <text x="315" y="38" class="sub" font-size="11" fill="${subColor}">nom</text>
        <text x="345" y="34" class="unit">[kVA]</text>

        <line x1="262" y1="44" x2="415" y2="44" stroke="${mainColor}" stroke-width="2" />

        <text x="270" y="68" class="sym" font-size="16" fill="${mainColor}">1,732</text>
        <text x="316" y="66" class="sym" font-size="16" fill="${mainColor}">×</text>
        <text x="332" y="67" class="var" font-size="22" fill="${subColor}">V</text>
        <text x="346" y="72" class="sub" font-size="11" fill="${subColor}">sec</text>
        <text x="370" y="67" class="unit">[kV]</text>

        <text x="435" y="52" class="unit" font-weight="bold" font-size="14" fill="${mainColor}">[ A ]</text>
      </svg>`;

    case 'in_monofasica':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 95" width="100%" height="100%">
        <rect width="100%" height="100%" fill="${bgColor}" />
        <style>
          .var { font-family: 'Cambria Math', 'STIX Two Math', 'Times New Roman', serif; font-style: italic; font-weight: bold; }
          .sub { font-family: 'Segoe UI', Arial, sans-serif; font-style: normal; font-size: 13px; font-weight: bold; }
          .unit { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: normal; fill: ${mutedColor}; }
          .sym { font-family: 'Segoe UI', Arial, sans-serif; font-size: 20px; font-weight: bold; }
        </style>
        
        <!-- I_N = -->
        <text x="30" y="53" class="var" font-size="28" fill="${mainColor}">I</text>
        <text x="44" y="60" class="sub" fill="${mainColor}">N</text>
        <text x="65" y="52" class="sym" fill="${mainColor}">=</text>

        <!-- Numerador -->
        <text x="145" y="34" class="var" font-size="22" fill="${subColor}">S</text>
        <text x="160" y="38" class="sub" font-size="11" fill="${subColor}">nom</text>
        <text x="190" y="34" class="unit">[kVA]</text>

        <line x1="95" y1="44" x2="250" y2="44" stroke="${mainColor}" stroke-width="2" />

        <!-- Denominador -->
        <text x="145" y="68" class="var" font-size="22" fill="${subColor}">V</text>
        <text x="159" y="73" class="sub" font-size="11" fill="${subColor}">sec</text>
        <text x="185" y="68" class="unit">[kV]</text>

        <text x="275" y="52" class="sym" fill="${mainColor}">=</text>

        <text x="300" y="34" class="var" font-size="22" fill="${subColor}">S</text>
        <text x="315" y="34" class="unit">× 1000</text>

        <line x1="295" y1="44" x2="385" y2="44" stroke="${mainColor}" stroke-width="2" />

        <text x="320" y="68" class="var" font-size="22" fill="${subColor}">V</text>
        <text x="334" y="73" class="sub" font-size="11" fill="${subColor}">sec(V)</text>

        <text x="405" y="52" class="unit" font-weight="bold" font-size="14" fill="${mainColor}">[ A ]</text>
      </svg>`;

    case 'potencia_carregamento':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 115" width="100%" height="100%">
        <rect width="100%" height="100%" fill="${bgColor}" />
        <style>
          .var { font-family: 'Cambria Math', 'STIX Two Math', 'Times New Roman', serif; font-style: italic; font-weight: bold; }
          .sub { font-family: 'Segoe UI', Arial, sans-serif; font-style: normal; font-size: 12px; font-weight: bold; }
          .unit { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; fill: ${mutedColor}; }
          .sym { font-family: 'Segoe UI', Arial, sans-serif; font-size: 18px; font-weight: bold; }
          .label { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: bold; fill: ${subColor}; }
        </style>

        <!-- Linha 1: Potência Aparente Trifásica -->
        <text x="20" y="35" class="var" font-size="22" fill="${mainColor}">S</text>
        <text x="35" y="40" class="sub" fill="${mainColor}">tri</text>
        <text x="56" y="34" class="sym" fill="${mainColor}">=</text>

        <path d="M 72 32 L 76 32 L 80 40 L 86 21 L 99 21" fill="none" stroke="${mainColor}" stroke-width="1.6" stroke-linecap="round" />
        <text x="88" y="33" class="sym" font-size="15" fill="${mainColor}">3</text>
        <text x="106" y="34" class="sym" font-size="15" fill="${mainColor}">×</text>
        <text x="122" y="34" class="var" font-size="20" fill="${subColor}">V</text>
        <text x="135" y="39" class="sub" font-size="10" fill="${subColor}">med</text>
        <text x="160" y="34" class="sym" font-size="15" fill="${mainColor}">×</text>
        <text x="176" y="34" class="var" font-size="20" fill="${subColor}">I</text>
        <text x="184" y="39" class="sub" font-size="10" fill="${subColor}">med</text>

        <text x="220" y="34" class="sym" fill="${mainColor}">=</text>

        <!-- Numerador por fase -->
        <text x="245" y="24" class="var" font-size="15" fill="${subColor}">V</text>
        <text x="255" y="27" class="sub" font-size="9" fill="${subColor}">AN</text>
        <text x="270" y="24" class="sym" font-size="12" fill="${mainColor}">·</text>
        <text x="276" y="24" class="var" font-size="15" fill="${subColor}">I</text>
        <text x="282" y="27" class="sub" font-size="9" fill="${subColor}">A</text>
        <text x="293" y="24" class="sym" font-size="13" fill="${mainColor}">+</text>
        <text x="306" y="24" class="var" font-size="15" fill="${subColor}">V</text>
        <text x="316" y="27" class="sub" font-size="9" fill="${subColor}">BN</text>
        <text x="331" y="24" class="sym" font-size="12" fill="${mainColor}">·</text>
        <text x="337" y="24" class="var" font-size="15" fill="${subColor}">I</text>
        <text x="343" y="27" class="sub" font-size="9" fill="${subColor}">B</text>
        <text x="354" y="24" class="sym" font-size="13" fill="${mainColor}">+</text>
        <text x="367" y="24" class="var" font-size="15" fill="${subColor}">V</text>
        <text x="377" y="27" class="sub" font-size="9" fill="${subColor}">CN</text>
        <text x="392" y="24" class="sym" font-size="12" fill="${mainColor}">·</text>
        <text x="398" y="24" class="var" font-size="15" fill="${subColor}">I</text>
        <text x="404" y="27" class="sub" font-size="9" fill="${subColor}">C</text>

        <line x1="238" y1="31" x2="415" y2="31" stroke="${mainColor}" stroke-width="1.8" />
        <text x="312" y="44" class="sym" font-size="14" fill="${mainColor}">1000</text>
        <text x="425" y="34" class="unit" font-weight="bold">[ kVA ]</text>

        <!-- Linha 2: Carregamento de Fase e Pico -->
        <text x="20" y="90" class="label">Carregamento da Fase:</text>
        <text x="175" y="90" class="var" font-size="20" fill="${mainColor}">%I</text>
        <text x="195" y="94" class="sub" font-size="10" fill="${mainColor}">fase</text>
        <text x="220" y="89" class="sym" fill="${mainColor}">=</text>

        <text x="245" y="78" class="var" font-size="18" fill="${subColor}">I</text>
        <text x="252" y="82" class="sub" font-size="10" fill="${subColor}">fase</text>
        <line x1="238" y1="86" x2="280" y2="86" stroke="${mainColor}" stroke-width="1.8" />
        <text x="245" y="101" class="var" font-size="18" fill="${mainColor}">I</text>
        <text x="252" y="105" class="sub" font-size="10" fill="${mainColor}">N</text>

        <text x="288" y="89" class="sym" font-size="15" fill="${mainColor}">×</text>
        <text x="304" y="89" class="sym" font-size="16" fill="${mainColor}">100 %</text>

        <!-- Pico -->
        <text x="380" y="90" class="label">Pico:</text>
        <text x="415" y="90" class="var" font-size="18" fill="${alertColor}">%I</text>
        <text x="435" y="94" class="sub" font-size="10" fill="${alertColor}">pico</text>
        <text x="460" y="89" class="sym" fill="${mainColor}">=</text>
        <text x="475" y="89" class="sym" font-size="15" fill="${mainColor}">máx( %I</text>
        <text x="526" y="93" class="sub" font-size="10" fill="${mainColor}">A</text>
        <text x="535" y="89" class="sym" font-size="15" fill="${mainColor}">, %I</text>
        <text x="557" y="93" class="sub" font-size="10" fill="${mainColor}">B</text>
        <text x="566" y="89" class="sym" font-size="15" fill="${mainColor}">, %I</text>
        <text x="588" y="93" class="sub" font-size="10" fill="${mainColor}">C</text>
        <text x="597" y="89" class="sym" font-size="15" fill="${mainColor}"> )</text>
      </svg>`;

    case 'prodist_fdtp':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 120" width="100%" height="100%">
        <rect width="100%" height="100%" fill="${bgColor}" />
        <style>
          .var { font-family: 'Cambria Math', 'STIX Two Math', 'Times New Roman', serif; font-style: italic; font-weight: bold; }
          .sub { font-family: 'Segoe UI', Arial, sans-serif; font-style: normal; font-size: 11px; font-weight: bold; }
          .unit { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; fill: ${mutedColor}; }
          .sym { font-family: 'Segoe UI', Arial, sans-serif; font-size: 18px; font-weight: bold; }
          .beta { font-family: 'Cambria Math', serif; font-size: 24px; font-style: italic; font-weight: bold; }
        </style>

        <!-- Equação de Beta -->
        <text x="20" y="45" class="beta" fill="${subColor}">β</text>
        <text x="40" y="44" class="sym" fill="${mainColor}">=</text>

        <!-- Numerador de Beta -->
        <text x="75" y="32" class="var" font-size="16" fill="${mainColor}">V</text>
        <text x="86" y="35" class="sub" font-size="9" fill="${mainColor}">AB</text>
        <text x="100" y="27" class="sub" font-size="9" fill="${mainColor}">4</text>
        <text x="110" y="32" class="sym" font-size="14" fill="${mainColor}">+</text>
        <text x="122" y="32" class="var" font-size="16" fill="${mainColor}">V</text>
        <text x="133" y="35" class="sub" font-size="9" fill="${mainColor}">BC</text>
        <text x="147" y="27" class="sub" font-size="9" fill="${mainColor}">4</text>
        <text x="157" y="32" class="sym" font-size="14" fill="${mainColor}">+</text>
        <text x="169" y="32" class="var" font-size="16" fill="${mainColor}">V</text>
        <text x="180" y="35" class="sub" font-size="9" fill="${mainColor}">CA</text>
        <text x="194" y="27" class="sub" font-size="9" fill="${mainColor}">4</text>

        <line x1="65" y1="40" x2="208" y2="40" stroke="${mainColor}" stroke-width="1.8" />

        <!-- Denominador de Beta -->
        <text x="68" y="58" class="sym" font-size="15" fill="${mainColor}">(</text>
        <text x="75" y="57" class="var" font-size="16" fill="${mainColor}">V</text>
        <text x="86" y="60" class="sub" font-size="9" fill="${mainColor}">AB</text>
        <text x="100" y="52" class="sub" font-size="9" fill="${mainColor}">2</text>
        <text x="110" y="57" class="sym" font-size="14" fill="${mainColor}">+</text>
        <text x="122" y="57" class="var" font-size="16" fill="${mainColor}">V</text>
        <text x="133" y="60" class="sub" font-size="9" fill="${mainColor}">BC</text>
        <text x="147" y="52" class="sub" font-size="9" fill="${mainColor}">2</text>
        <text x="157" y="57" class="sym" font-size="14" fill="${mainColor}">+</text>
        <text x="169" y="57" class="var" font-size="16" fill="${mainColor}">V</text>
        <text x="180" y="60" class="sub" font-size="9" fill="${mainColor}">CA</text>
        <text x="194" y="52" class="sub" font-size="9" fill="${mainColor}">2</text>
        <text x="202" y="58" class="sym" font-size="15" fill="${mainColor}">)</text>
        <text x="208" y="50" class="sub" font-size="9" fill="${mainColor}">2</text>

        <!-- FDTP -->
        <text x="250" y="62" class="var" font-size="22" fill="${mainColor}">FDTP</text>
        <text x="310" y="62" class="unit" font-weight="bold">[%]</text>
        <text x="338" y="60" class="sym" fill="${mainColor}">=</text>

        <!-- Raiz principal -->
        <path d="M 358 60 L 364 60 L 370 85 L 380 18 L 540 18" fill="none" stroke="${mainColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

        <!-- Numerador dentro do radical -->
        <text x="390" y="44" class="sym" font-size="16" fill="${mainColor}">1 −</text>
        <path d="M 416 43 L 420 43 L 423 50 L 428 32 L 485 32" fill="none" stroke="${mainColor}" stroke-width="1.5" stroke-linecap="round" />
        <text x="435" y="44" class="sym" font-size="14" fill="${mainColor}">3 − 6β</text>

        <line x1="388" y1="52" x2="530" y2="52" stroke="${mainColor}" stroke-width="1.8" />

        <!-- Denominador dentro do radical -->
        <text x="390" y="72" class="sym" font-size="16" fill="${mainColor}">1 +</text>
        <path d="M 416 71 L 420 71 L 423 78 L 428 60 L 485 60" fill="none" stroke="${mainColor}" stroke-width="1.5" stroke-linecap="round" />
        <text x="435" y="72" class="sym" font-size="14" fill="${mainColor}">3 − 6β</text>

        <text x="548" y="60" class="sym" font-size="16" fill="${mainColor}">×</text>
        <text x="565" y="60" class="sym" font-size="18" fill="${mainColor}">100</text>

        <!-- Nota PRODIST -->
        <text x="20" y="105" class="unit" font-weight="bold" fill="${alertColor}">Critério Regulatório PRODIST: BT ≤ 3,0% | MT ≤ 2,0%</text>
      </svg>`;

    case 'desequilibrio_bt':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 95" width="100%" height="100%">
        <rect width="100%" height="100%" fill="${bgColor}" />
        <style>
          .var { font-family: 'Cambria Math', 'STIX Two Math', 'Times New Roman', serif; font-style: italic; font-weight: bold; }
          .sub { font-family: 'Segoe UI', Arial, sans-serif; font-style: normal; font-size: 12px; font-weight: bold; }
          .unit { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; fill: ${mutedColor}; }
          .sym { font-family: 'Segoe UI', Arial, sans-serif; font-size: 18px; font-weight: bold; }
          .crit { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; font-weight: bold; fill: ${alertColor}; }
        </style>

        <!-- Desvio % = -->
        <text x="25" y="53" class="var" font-size="24" fill="${mainColor}">ΔI</text>
        <text x="52" y="53" class="unit" font-weight="bold">[%]</text>
        <text x="80" y="52" class="sym" fill="${mainColor}">=</text>

        <!-- Numerador: máx |Ifase - Imed| -->
        <text x="110" y="34" class="sym" font-size="15" fill="${mainColor}">máx |</text>
        <text x="156" y="34" class="var" font-size="20" fill="${subColor}">I</text>
        <text x="164" y="38" class="sub" font-size="10" fill="${subColor}">fase</text>
        <text x="190" y="33" class="sym" font-size="16" fill="${mainColor}">−</text>
        <text x="208" y="34" class="var" font-size="20" fill="${subColor}">I</text>
        <text x="216" y="38" class="sub" font-size="10" fill="${subColor}">med</text>
        <text x="242" y="34" class="sym" font-size="15" fill="${mainColor}">|</text>

        <!-- Linha da fração -->
        <line x1="102" y1="44" x2="256" y2="44" stroke="${mainColor}" stroke-width="2" />

        <!-- Denominador: Imed -->
        <text x="168" y="68" class="var" font-size="20" fill="${mainColor}">I</text>
        <text x="176" y="73" class="sub" font-size="11" fill="${mainColor}">med</text>

        <text x="268" y="52" class="sym" font-size="16" fill="${mainColor}">×</text>
        <text x="286" y="52" class="sym" font-size="18" fill="${mainColor}">100</text>

        <!-- Limiar normativo 15% -->
        <text x="345" y="52" class="crit">≤ 15%</text>
        <text x="398" y="52" class="unit font-bold">(NDU 006 / NDU 007)</text>
      </svg>`;
  }
}

const svgDataUrlCache = new Map<string, string>();
const VALID_TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Converte um SVG em Data URL PNG de altíssima definição (300 DPI) para o jsPDF.
 * No navegador, utiliza um Canvas em alta escala.
 * No Node.js / testes CLI, utiliza fallback seguro em PNG válido.
 */
export async function getFormulaDataUrlForPdf(key: FormulaKey): Promise<string> {
  if (svgDataUrlCache.has(key)) {
    return svgDataUrlCache.get(key)!;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return VALID_TINY_PNG;
  }

  const svgXml = getFormulaSvgString(key, true);

  return new Promise((resolve) => {
    try {
      const img = new Image();
      const blob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        const scale = 3; // 3x para 300 DPI ultra nítido no PDF
        const canvas = document.createElement('canvas');
        canvas.width = (img.naturalWidth || 600) * scale;
        canvas.height = (img.naturalHeight || 120) * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          const pngUrl = canvas.toDataURL('image/png');
          svgDataUrlCache.set(key, pngUrl);
          resolve(pngUrl);
        } else {
          resolve(VALID_TINY_PNG);
        }
        URL.revokeObjectURL(url);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(VALID_TINY_PNG);
      };

      img.src = url;
    } catch {
      resolve(VALID_TINY_PNG);
    }
  });
}
