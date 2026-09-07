/**
 * Biblioteca Vetorial de Fórmulas Matemáticas em SVG (Padrão Energisa / ANEEL / IEEE)
 * Fórmulas matemáticas vetoriais compactas, perfeitamente dimensionadas,
 * sem corte de bordas, adaptáveis ao tema (Dark/Light) e com renderização
 * cristalina em alta resolução (300 DPI) para o Laudo Pericial PDF.
 */

export type FormulaKey =
  | 'in_trifasica'
  | 'in_monofasica'
  | 'potencia_carregamento'
  | 'prodist_fdtp'
  | 'desequilibrio_bt';

interface FormulaMeta {
  width: number;
  height: number;
}

export const FORMULA_DIMENSIONS: Record<FormulaKey, FormulaMeta> = {
  in_trifasica: { width: 380, height: 50 },
  in_monofasica: { width: 340, height: 50 },
  potencia_carregamento: { width: 460, height: 62 },
  prodist_fdtp: { width: 480, height: 68 },
  desequilibrio_bt: { width: 400, height: 50 }
};

/**
 * Retorna a string SVG com dimensões adequadas e cores apropriadas.
 * - forPdf = false: usa currentColor para herdar tema e estilo responsivo inline.
 * - forPdf = true: usa fundo branco e cores contrastantes com dimensões fixas em pixels.
 */
export function getFormulaSvgString(key: FormulaKey, forPdf = false): string {
  const mainColor = forPdf ? '#0f172a' : 'currentColor';
  const subColor = forPdf ? '#1e3a8a' : '#0284c7';
  const mutedColor = forPdf ? '#475569' : '#64748b';
  const alertColor = forPdf ? '#b45309' : '#d97706';
  const bgColor = forPdf ? '#ffffff' : 'transparent';

  const { width: W, height: H } = FORMULA_DIMENSIONS[key];

  const svgHeader = forPdf
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="auto" style="max-width: 100%; height: auto; max-height: ${H}px; display: block; margin: 0 auto;" preserveAspectRatio="xMidYMid meet">`;

  switch (key) {
    case 'in_trifasica':
      return `${svgHeader}
        <rect width="100%" height="100%" fill="${bgColor}" />
        <style>
          .var { font-family: 'Cambria Math', 'Times New Roman', serif; font-style: italic; font-weight: bold; }
          .sub { font-family: 'Segoe UI', Arial, sans-serif; font-style: normal; font-size: 9px; font-weight: bold; }
          .unit { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; font-weight: normal; fill: ${mutedColor}; }
          .sym { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; font-weight: bold; }
        </style>
        
        <!-- I_N = -->
        <text x="14" y="30" class="var" font-size="16" fill="${mainColor}">I</text>
        <text x="23" y="34" class="sub" fill="${mainColor}">N</text>
        <text x="36" y="29" class="sym" fill="${mainColor}">=</text>

        <!-- Fração 1: S / (√3 × V) -->
        <text x="82" y="19" class="var" font-size="14" fill="${subColor}">S</text>
        <text x="91" y="22" class="sub" fill="${subColor}">nom</text>
        <text x="113" y="19" class="unit">[kVA]</text>

        <line x1="56" y1="24" x2="152" y2="24" stroke="${mainColor}" stroke-width="1.3" />

        <!-- Radical 3 -->
        <path d="M 60 35 L 63 35 L 66 41 L 70 28 L 81 28" fill="none" stroke="${mainColor}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
        <text x="72" y="37" class="sym" font-size="11" fill="${mainColor}">3</text>
        
        <text x="86" y="36" class="sym" font-size="11" fill="${mainColor}">×</text>
        
        <text x="97" y="37" class="var" font-size="14" fill="${subColor}">V</text>
        <text x="106" y="40" class="sub" fill="${subColor}">sec</text>
        <text x="122" y="37" class="unit">[kV]</text>

        <text x="162" y="29" class="sym" fill="${mainColor}">=</text>

        <!-- Fração 2: com 1,732 -->
        <text x="216" y="19" class="var" font-size="14" fill="${subColor}">S</text>
        <text x="225" y="22" class="sub" fill="${subColor}">nom</text>
        <text x="247" y="19" class="unit">[kVA]</text>

        <line x1="182" y1="24" x2="295" y2="24" stroke="${mainColor}" stroke-width="1.3" />

        <text x="187" y="37" class="sym" font-size="11" fill="${mainColor}">1,732</text>
        <text x="220" y="36" class="sym" font-size="11" fill="${mainColor}">×</text>
        <text x="231" y="37" class="var" font-size="14" fill="${subColor}">V</text>
        <text x="240" y="40" class="sub" fill="${subColor}">sec</text>
        <text x="256" y="37" class="unit">[kV]</text>

        <text x="310" y="29" class="unit" font-weight="bold" font-size="11" fill="${mainColor}">[ A ]</text>
      </svg>`;

    case 'in_monofasica':
      return `${svgHeader}
        <rect width="100%" height="100%" fill="${bgColor}" />
        <style>
          .var { font-family: 'Cambria Math', 'Times New Roman', serif; font-style: italic; font-weight: bold; }
          .sub { font-family: 'Segoe UI', Arial, sans-serif; font-style: normal; font-size: 9px; font-weight: bold; }
          .unit { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; font-weight: normal; fill: ${mutedColor}; }
          .sym { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; font-weight: bold; }
        </style>
        
        <!-- I_N = -->
        <text x="16" y="30" class="var" font-size="16" fill="${mainColor}">I</text>
        <text x="25" y="34" class="sub" fill="${mainColor}">N</text>
        <text x="38" y="29" class="sym" fill="${mainColor}">=</text>

        <!-- Numerador 1 -->
        <text x="82" y="19" class="var" font-size="14" fill="${subColor}">S</text>
        <text x="91" y="22" class="sub" fill="${subColor}">nom</text>
        <text x="113" y="19" class="unit">[kVA]</text>

        <line x1="56" y1="24" x2="152" y2="24" stroke="${mainColor}" stroke-width="1.3" />

        <!-- Denominador 1 -->
        <text x="82" y="37" class="var" font-size="14" fill="${subColor}">V</text>
        <text x="91" y="40" class="sub" fill="${subColor}">sec</text>
        <text x="108" y="37" class="unit">[kV]</text>

        <text x="165" y="29" class="sym" fill="${mainColor}">=</text>

        <!-- Numerador 2 -->
        <text x="194" y="19" class="var" font-size="14" fill="${subColor}">S</text>
        <text x="204" y="19" class="unit">× 1000</text>

        <line x1="184" y1="24" x2="248" y2="24" stroke="${mainColor}" stroke-width="1.3" />

        <!-- Denominador 2 -->
        <text x="194" y="37" class="var" font-size="14" fill="${subColor}">V</text>
        <text x="203" y="40" class="sub" fill="${subColor}">sec(V)</text>

        <text x="268" y="29" class="unit" font-weight="bold" font-size="11" fill="${mainColor}">[ A ]</text>
      </svg>`;

    case 'potencia_carregamento':
      return `${svgHeader}
        <rect width="100%" height="100%" fill="${bgColor}" />
        <style>
          .var { font-family: 'Cambria Math', 'Times New Roman', serif; font-style: italic; font-weight: bold; }
          .sub { font-family: 'Segoe UI', Arial, sans-serif; font-style: normal; font-size: 8px; font-weight: bold; }
          .unit { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; fill: ${mutedColor}; }
          .sym { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: bold; }
          .label { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9.5px; font-weight: bold; fill: ${subColor}; }
        </style>

        <!-- Linha 1: Potência Aparente Trifásica -->
        <text x="14" y="20" class="var" font-size="14" fill="${mainColor}">S</text>
        <text x="23" y="23" class="sub" fill="${mainColor}">tri</text>
        <text x="36" y="19" class="sym" fill="${mainColor}">=</text>

        <path d="M 46 19 L 49 19 L 52 25 L 56 12 L 66 12" fill="none" stroke="${mainColor}" stroke-width="1.2" stroke-linecap="round" />
        <text x="58" y="21" class="sym" font-size="10" fill="${mainColor}">3</text>
        <text x="70" y="20" class="sym" font-size="10" fill="${mainColor}">×</text>
        <text x="80" y="20" class="var" font-size="13" fill="${subColor}">V</text>
        <text x="89" y="23" class="sub" font-size="7.5" fill="${subColor}">med</text>
        <text x="107" y="20" class="sym" font-size="10" fill="${mainColor}">×</text>
        <text x="117" y="20" class="var" font-size="13" fill="${subColor}">I</text>
        <text x="123" y="23" class="sub" font-size="7.5" fill="${subColor}">med</text>

        <text x="144" y="19" class="sym" fill="${mainColor}">=</text>

        <!-- Numerador por fase -->
        <text x="160" y="14" class="var" font-size="11" fill="${subColor}">V</text>
        <text x="167" y="17" class="sub" font-size="7" fill="${subColor}">AN</text>
        <text x="179" y="14" class="sym" font-size="9" fill="${mainColor}">·</text>
        <text x="183" y="14" class="var" font-size="11" fill="${subColor}">I</text>
        <text x="187" y="17" class="sub" font-size="7" fill="${subColor}">A</text>
        <text x="195" y="14" class="sym" font-size="10" fill="${mainColor}">+</text>
        <text x="204" y="14" class="var" font-size="11" fill="${subColor}">V</text>
        <text x="211" y="17" class="sub" font-size="7" fill="${subColor}">BN</text>
        <text x="223" y="14" class="sym" font-size="9" fill="${mainColor}">·</text>
        <text x="227" y="14" class="var" font-size="11" fill="${subColor}">I</text>
        <text x="231" y="17" class="sub" font-size="7" fill="${subColor}">B</text>
        <text x="239" y="14" class="sym" font-size="10" fill="${mainColor}">+</text>
        <text x="248" y="14" class="var" font-size="11" fill="${subColor}">V</text>
        <text x="255" y="17" class="sub" font-size="7" fill="${subColor}">CN</text>
        <text x="267" y="14" class="sym" font-size="9" fill="${mainColor}">·</text>
        <text x="271" y="14" class="var" font-size="11" fill="${subColor}">I</text>
        <text x="275" y="17" class="sub" font-size="7" fill="${subColor}">C</text>

        <line x1="156" y1="18" x2="283" y2="18" stroke="${mainColor}" stroke-width="1.2" />
        <text x="208" y="27" class="sym" font-size="9.5" fill="${mainColor}">1000</text>
        <text x="294" y="19" class="unit" font-weight="bold">[ kVA ]</text>

        <!-- Linha 2: Carregamento de Fase e Pico -->
        <text x="14" y="50" class="label">Carga Fase:</text>
        <text x="76" y="50" class="var" font-size="13" fill="${mainColor}">%I</text>
        <text x="90" y="53" class="sub" fill="${mainColor}">fase</text>
        <text x="108" y="49" class="sym" fill="${mainColor}">=</text>

        <text x="124" y="43" class="var" font-size="11" fill="${subColor}">I</text>
        <text x="129" y="45" class="sub" font-size="7" fill="${subColor}">fase</text>
        <line x1="120" y1="48" x2="148" y2="48" stroke="${mainColor}" stroke-width="1.1" />
        <text x="126" y="58" class="var" font-size="11" fill="${mainColor}">I</text>
        <text x="131" y="60" class="sub" font-size="7" fill="${mainColor}">N</text>

        <text x="154" y="49" class="sym" font-size="10" fill="${mainColor}">×</text>
        <text x="165" y="49" class="sym" font-size="10.5" fill="${mainColor}">100%</text>

        <text x="210" y="49" class="sym" fill="${mutedColor}">•</text>

        <!-- Pico -->
        <text x="226" y="50" class="label">Pico:</text>
        <text x="254" y="50" class="var" font-size="12" fill="${alertColor}">%I</text>
        <text x="267" y="53" class="sub" fill="${alertColor}">pico</text>
        <text x="285" y="49" class="sym" fill="${mainColor}">=</text>
        <text x="296" y="49" class="sym" font-size="10.5" fill="${mainColor}">máx( %I</text>
        <text x="335" y="52" class="sub" font-size="7" fill="${mainColor}">A</text>
        <text x="342" y="49" class="sym" font-size="10.5" fill="${mainColor}">, %I</text>
        <text x="358" y="52" class="sub" font-size="7" fill="${mainColor}">B</text>
        <text x="365" y="49" class="sym" font-size="10.5" fill="${mainColor}">, %I</text>
        <text x="381" y="52" class="sub" font-size="7" fill="${mainColor}">C</text>
        <text x="388" y="49" class="sym" font-size="10.5" fill="${mainColor}"> )</text>
      </svg>`;

    case 'prodist_fdtp':
      return `${svgHeader}
        <rect width="100%" height="100%" fill="${bgColor}" />
        <style>
          .var { font-family: 'Cambria Math', 'Times New Roman', serif; font-style: italic; font-weight: bold; }
          .sub { font-family: 'Segoe UI', Arial, sans-serif; font-style: normal; font-size: 7.5px; font-weight: bold; }
          .unit { font-family: 'Segoe UI', Arial, sans-serif; font-size: 8.5px; fill: ${mutedColor}; }
          .sym { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: bold; }
          .beta { font-family: 'Cambria Math', serif; font-size: 15px; font-style: italic; font-weight: bold; }
          .crit { font-family: 'Segoe UI', Arial, sans-serif; font-size: 8.5px; font-weight: bold; fill: ${alertColor}; }
        </style>

        <!-- Equação de Beta -->
        <text x="14" y="27" class="beta" fill="${subColor}">β</text>
        <text x="26" y="26" class="sym" fill="${mainColor}">=</text>

        <!-- Numerador de Beta -->
        <text x="44" y="19" class="var" font-size="10.5" fill="${mainColor}">V</text>
        <text x="51" y="21" class="sub" fill="${mainColor}">AB</text>
        <text x="61" y="16" class="sub" fill="${mainColor}">4</text>
        <text x="68" y="19" class="sym" font-size="9" fill="${mainColor}">+</text>
        <text x="76" y="19" class="var" font-size="10.5" fill="${mainColor}">V</text>
        <text x="83" y="21" class="sub" fill="${mainColor}">BC</text>
        <text x="93" y="16" class="sub" fill="${mainColor}">4</text>
        <text x="100" y="19" class="sym" font-size="9" fill="${mainColor}">+</text>
        <text x="108" y="19" class="var" font-size="10.5" fill="${mainColor}">V</text>
        <text x="115" y="21" class="sub" fill="${mainColor}">CA</text>
        <text x="125" y="16" class="sub" fill="${mainColor}">4</text>

        <line x1="38" y1="24" x2="135" y2="24" stroke="${mainColor}" stroke-width="1.2" />

        <!-- Denominador de Beta -->
        <text x="40" y="34" class="sym" font-size="10" fill="${mainColor}">(</text>
        <text x="45" y="34" class="var" font-size="10.5" fill="${mainColor}">V</text>
        <text x="52" y="36" class="sub" fill="${mainColor}">AB</text>
        <text x="62" y="31" class="sub" fill="${mainColor}">2</text>
        <text x="68" y="34" class="sym" font-size="9" fill="${mainColor}">+</text>
        <text x="76" y="34" class="var" font-size="10.5" fill="${mainColor}">V</text>
        <text x="83" y="36" class="sub" fill="${mainColor}">BC</text>
        <text x="93" y="31" class="sub" fill="${mainColor}">2</text>
        <text x="100" y="34" class="sym" font-size="9" fill="${mainColor}">+</text>
        <text x="108" y="34" class="var" font-size="10.5" fill="${mainColor}">V</text>
        <text x="115" y="36" class="sub" fill="${mainColor}">CA</text>
        <text x="125" y="31" class="sub" fill="${mainColor}">2</text>
        <text x="131" y="34" class="sym" font-size="10" fill="${mainColor}">)</text>
        <text x="135" y="30" class="sub" fill="${mainColor}">2</text>

        <!-- FDTP -->
        <text x="156" y="27" class="var" font-size="13" fill="${mainColor}">FDTP</text>
        <text x="194" y="27" class="unit" font-weight="bold">[%]</text>
        <text x="214" y="26" class="sym" fill="${mainColor}">=</text>

        <!-- Raiz principal -->
        <path d="M 228 26 L 232 26 L 235 41 L 241 10 L 332 10" fill="none" stroke="${mainColor}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />

        <!-- Numerador dentro do radical -->
        <text x="248" y="20" class="sym" font-size="10.5" fill="${mainColor}">1 −</text>
        <path d="M 264 20 L 266 20 L 268 24 L 271 14 L 305 14" fill="none" stroke="${mainColor}" stroke-width="1" stroke-linecap="round" />
        <text x="274" y="21" class="sym" font-size="9" fill="${mainColor}">3 − 6β</text>

        <line x1="246" y1="25" x2="326" y2="25" stroke="${mainColor}" stroke-width="1.1" />

        <!-- Denominador dentro do radical -->
        <text x="248" y="35" class="sym" font-size="10.5" fill="${mainColor}">1 +</text>
        <path d="M 264 35 L 266 35 L 268 39 L 271 29 L 305 29" fill="none" stroke="${mainColor}" stroke-width="1" stroke-linecap="round" />
        <text x="274" y="36" class="sym" font-size="9" fill="${mainColor}">3 − 6β</text>

        <text x="340" y="26" class="sym" font-size="10" fill="${mainColor}">×</text>
        <text x="350" y="26" class="sym" font-size="11" fill="${mainColor}">100</text>

        <!-- Nota PRODIST -->
        <text x="14" y="56" class="crit">Critério Regulatório PRODIST Módulo 8: BT ≤ 3,0% | MT ≤ 2,0%</text>
      </svg>`;

    case 'desequilibrio_bt':
      return `${svgHeader}
        <rect width="100%" height="100%" fill="${bgColor}" />
        <style>
          .var { font-family: 'Cambria Math', 'Times New Roman', serif; font-style: italic; font-weight: bold; }
          .sub { font-family: 'Segoe UI', Arial, sans-serif; font-style: normal; font-size: 8px; font-weight: bold; }
          .unit { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; fill: ${mutedColor}; }
          .sym { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: bold; }
          .crit { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; font-weight: bold; fill: ${alertColor}; }
        </style>

        <!-- Desvio % = -->
        <text x="14" y="29" class="var" font-size="15" fill="${mainColor}">ΔI</text>
        <text x="31" y="29" class="unit" font-weight="bold">[%]</text>
        <text x="48" y="28" class="sym" fill="${mainColor}">=</text>

        <!-- Numerador: máx |Ifase - Imed| -->
        <text x="68" y="19" class="sym" font-size="10" fill="${mainColor}">máx |</text>
        <text x="95" y="19" class="var" font-size="12" fill="${subColor}">I</text>
        <text x="100" y="21" class="sub" fill="${subColor}">fase</text>
        <text x="116" y="18" class="sym" font-size="10" fill="${mainColor}">−</text>
        <text x="127" y="19" class="var" font-size="12" fill="${subColor}">I</text>
        <text x="132" y="21" class="sub" fill="${subColor}">med</text>
        <text x="149" y="19" class="sym" font-size="10" fill="${mainColor}">|</text>

        <!-- Linha da fração -->
        <line x1="64" y1="24" x2="156" y2="24" stroke="${mainColor}" stroke-width="1.2" />

        <!-- Denominador: Imed -->
        <text x="104" y="37" class="var" font-size="12" fill="${mainColor}">I</text>
        <text x="109" y="39" class="sub" fill="${mainColor}">med</text>

        <text x="166" y="28" class="sym" font-size="10" fill="${mainColor}">×</text>
        <text x="176" y="28" class="sym" font-size="11" fill="${mainColor}">100</text>

        <!-- Limiar normativo 15% -->
        <text x="214" y="28" class="crit">≤ 15%</text>
        <text x="250" y="28" class="unit font-bold">(NDU 006 / NDU 007)</text>
      </svg>`;
  }
}

const svgDataUrlCache = new Map<string, string>();
const VALID_TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Converte um SVG em Data URL PNG de altíssima definição (300 DPI) para o jsPDF.
 * No navegador, utiliza um Canvas em alta escala respeitando exatamente o aspect ratio do SVG.
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
  const { width: origW, height: origH } = FORMULA_DIMENSIONS[key];

  return new Promise((resolve) => {
    try {
      const img = new Image();
      const blob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        const scale = 3; // 3x para 300 DPI ultra nítido no PDF
        const naturalW = img.naturalWidth || origW;
        const naturalH = img.naturalHeight || origH;

        const canvas = document.createElement('canvas');
        canvas.width = naturalW * scale;
        canvas.height = naturalH * scale;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, naturalW, naturalH);
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
