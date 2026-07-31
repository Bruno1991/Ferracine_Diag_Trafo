import { TransformerSpec, FuseRecommendation } from '../types';

/**
 * Banco de Dados de Transformadores NOVOS (Curva C - 24/06/2026)
 * Baseado na Norma ABNT NBR 5440 / NBR 5356 - Portaria INMETRO
 */
export const NEW_TRANSFORMERS_CURVA_C: TransformerSpec[] = [];

/**
 * Banco de Dados de Transformadores RECONDICIONADOS (10/04/2026)
 * Baseado na Norma ABNT NBR 10295 / NBR 5440 Recondicionados
 */
export const RECONDITIONED_TRANSFORMERS: TransformerSpec[] = [];

export const ALL_TRANSFORMERS: TransformerSpec[] = [
  ...NEW_TRANSFORMERS_CURVA_C,
  ...RECONDITIONED_TRANSFORMERS
];

/**
 * Matriz de Dimensionamento de Elo Fusível (NDUs / ETUs / Prodist)
 */
export const FUSE_LINK_MATRIX: FuseRecommendation[] = [];

/**
 * Citações Normativas e Fórmulas de Referência
 */
export const NORMATIVE_CITATIONS = {
  prodist: {
    title: 'PRODIST Módulo 8 - Qualidade da Energia Elétrica (ANEEL)',
    summary: 'Define os limites de variação da tensão em regime permanente para sistemas de distribuição de baixa e média tensão.',
    ranges: [
      { type: 'ADEQUADA', range: '0.93 * Vn <= V <= 1.05 * Vn', description: 'Tensão dentro do padrão aceitável de operação.' },
      { type: 'PRECARIA', range: '0.90 * Vn <= V < 0.93 * Vn  ou  1.05 * Vn < V <= 1.07 * Vn', description: 'Tensão sujeita a penalidades contratuais pela ANEEL e reajustes de TAP.' },
      { type: 'CRITICA', range: 'V < 0.90 * Vn  ou  V > 1.07 * Vn', description: 'Risco iminente de queima de equipamentos e perda de isolação.' }
    ],
    fdtpLimit: 'FDTP <= 2.0% (Fator de Desbalanço de Tensão da Componente Negativa)'
  },
  nduEtu: {
    title: 'Normas NDUs e ETUs - Especificações Técnicas de Distribuição',
    summary: 'Parametrização dos elos fusíveis de alta tensão (0.5H a 30K) para coordenação com curvas de suportabilidade térmica e eletrodinâmica do transformador (NBR 5356-2).',
  },
  iticCbema: {
    title: 'Curva ITIC (Information Technology Industry Council) / CBEMA',
    summary: 'Define o envelope de tolerância a afundamentos (sags) e elevações (swells) de tensão para cargas eletrônicas sensíveis em função da duração.',
  },
  formulas: [
    { name: 'Potência Aparente Medida (kVA)', formula: 'S (kVA) = √3 × V_fase-fase_média × I_média / 1000' },
    { name: 'Carregamento do Transformador (%)', formula: 'Carregamento (%) = (S_medida / S_nominal) × 100' },
    { name: 'Fator de Desbalanço de Tensão (FDTP %)', formula: 'FDTP (%) = (Máx. Desvio de V em relação à Média / V_média) × 100' },
    { name: 'Fator de Correção Térmica de Enrolamento (Kt)', formula: 'Kt = (Tk + T_óleo) / (Tk + 75°C)  →  Alumínio: Tk = 225,0°C | Cobre: Tk = 234,5°C' },
    { name: 'Perdas em Carga Ajustadas por Carga e Térmica (Pk_calc)', formula: 'Pk_calc (W) = Pk_75°C × (I_medida / I_nominal)² × Kt' },
    { name: 'Rendimento Calculado (η %)', formula: 'η (%) = [ (P_ativa) / (P_ativa + P0 + Pk_calc) ] × 100' }
  ]
};
