import initSqlJs, { Database as SqlDatabase } from 'sql.js';
import { TransformerSpec, PhaseType } from '../types';

/**
 * Utilitário para carregar, unir e processar bancos de dados SQLite (.sqlite / .db)
 * e arquivos JSON divididos em partes (ex: part1, part2 ou .001, .002).
 */

/**
 * Junta múltiplos Uint8Array ou ArrayBuffer em um único Uint8Array contínuo
 */
export function combineArrayBuffers(buffers: (ArrayBuffer | Uint8Array)[]): Uint8Array {
  const byteLengths = buffers.map((b) => (b instanceof Uint8Array ? b.byteLength : b.byteLength));
  const totalLength = byteLengths.reduce((acc, curr) => acc + curr, 0);
  const combined = new Uint8Array(totalLength);

  let offset = 0;
  for (let i = 0; i < buffers.length; i++) {
    const src = buffers[i];
    const view = src instanceof Uint8Array ? src : new Uint8Array(src);
    combined.set(view, offset);
    offset += view.byteLength;
  }

  return combined;
}

/**
 * Converte linhas de uma tabela SQLite em objetos TransformerSpec
 */
export function mapSqliteRowsToTransformers(
  columns: string[],
  values: any[][]
): TransformerSpec[] {
  const colIndexMap: Record<string, number> = {};
  columns.forEach((col, idx) => {
    colIndexMap[col.toLowerCase().trim()] = idx;
  });

  const getVal = (row: any[], possibleNames: string[], defaultVal: any = '') => {
    for (const name of possibleNames) {
      if (colIndexMap[name] !== undefined) {
        const val = row[colIndexMap[name]];
        if (val !== null && val !== undefined) return val;
      }
    }
    return defaultVal;
  };

  return values.map((row, idx) => {
    const rawId = getVal(row, ['id', 'codigo', 'cod', 'numero_serie', 'serial', 'tag'], `SQL-TRAFO-${idx + 1}`);
    const brand = getVal(row, ['brand', 'fabricante', 'marca', 'mfg'], 'Geral');
    const powerKva = parseFloat(getVal(row, ['powerkva', 'potencia_kva', 'potencia', 'kva', 'p_kva'], 45));
    const primaryV = parseFloat(getVal(row, ['primaryvoltagev', 'tensao_primaria', 'v_primaria', 'v1', 'primaria'], 13800));
    const secondaryV = parseFloat(getVal(row, ['secondaryvoltagev', 'tensao_secundaria', 'v_secundaria', 'v2', 'secundaria'], 220));
    const phaseRaw = String(getVal(row, ['phasetype', 'fase', 'tipo_fase', 'fases'], 'TRIFASICO')).toUpperCase();
    const phaseType: PhaseType = phaseRaw.includes('MONO')
      ? 'MONO'
      : phaseRaw.includes('BI')
      ? 'BIFASICO'
      : 'TRIFASICO';

    const impedance = parseFloat(getVal(row, ['impedancepercent', 'impedancia', 'z_percent', 'z', 'z_pct'], 4.5));
    const noLoadLossesW = parseFloat(getVal(row, ['noloadlossesw', 'perdas_vazio', 'p0', 'p_0', 'perda_p0'], 150));
    const loadLossesW = parseFloat(getVal(row, ['loadlossesw', 'perdas_carga', 'pk', 'p_k', 'perda_pk'], 750));
    const conductor = getVal(row, ['conductormaterial', 'material_enrolamento', 'material', 'condutor'], 'ALUMINIO');
    const category = getVal(row, ['category', 'categoria', 'situacao', 'estado', 'state'], 'RECONDICIONADO');
    const manufacturingDate = getVal(row, ['manufacturingdate', 'data_fabricacao', 'ano_fab', 'fab_date'], '');
    const dateAdded = getVal(row, ['dateadded', 'data_teste', 'data_ensaio', 'test_date'], new Date().toLocaleDateString('pt-BR'));
    const standardReference = getVal(row, ['standardreference', 'norma', 'referencia'], 'NBR 5440 / NBR 10295');

    return {
      id: String(rawId),
      powerKva: isNaN(powerKva) ? 45 : powerKva,
      primaryVoltageV: isNaN(primaryV) ? 13800 : primaryV,
      secondaryVoltageV: isNaN(secondaryV) ? 220 : secondaryV,
      phaseType,
      impedancePercent: isNaN(impedance) ? 4.5 : impedance,
      noLoadLossesW: isNaN(noLoadLossesW) ? 150 : noLoadLossesW,
      loadLossesW: isNaN(loadLossesW) ? 750 : loadLossesW,
      brand: String(brand),
      category: String(category) as any,
      state: String(category) as any,
      conductorMaterial: conductor.toUpperCase().includes('CU') || conductor.toUpperCase().includes('COBRE') ? 'COBRE' : 'ALUMINIO',
      manufacturingDate: String(manufacturingDate),
      dateAdded: String(dateAdded),
      standardReference: String(standardReference)
    };
  });
}

/**
 * Lê um banco SQLite (Uint8Array) usando sql.js em memória e extrai os transformadores
 */
export async function parseSqliteData(sqliteBuffer: Uint8Array): Promise<TransformerSpec[]> {
  try {
    const SQL = await initSqlJs({
      // Carrega o arquivo WASM da CDN oficial do sql.js para runtime no navegador
      locateFile: (file) => `https://sql.js.org/dist/${file}`
    });

    const db: SqlDatabase = new SQL.Database(sqliteBuffer);

    // Descobre as tabelas existentes no banco SQLite
    const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
    if (!tablesResult || tablesResult.length === 0 || !tablesResult[0].values) {
      db.close();
      return [];
    }

    const tableNames = tablesResult[0].values.map((v) => String(v[0]));
    let allTransformers: TransformerSpec[] = [];

    for (const tableName of tableNames) {
      const queryResult = db.exec(`SELECT * FROM "${tableName}";`);
      if (queryResult && queryResult.length > 0) {
        const columns = queryResult[0].columns;
        const values = queryResult[0].values;
        const trafos = mapSqliteRowsToTransformers(columns, values);
        allTransformers = [...allTransformers, ...trafos];
      }
    }

    db.close();
    return allTransformers;
  } catch (err) {
    console.error('Erro ao processar banco SQLite com sql.js:', err);
    throw err;
  }
}

/**
 * Une e interpreta múltiplos arquivos selecionados pelo usuário (partes de JSON ou SQLite)
 */
export async function processSplitFiles(files: File[]): Promise<TransformerSpec[]> {
  if (!files || files.length === 0) return [];

  // Ordena os arquivos pelo nome (ex: part1, part2, .001, .002)
  const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  const firstFile = sortedFiles[0];
  const isSqlite = sortedFiles.some((f) => f.name.toLowerCase().endsWith('.sqlite') || f.name.toLowerCase().endsWith('.db')) ||
                   firstFile.name.toLowerCase().includes('sqlite') ||
                   firstFile.name.toLowerCase().includes('.db');

  if (isSqlite) {
    // Carrega buffers de todas as partes e combina
    const buffers: Uint8Array[] = [];
    for (const file of sortedFiles) {
      const arrayBuffer = await file.arrayBuffer();
      buffers.push(new Uint8Array(arrayBuffer));
    }
    const combinedBuffer = combineArrayBuffers(buffers);
    return await parseSqliteData(combinedBuffer);
  } else {
    // Tenta ler como partes JSON ou texto concatenado
    let combinedText = '';
    const jsonItems: TransformerSpec[] = [];

    for (const file of sortedFiles) {
      const text = await file.text();
      try {
        // Se o arquivo individual for um JSON completo válido (array de itens)
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          jsonItems.push(...parsed);
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.transformers)) {
            jsonItems.push(...parsed.transformers);
          } else if (Array.isArray(parsed.data)) {
            jsonItems.push(...parsed.data);
          }
        }
      } catch {
        // Se não for JSON válido individual, concatena o texto bruto
        combinedText += text;
      }
    }

    if (jsonItems.length > 0) {
      return jsonItems;
    }

    if (combinedText.trim()) {
      try {
        const parsedCombined = JSON.parse(combinedText);
        if (Array.isArray(parsedCombined)) return parsedCombined;
        if (parsedCombined.transformers && Array.isArray(parsedCombined.transformers)) return parsedCombined.transformers;
        if (parsedCombined.data && Array.isArray(parsedCombined.data)) return parsedCombined.data;
      } catch (e) {
        console.error('Erro ao decodificar JSON unificado:', e);
      }
    }
  }

  return [];
}

/**
 * Tenta buscar automaticamente partes de arquivos no diretório estático /database/
 */
export async function fetchLocalDatabaseFolderFiles(): Promise<TransformerSpec[]> {
  const possiblePaths = [
    '/database/base-db.sqlite',
    '/database/base-db-part1.json',
    '/database/base-db-part2.json',
    '/database/transformador-db.json',
    '/database/transformador-db-part1.json',
    '/database/transformador-db-part2.json',
    '/database/transformador-db.part1.json',
    '/database/transformador-db.part2.json',
    '/database/base-db.part1.sqlite',
    '/database/base-db.part2.sqlite',
    '/database/base-db.sqlite.001',
    '/database/base-db.sqlite.002'
  ];

  let collectedTrafos: TransformerSpec[] = [];

  for (const path of possiblePaths) {
    try {
      const res = await fetch(path);
      if (res.ok) {
        if (path.endsWith('.sqlite') || path.endsWith('.db')) {
          const buffer = new Uint8Array(await res.arrayBuffer());
          const trafos = await parseSqliteData(buffer);
          if (trafos.length > 0) collectedTrafos.push(...trafos);
        } else if (path.endsWith('.json')) {
          const json = await res.json();
          if (Array.isArray(json)) {
            collectedTrafos.push(...json);
          } else if (json && Array.isArray(json.transformers)) {
            collectedTrafos.push(...json.transformers);
          }
        }
      }
    } catch {
      // Ignora rotas não encontradas
    }
  }

  return collectedTrafos;
}
