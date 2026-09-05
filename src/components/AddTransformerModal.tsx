import React, { useState } from 'react';
import { PlusCircle, X, Check, Database, Zap } from 'lucide-react';
import { TransformerSpec, TransformerType, PhaseType } from '../types';

interface AddTransformerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransformer: (newTrafo: TransformerSpec) => void;
}

export const AddTransformerModal: React.FC<AddTransformerModalProps> = ({
  isOpen,
  onClose,
  onAddTransformer
}) => {
  const [category, setCategory] = useState<TransformerType>('NOVO');
  const [phaseType, setPhaseType] = useState<PhaseType>('TRIFASICO');
  const [powerKva, setPowerKva] = useState<number>(45);
  const [primaryVoltageV, setPrimaryVoltageV] = useState<number>(13800);
  const [secondaryVoltageV, setSecondaryVoltageV] = useState<number>(220);
  const [secondaryNeutralV, setSecondaryNeutralV] = useState<number>(127);
  const [impedancePercent, setImpedancePercent] = useState<number>(3.5);
  const [windingMaterial, setWindingMaterial] = useState<'ALUMINIO' | 'COBRE'>('ALUMINIO');
  const [oilType, setOilType] = useState<'MINERAL' | 'VEGETAL'>('MINERAL');
  const [manufacturingDate, setManufacturingDate] = useState<string>('');
  const [noLoadLossW, setNoLoadLossW] = useState<number>(175);
  const [loadLoss75cW, setLoadLoss75cW] = useState<number>(710);
  const [noLoadCurrentPercent, setNoLoadCurrentPercent] = useState<number>(1.4);
  const [standardReference, setStandardReference] = useState<string>('Norma Personalizada / Cadastro Manual');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalLossW = noLoadLossW + loadLoss75cW;
    const powerW = powerKva * 1000;
    const efficiencyPercent = Number((((powerW * 0.92) / (powerW * 0.92 + totalLossW)) * 100).toFixed(2));
    
    const id = `CUSTOM-${category === 'NOVO' ? 'NOV' : 'REC'}-${phaseType === 'TRIFASICO' ? 'TRI' : 'MONO'}-${powerKva}-${Math.floor(100 + Math.random() * 900)}`;

    const newTrafo: TransformerSpec = {
      id,
      category,
      state: category === 'RECONDICIONADO' ? 'RECONDICIONADO' : 'NOVO',
      phaseType,
      powerKva,
      primaryVoltageV,
      secondaryVoltageV,
      secondaryNeutralV,
      impedancePercent,
      windingMaterial,
      oilType,
      manufacturingDate,
      noLoadLossW,
      loadLoss75cW,
      totalLossW,
      efficiencyPercent,
      noLoadCurrentPercent,
      standardReference,
      dateAdded: new Date().toISOString().split('T')[0]
    };

    onAddTransformer(newTrafo);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xl max-w-xl w-full p-5 text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Cadastrar Novo Transformador no Banco de Dados
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Insira as especificações técnicas da plaqueta do equipamento
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-xs mb-1 block">CATEGORIA</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TransformerType)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="NOVO">Novo</option>
                <option value="RECONDICIONADO">Recondicionado</option>
              </select>
            </div>

            <div>
              <label className="label-xs mb-1 block">TIPO DE FASE</label>
              <select
                value={phaseType}
                onChange={(e) => setPhaseType(e.target.value as PhaseType)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="TRIFASICO">Trifásico (3Ø)</option>
                <option value="MONOFASICO">Monofásico (1Ø)</option>
              </select>
            </div>

            <div>
              <label className="label-xs mb-1 block">MATERIAL ENROLAMENTO</label>
              <select
                value={windingMaterial}
                onChange={(e) => setWindingMaterial(e.target.value as 'ALUMINIO' | 'COBRE')}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="ALUMINIO">⚡ Alumínio (Tk = 225,0°C)</option>
                <option value="COBRE">🔶 Cobre (Tk = 234,5°C)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs mb-1 block">TIPO DE ÓLEO ISOLANTE</label>
              <select
                value={oilType}
                onChange={(e) => setOilType(e.target.value as 'MINERAL' | 'VEGETAL')}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="MINERAL">🛢️ Mineral (NBR 10576)</option>
                <option value="VEGETAL">🌱 Vegetal / Éster (NBR 15422)</option>
              </select>
            </div>

            <div>
              <label className="label-xs mb-1 block">DATA DE FABRICAÇÃO (MM/AAAA)</label>
              <input
                type="text"
                value={manufacturingDate}
                onChange={(e) => setManufacturingDate(e.target.value)}
                placeholder=""
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-xs mb-1 block">POTÊNCIA (kVA)</label>
              <input
                type="number"
                step="0.1"
                value={powerKva}
                onChange={(e) => setPowerKva(Number(e.target.value))}
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="label-xs mb-1 block">TENSÃO PRIM. (V)</label>
              <input
                type="number"
                value={primaryVoltageV}
                onChange={(e) => setPrimaryVoltageV(Number(e.target.value))}
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="label-xs mb-1 block">IMPEDÂNCIA (%Z)</label>
              <input
                type="number"
                step="0.01"
                value={impedancePercent}
                onChange={(e) => setImpedancePercent(Number(e.target.value))}
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-amber-700 dark:text-amber-300 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs mb-1 block">TENSÃO SECUNDÁRIA F-F (V)</label>
              <input
                type="number"
                value={secondaryVoltageV}
                onChange={(e) => setSecondaryVoltageV(Number(e.target.value))}
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="label-xs mb-1 block">TENSÃO SECUNDÁRIA F-N (V)</label>
              <input
                type="number"
                value={secondaryNeutralV}
                onChange={(e) => setSecondaryNeutralV(Number(e.target.value))}
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-xs mb-1 block">PERDAS VAZIO P0 (W)</label>
              <input
                type="number"
                value={noLoadLossW}
                onChange={(e) => setNoLoadLossW(Number(e.target.value))}
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="label-xs mb-1 block">PERDAS CARGA Pk (W)</label>
              <input
                type="number"
                value={loadLoss75cW}
                onChange={(e) => setLoadLoss75cW(Number(e.target.value))}
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="label-xs mb-1 block">CORRENTE VAZIO (%I0)</label>
              <input
                type="number"
                step="0.1"
                value={noLoadCurrentPercent}
                onChange={(e) => setNoLoadCurrentPercent(Number(e.target.value))}
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="label-xs mb-1 block">NORMA / REFERÊNCIA TÉCNICA</label>
            <input
              type="text"
              value={standardReference}
              onChange={(e) => setStandardReference(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Salvar no Banco de Dados</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
