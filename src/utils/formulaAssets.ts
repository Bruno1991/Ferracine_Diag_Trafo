/**
 * Utilitário de Carregamento de Fórmulas Vetoriais para o Laudo PDF
 * Converte as fórmulas matemáticas vetoriais em imagens de 300 DPI sob demanda,
 * eliminando a necessidade de arquivos PNG bitmap estáticos.
 */

import { getFormulaDataUrlForPdf } from './formulaSvgs';

export interface FormulaDataUrls {
  formulaInTrifasica: string;
  formulaInMonofasica: string;
  formulaPotenciaCarregamento: string;
  formulaProdistFdtp: string;
  formulaDesequilibrioBt: string;
}

/**
 * Pré-carrega de forma concorrente todas as fórmulas em alta resolução (300 DPI) para o Laudo PDF.
 */
export async function preloadAllFormulasForPdf(): Promise<FormulaDataUrls> {
  const [
    formulaInTrifasica,
    formulaInMonofasica,
    formulaPotenciaCarregamento,
    formulaProdistFdtp,
    formulaDesequilibrioBt
  ] = await Promise.all([
    getFormulaDataUrlForPdf('in_trifasica'),
    getFormulaDataUrlForPdf('in_monofasica'),
    getFormulaDataUrlForPdf('potencia_carregamento'),
    getFormulaDataUrlForPdf('prodist_fdtp'),
    getFormulaDataUrlForPdf('desequilibrio_bt')
  ]);

  return {
    formulaInTrifasica,
    formulaInMonofasica,
    formulaPotenciaCarregamento,
    formulaProdistFdtp,
    formulaDesequilibrioBt
  };
}
