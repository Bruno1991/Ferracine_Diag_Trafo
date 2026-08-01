import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
  Zap
} from 'lucide-react';
import type {
  InmetroTransformerModel,
  PhaseType,
  TransformerCatalogSource,
  TransformerSpec
} from '../types';
import {
  getOfflineInmetroModels,
  processDatabaseFile
} from '../utils/sqliteAndSplitLoader';
import { isCommunityTransformer } from '../utils/githubSync';

interface DatabaseExplorerProps {
  transformers: TransformerSpec[];
  inmetroModels: InmetroTransformerModel[];
  onAddTransformer?: (newTrafo: TransformerSpec) => void;
  onUpdateTransformers?: (updated: TransformerSpec[]) => void;
  onInmetroModelsUpdated?: (updated: InmetroTransformerModel[]) => void;
}

const PAGE_SIZE = 100;

function formatNumber(value: number | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('pt-BR', { maximumFractionDigits: decimals });
}

function phaseLabel(phase: PhaseType): string {
  if (phase === 'MONOFASICO') return 'Monofásico';
  if (phase === 'BIFASICO') return 'Bifásico';
  return 'Trifásico';
}

function lossPair(noLoad: number | undefined, total: number | undefined): string {
  if (noLoad == null || total == null) return '—';
  return `${formatNumber(noLoad, 0)} / ${formatNumber(total, 0)} W`;
}

function ValidationBadge({ model }: { model: InmetroTransformerModel }) {
  const config = {
    COERENTE_ETU: ['Coerente ETU', 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800'],
    COERENTE_SEM_REFERENCIA_ETU: ['Coerente / sem par ETU', 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-800'],
    ACIMA_LIMITE_ETU: ['Revisar ETU', 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800'],
    DADOS_INCONSISTENTES: ['Inconsistente', 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-800'],
    SEM_DADOS_DE_PERDAS: ['Sem perdas no PBE', 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700']
  }[model.validationStatus];
  return (
    <span title={model.validationNote} className={`inline-flex px-1.5 py-0.5 rounded border text-[9px] font-bold whitespace-nowrap ${config[1]}`}>
      {config[0]}
    </span>
  );
}

export const DatabaseExplorer: React.FC<DatabaseExplorerProps> = ({
  transformers,
  inmetroModels,
  onUpdateTransformers = (_: TransformerSpec[]) => {},
  onInmetroModelsUpdated = (_: InmetroTransformerModel[]) => {}
}) => {
  const [catalogSource, setCatalogSource] = useState<TransformerCatalogSource>('INMETRO');
  const [mfgDateFilter, setMfgDateFilter] = useState('');
  const [testDateFilter, setTestDateFilter] = useState('');
  const [phaseType, setPhaseType] = useState<PhaseType | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const etuTransformers = useMemo(
    () => transformers.filter((item) => !isCommunityTransformer(item)),
    [transformers]
  );
  const fieldTransformers = useMemo(
    () => transformers.filter(isCommunityTransformer),
    [transformers]
  );

  const filteredInmetro = useMemo(() => inmetroModels.filter((item) => {
    if (phaseType !== 'ALL' && item.phaseType !== phaseType) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return [item.id, item.manufacturer, item.model || '', item.category, item.powerKva, item.voltageClassKv]
      .some((value) => String(value).toLowerCase().includes(term));
  }), [inmetroModels, phaseType, searchTerm]);

  const filteredTransformers = useMemo(() => {
    const source = catalogSource === 'ETU' ? etuTransformers : fieldTransformers;
    return source.filter((item) => {
      if (phaseType !== 'ALL' && item.phaseType !== phaseType) return false;
      if (catalogSource === 'FIELD') {
        if (mfgDateFilter && !(item.manufacturingDate || '').toLowerCase().includes(mfgDateFilter.toLowerCase())) return false;
        if (testDateFilter && !(item.dateAdded || '').toLowerCase().includes(testDateFilter.toLowerCase())) return false;
      }
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return [
        item.id,
        item.powerKva,
        item.primaryVoltageV,
        item.secondaryVoltageV,
        item.standardReference,
        item.brand || '',
        item.state || item.category
      ].some((value) => String(value).toLowerCase().includes(term));
    });
  }, [catalogSource, etuTransformers, fieldTransformers, phaseType, mfgDateFilter, testDateFilter, searchTerm]);

  const filteredCount = catalogSource === 'INMETRO' ? filteredInmetro.length : filteredTransformers.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const visibleInmetro = filteredInmetro.slice(pageStart, pageStart + PAGE_SIZE);
  const visibleTransformers = filteredTransformers.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => setPage(1), [catalogSource, phaseType, searchTerm, mfgDateFilter, testDateFilter]);
  useEffect(() => setPage((current) => Math.min(current, totalPages)), [totalPages]);

  const handleDatabaseUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setIsProcessingFiles(true);
    setUploadStatus(null);
    try {
      const parsedTrafos = await processDatabaseFile(files[0]);
      const importedInmetro = getOfflineInmetroModels();
      const map = new Map<string, TransformerSpec>();
      transformers.forEach((item) => map.set(item.id, item));
      parsedTrafos.forEach((item) => map.set(item.id, item));
      const merged = Array.from(map.values());
      localStorage.setItem('tx_analytix_transformers', JSON.stringify(merged));
      onUpdateTransformers(merged);
      onInmetroModelsUpdated(importedInmetro);
      setUploadStatus({
        type: 'success',
        message: `${parsedTrafos.length} perfis ETU e ${importedInmetro.length} modelos INMETRO carregados do SQLite.`
      });
    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: `Erro ao processar o banco SQLite: ${error instanceof Error ? error.message : 'formato inválido'}`
      });
    } finally {
      setIsProcessingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteSingleTransformer = (id: string) => {
    const updated = transformers.filter((item) => item.id !== id);
    localStorage.setItem('tx_analytix_transformers', JSON.stringify(updated));
    onUpdateTransformers(updated);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Transformadores cadastrados</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Catálogos INMETRO e ETU separados das placas cadastradas em campo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept=".sqlite,.db" onChange={handleDatabaseUpload} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingFiles}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold font-mono bg-blue-600 hover:bg-blue-700 text-white shadow-xs disabled:opacity-50"
          >
            {isProcessingFiles ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {isProcessingFiles ? 'Abrindo SQLite...' : 'Importar SQLite'}
          </button>
          <span className="px-2.5 py-1 rounded text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            {filteredCount} MODELOS
          </span>
        </div>
      </div>

      {uploadStatus && (
        <div className={`p-2.5 rounded border text-xs font-mono flex items-center gap-2 ${uploadStatus.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200' : 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-200'}`}>
          {uploadStatus.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {uploadStatus.message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar fabricante, modelo, kVA..."
          className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
        />
        <input
          type="text"
          value={mfgDateFilter}
          onChange={(event) => setMfgDateFilter(event.target.value)}
          placeholder="Data fabricação (campo)"
          disabled={catalogSource !== 'FIELD'}
          className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold disabled:opacity-45"
        />
        <input
          type="text"
          value={testDateFilter}
          onChange={(event) => setTestDateFilter(event.target.value)}
          placeholder="Data cadastro (campo)"
          disabled={catalogSource !== 'FIELD'}
          className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold disabled:opacity-45"
        />
        <select
          value={phaseType}
          onChange={(event) => setPhaseType(event.target.value as PhaseType | 'ALL')}
          className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
        >
          <option value="ALL">Todos os tipos de fase</option>
          <option value="TRIFASICO">Trifásicos</option>
          <option value="BIFASICO">Bifásicos</option>
          <option value="MONOFASICO">Monofásicos</option>
        </select>
        <select
          value={catalogSource}
          onChange={(event) => setCatalogSource(event.target.value as TransformerCatalogSource)}
          aria-label="Fonte da lista de transformadores"
          className="bg-blue-50 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-800 rounded px-2.5 py-1 text-xs font-bold text-blue-900 dark:text-blue-200 focus:border-blue-500 focus:outline-none"
        >
          <option value="INMETRO">INMETRO / PBE ({inmetroModels.length})</option>
          <option value="ETU">ETU 109.1 e 109.2 ({etuTransformers.length})</option>
          <option value="FIELD">Técnicos de campo ({fieldTransformers.length})</option>
        </select>
      </div>

      {catalogSource === 'INMETRO' && (
        <div className="rounded border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 px-3 py-2 text-[10px] text-blue-900 dark:text-blue-200">
          Fonte PBE de 24/06/2026 (novos) e 10/04/2026 (recondicionados). O número de etiqueta foi excluído. Eficiência indicativa calculada em carga nominal e FP=1. Linhas sem perdas no PDF não alimentam cálculos de diagnóstico.
        </div>
      )}

      <div className="overflow-x-auto rounded border border-slate-300 dark:border-slate-800">
        {catalogSource === 'INMETRO' ? (
          <InmetroTable models={visibleInmetro} />
        ) : (
          <TransformerTable
            transformers={visibleTransformers}
            source={catalogSource}
            onDelete={handleDeleteSingleTransformer}
          />
        )}
      </div>

      {filteredCount > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-mono">
            {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredCount)} de {filteredCount}
          </span>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="p-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-35"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-mono font-bold">Página {page} de {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} className="p-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-35"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
};

function InmetroTable({ models }: { models: InmetroTransformerModel[] }) {
  return (
    <table className="w-full text-left border-collapse text-xs">
      <thead><tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[9px]">
        <th className="py-2 px-2.5">Fabricante</th><th className="py-2 px-2.5">Situação</th><th className="py-2 px-2.5">Modelo PBE</th>
        <th className="py-2 px-2.5">Fase</th><th className="py-2 px-2.5">Potência</th><th className="py-2 px-2.5">Classe</th><th className="py-2 px-2.5">Pedestal</th>
        <th className="py-2 px-2.5">Nom. conv. P0 / Ptotal</th><th className="py-2 px-2.5">Nom. relig. P0 / Ptotal</th>
        <th className="py-2 px-2.5">Crít. conv. P0 / Ptotal</th><th className="py-2 px-2.5">Crít. relig. P0 / Ptotal</th>
        <th className="py-2 px-2.5">Pk derivada</th><th className="py-2 px-2.5">η ind. FP=1</th><th className="py-2 px-2.5">Elevação</th>
        <th className="py-2 px-2.5">Enrolamento</th><th className="py-2 px-2.5">NBI</th><th className="py-2 px-2.5">Validação</th><th className="py-2 px-2.5">Fonte</th>
      </tr></thead>
      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[10px]">
        {models.length === 0 ? <EmptyRow columns={18} /> : models.map((model) => (
          <tr key={model.id} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50">
            <td className="py-1.5 px-2.5 font-sans font-bold whitespace-nowrap">{model.manufacturer}</td>
            <td className="py-1.5 px-2.5"><StateBadge state={model.category} /></td>
            <td className="py-1.5 px-2.5 font-bold min-w-36">{model.model || <span className="font-sans font-normal text-slate-500">Não informado no PBE</span>}</td>
            <td className="py-1.5 px-2.5 font-sans font-semibold">{phaseLabel(model.phaseType)}</td>
            <td className="py-1.5 px-2.5 font-bold whitespace-nowrap">{formatNumber(model.powerKva)} kVA</td>
            <td className="py-1.5 px-2.5 whitespace-nowrap">{formatNumber(model.voltageClassKv)} kV</td>
            <td className="py-1.5 px-2.5">{model.pedestal == null ? '—' : model.pedestal ? 'Sim' : 'Não'}</td>
            <td className="py-1.5 px-2.5 whitespace-nowrap">{lossPair(model.nominalConventionalNoLoadW, model.nominalConventionalTotalW)}</td>
            <td className="py-1.5 px-2.5 whitespace-nowrap">{lossPair(model.nominalReliableNoLoadW, model.nominalReliableTotalW)}</td>
            <td className="py-1.5 px-2.5 whitespace-nowrap">{lossPair(model.criticalConventionalNoLoadW, model.criticalConventionalTotalW)}</td>
            <td className="py-1.5 px-2.5 whitespace-nowrap">{lossPair(model.criticalReliableNoLoadW, model.criticalReliableTotalW)}</td>
            <td className="py-1.5 px-2.5 whitespace-nowrap">{model.derivedLoadLossW == null ? '—' : `${formatNumber(model.derivedLoadLossW, 0)} W`}</td>
            <td className="py-1.5 px-2.5 font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{model.efficiencyPercent == null ? '—' : `${formatNumber(model.efficiencyPercent)}%`}</td>
            <td className="py-1.5 px-2.5 whitespace-nowrap">{[model.temperatureRise55C && '55', model.temperatureRise65C && '65', model.temperatureRise75C && '75'].filter(Boolean).join('/') || '—'} °C</td>
            <td className="py-1.5 px-2.5">{[model.windingCopper && 'Cu', model.windingAluminum && 'Al'].filter(Boolean).join('/') || '—'}</td>
            <td className="py-1.5 px-2.5 whitespace-nowrap">{model.nbiKv ? `${model.nbiKv} kV` : '—'}</td>
            <td className="py-1.5 px-2.5"><ValidationBadge model={model} /></td>
            <td className="py-1.5 px-2.5 whitespace-nowrap" title={model.sourceDocument}>PBE p. {model.sourcePage}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TransformerTable({ transformers, source, onDelete }: { transformers: TransformerSpec[]; source: 'ETU' | 'FIELD'; onDelete: (id: string) => void }) {
  return (
    <table className="w-full text-left border-collapse text-xs">
      <thead><tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[9px]">
        <th className="py-2 px-2.5">Código ID</th><th className="py-2 px-2.5">Marca / referência</th><th className="py-2 px-2.5">Estado / situação</th>
        <th className="py-2 px-2.5">Fase</th><th className="py-2 px-2.5">Data fab.</th><th className="py-2 px-2.5">Data cadastro</th><th className="py-2 px-2.5">Óleo</th>
        <th className="py-2 px-2.5">Material</th><th className="py-2 px-2.5">Potência</th><th className="py-2 px-2.5">Prim. / sec.</th><th className="py-2 px-2.5">%Z</th>
        <th className="py-2 px-2.5">P0</th><th className="py-2 px-2.5">Pk</th><th className="py-2 px-2.5">Perdas totais</th><th className="py-2 px-2.5">Eficiência</th><th className="py-2 px-2.5">Ações</th>
      </tr></thead>
      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[10px]">
        {transformers.length === 0 ? <EmptyRow columns={16} /> : transformers.map((item) => (
          <tr key={item.id} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50">
            <td className="py-1.5 px-2.5 font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">{item.id}</td>
            <td className="py-1.5 px-2.5 font-sans font-bold">{source === 'ETU' ? item.standardReference : item.brand || 'Não informado'}</td>
            <td className="py-1.5 px-2.5"><StateBadge state={source === 'ETU' ? 'REFERENCIA_NORMATIVA' : item.state || item.category} /></td>
            <td className="py-1.5 px-2.5 font-sans font-semibold">{phaseLabel(item.phaseType)}</td>
            <td className="py-1.5 px-2.5">{item.manufacturingDate || '—'}</td><td className="py-1.5 px-2.5">{item.dateAdded || '—'}</td>
            <td className="py-1.5 px-2.5">{item.oilType === 'VEGETAL' ? 'Vegetal' : 'Mineral'}</td><td className="py-1.5 px-2.5">{item.windingMaterial === 'COBRE' ? 'Cu' : 'Al'}</td>
            <td className="py-1.5 px-2.5 font-bold whitespace-nowrap">{formatNumber(item.powerKva)} kVA</td>
            <td className="py-1.5 px-2.5 whitespace-nowrap">{formatNumber(item.primaryVoltageV / 1000)} kV / {formatNumber(item.secondaryVoltageV, 0)} V</td>
            <td className="py-1.5 px-2.5">{formatNumber(item.impedancePercent)}%</td><td className="py-1.5 px-2.5">{formatNumber(item.noLoadLossW, 0)} W</td>
            <td className="py-1.5 px-2.5">{formatNumber(item.loadLoss75cW, 0)} W</td><td className="py-1.5 px-2.5 font-bold">{formatNumber(item.totalLossW, 0)} W</td>
            <td className="py-1.5 px-2.5 font-bold text-emerald-700 dark:text-emerald-400">{formatNumber(item.efficiencyPercent)}%</td>
            <td className="py-1.5 px-2.5 text-center">{source === 'FIELD' ? <button onClick={() => onDelete(item.id)} title="Excluir cadastro de campo" className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"><Trash2 className="w-3.5 h-3.5" /></button> : <Shield className="w-3.5 h-3.5 mx-auto text-blue-500" aria-label="Referência ETU protegida" />}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StateBadge({ state }: { state: string }) {
  if (state === 'REFERENCIA_NORMATIVA') return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-800 whitespace-nowrap"><Shield className="w-2.5 h-2.5" /> Referência ETU</span>;
  if (state === 'NOVO') return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-800"><Zap className="w-2.5 h-2.5" /> Novo</span>;
  return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/70 dark:text-purple-200 dark:border-purple-800"><Shield className="w-2.5 h-2.5" /> {state === 'USADO' ? 'Usado' : 'Recondicionado'}</span>;
}

function EmptyRow({ columns }: { columns: number }) {
  return <tr><td colSpan={columns} className="py-8 text-center text-slate-500 font-sans">Nenhum modelo encontrado para os filtros selecionados.</td></tr>;
}
