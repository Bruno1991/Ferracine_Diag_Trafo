import React, { useState, useRef } from 'react';
import { Database, Search, Filter, Shield, Zap, Trash2, Upload, FileCode, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { TransformerSpec, TransformerType, PhaseType } from '../types';
import { processDatabaseFile } from '../utils/sqliteAndSplitLoader';

interface DatabaseExplorerProps {
  transformers: TransformerSpec[];
  onAddTransformer?: (newTrafo: TransformerSpec) => void;
  onUpdateTransformers?: (updated: TransformerSpec[]) => void;
}

export const DatabaseExplorer: React.FC<DatabaseExplorerProps> = ({
  transformers,
  onUpdateTransformers = (_: TransformerSpec[]) => {}
}) => {
  const [mfgDateFilter, setMfgDateFilter] = useState('');
  const [testDateFilter, setTestDateFilter] = useState('');
  const [phaseType, setPhaseType] = useState<PhaseType | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDatabaseUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFiles(true);
    setUploadStatus(null);

    try {
      const parsedTrafos = await processDatabaseFile(files[0]);

      if (parsedTrafos.length === 0) {
        setUploadStatus({
          type: 'error',
          message: 'Nenhum registro de transformador foi identificado nos arquivos fornecidos.'
        });
      } else {
        // Merge with existing transformers removing duplicates
        const map = new Map<string, TransformerSpec>();
        transformers.forEach((t) => map.set(t.id, t));
        parsedTrafos.forEach((t) => map.set(t.id, t));

        const merged = Array.from(map.values());
        try {
          localStorage.setItem('tx_analytix_transformers', JSON.stringify(merged));
        } catch (e) {
          console.error('Failed to save merged transformers to localStorage', e);
        }

        onUpdateTransformers(merged);
        setUploadStatus({
          type: 'success',
          message: `Sucesso! ${parsedTrafos.length} equipamentos carregados e unificados do banco de dados.`
        });
      }
    } catch (err: any) {
      console.error('Erro ao processar o banco SQLite:', err);
      setUploadStatus({
        type: 'error',
        message: `Erro ao processar o banco SQLite: ${err.message || 'Formato inválido'}`
      });
    } finally {
      setIsProcessingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filtered = transformers.filter((t) => {
    if (phaseType !== 'ALL' && t.phaseType !== phaseType) return false;
    if (mfgDateFilter && !(t.manufacturingDate || '').toLowerCase().includes(mfgDateFilter.toLowerCase())) return false;
    if (testDateFilter && !(t.dateAdded || '').toLowerCase().includes(testDateFilter.toLowerCase())) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchKva = t.powerKva.toString().includes(term);
      const matchVolt = t.primaryVoltageV.toString().includes(term) || t.secondaryVoltageV.toString().includes(term);
      const matchId = t.id.toLowerCase().includes(term);
      const matchStd = (t.standardReference || '').toLowerCase().includes(term);
      const matchBrand = (t.brand || '').toLowerCase().includes(term);
      const matchState = (t.state || t.category || '').toLowerCase().includes(term);
      return matchKva || matchVolt || matchId || matchStd || matchBrand || matchState;
    }
    return true;
  });

  const handleDeleteSingleTransformer = (id: string) => {
    const updated = transformers.filter((t) => t.id !== id);
    try {
      localStorage.setItem('tx_analytix_transformers', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to update localStorage', e);
    }
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
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              TRANSFORMADORES CADASTRADOS
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Consulta e pesquisa de especificações técnicas dos equipamentos no sistema
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            accept=".sqlite,.db"
            onChange={handleDatabaseUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingFiles}
            title="Importar um banco SQLite compatível"
            className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold font-mono bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isProcessingFiles ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Abrindo SQLite...
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                Importar SQLite
              </>
            )}
          </button>

          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shadow-xs">
            {filtered.length} EQUIPAMENTOS
          </span>
        </div>
      </div>

      {uploadStatus && (
        <div
          className={`p-2.5 rounded border text-xs font-mono flex items-center gap-2 ${
            uploadStatus.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          {uploadStatus.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          )}
          <span>{uploadStatus.message}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar kVA, Tensão ou ID..."
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded pl-8 pr-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Manufacturing Date Filter */}
        <div>
          <input
            type="text"
            value={mfgDateFilter}
            onChange={(e) => setMfgDateFilter(e.target.value)}
            placeholder="Data Fabricação (MM/AAAA)"
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Test Date Filter */}
        <div>
          <input
            type="text"
            value={testDateFilter}
            onChange={(e) => setTestDateFilter(e.target.value)}
            placeholder="Data do Teste (MM/AAAA)"
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Phase Filter */}
        <div>
          <select
            value={phaseType}
            onChange={(e) => setPhaseType(e.target.value as any)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Todos Tipos de Fase</option>
            <option value="TRIFASICO">Trifásicos (3Ø)</option>
            <option value="BIFASICO">Bifásicos (2Ø)</option>
            <option value="MONOFASICO">Monofásicos (1Ø)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded border border-slate-300 dark:border-slate-800">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-300 dark:border-slate-700 uppercase tracking-wider text-[10px]">
              <th className="py-2 px-2.5">Código ID</th>
              <th className="py-2 px-2.5">Marca / Fabricante</th>
              <th className="py-2 px-2.5">Estado / Situação</th>
              <th className="py-2 px-2.5">Fase</th>
              <th className="py-2 px-2.5">Data Fab.</th>
              <th className="py-2 px-2.5">Data Teste</th>
              <th className="py-2 px-2.5">Tipo Óleo</th>
              <th className="py-2 px-2.5">Material</th>
              <th className="py-2 px-2.5">Potência</th>
              <th className="py-2 px-2.5">Prim. / Sec.</th>
              <th className="py-2 px-2.5">%Z</th>
              <th className="py-2 px-2.5">P0 (W)</th>
              <th className="py-2 px-2.5">Pk (W)</th>
              <th className="py-2 px-2.5">Perdas Totais</th>
              <th className="py-2 px-2.5">Eficiência</th>
              <th className="py-2 px-2.5 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[11px]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={15} className="py-8 text-center text-slate-500 dark:text-slate-400 font-sans">
                  <p className="font-bold text-slate-700 dark:text-slate-300 text-xs">Nenhum transformador encontrado no banco de dados.</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Ajuste os filtros de busca ou salve novos equipamentos.</p>
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition">
                  <td className="py-1.5 px-2.5 font-bold text-blue-700 dark:text-blue-400">{t.id}</td>
                  <td className="py-1.5 px-2.5 font-sans font-bold text-slate-800 dark:text-slate-200">{t.brand || 'N/A'}</td>
                  <td className="py-1.5 px-2.5 font-sans">
                    {(t.state || t.category) === 'NOVO' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                        <Zap className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" /> Novo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                        <Shield className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" /> Recond.
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-2.5 font-sans font-semibold">{t.phaseType}</td>
                  <td className="py-1.5 px-2.5 font-bold text-slate-800 dark:text-slate-200">{t.manufacturingDate || 'N/A'}</td>
                  <td className="py-1.5 px-2.5 text-slate-600 dark:text-slate-400 text-[10px]">{t.dateAdded || 'N/A'}</td>
                  <td className="py-1.5 px-2.5 font-sans">
                    {t.oilType === 'VEGETAL' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                        🌱 Vegetal
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                        🛢️ Mineral
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-2.5 font-sans">
                    {t.windingMaterial === 'COBRE' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                        🔶 Cu
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                        ⚡ Al
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-2.5 font-bold text-slate-900 dark:text-slate-100">{t.powerKva} kVA</td>
                  <td className="py-1.5 px-2.5">{t.primaryVoltageV / 1000}kV / {t.secondaryVoltageV}V</td>
                  <td className="py-1.5 px-2.5 text-amber-800 dark:text-amber-300 font-bold">{t.impedancePercent}%</td>
                  <td className="py-1.5 px-2.5">{t.noLoadLossW} W</td>
                  <td className="py-1.5 px-2.5">{t.loadLoss75cW} W</td>
                  <td className="py-1.5 px-2.5 text-slate-900 dark:text-slate-100 font-bold">{t.totalLossW} W</td>
                  <td className="py-1.5 px-2.5 text-emerald-700 dark:text-emerald-400 font-bold">{t.efficiencyPercent}%</td>
                  <td className="py-1.5 px-2.5 text-center">
                    {t.dataOrigin !== 'NORMATIVE' && t.state !== 'REFERENCIA_NORMATIVA' ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteSingleTransformer(t.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                        title="Excluir este equipamento cadastrado"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <Shield className="w-3.5 h-3.5 mx-auto text-blue-500" aria-label="Registro normativo protegido" />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
