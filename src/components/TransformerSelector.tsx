import React, { useState, useEffect } from 'react';
import { Database, Zap, Shield, Sliders, PlusCircle, RefreshCw, Save, Check } from 'lucide-react';
import { TransformerSpec, TransformerType, PhaseType, InitialDiagnosticData } from '../types';
import { computeNominalLossesAndEfficiency } from '../utils/electricalCalculations';

export function buildTransformerNameOrId(
  brand?: string,
  phaseType: PhaseType = 'TRIFASICO',
  powerKva: number = 0,
  primaryVoltageV: number = 13800,
  secondaryVoltageV: number = 220,
  secondaryNeutralV: number = 127,
  oilType?: string,
  windingMaterial?: string,
  categoryOrState?: string
): string {
  const brandClean = (brand?.trim() || 'MARCA').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const phaseClean = phaseType.toLowerCase(); // 'monofasico', 'trifasico'
  const powerStr = `${powerKva}kva`;
  const primKvStr = primaryVoltageV >= 1000 ? `${primaryVoltageV / 1000}kv` : `${primaryVoltageV}v`;
  const secStr = secondaryNeutralV > 0 ? `${secondaryVoltageV}v/${secondaryNeutralV}v` : `${secondaryVoltageV}v`;
  const oilClean = (oilType || 'MINERAL').toLowerCase().replace(/[^a-z0-9]/g, '');
  const matClean = (windingMaterial || 'ALUMINIO').toLowerCase().replace(/[^a-z0-9]/g, '');
  const catClean = (categoryOrState || 'NOVO').toLowerCase().replace(/[^a-z0-9]/g, '');

  return `${brandClean}-${phaseClean}-${powerStr}-${primKvStr}-${secStr}-${oilClean}-${matClean}-${catClean}`;
}

interface TransformerSelectorProps {
  selectedTransformer: TransformerSpec;
  onSelectTransformer: (spec: TransformerSpec) => void;
  selectedTap: string;
  onTapChange: (tap: string) => void;
  allTransformers: TransformerSpec[];
  onAddTransformer: (newTrafo: TransformerSpec) => void;
  initialData?: InitialDiagnosticData;
  onChangeInitialData?: (updated: InitialDiagnosticData) => void;
}

export const TransformerSelector: React.FC<TransformerSelectorProps> = ({
  selectedTransformer,
  onSelectTransformer,
  selectedTap,
  onTapChange,
  allTransformers,
  onAddTransformer,
  initialData,
  onChangeInitialData
}) => {
  const [category, setCategory] = useState<TransformerType>(selectedTransformer.category === 'NOVO' ? 'USADO' : (selectedTransformer.category || 'USADO'));
  const [phaseType, setPhaseType] = useState<PhaseType>(selectedTransformer.phaseType || 'TRIFASICO');
  
  // TAP Configuration State
  const [tapCount, setTapCount] = useState<number>(5);
  const [activeTapIndex, setActiveTapIndex] = useState<number>(3);
  const [tapVoltages, setTapVoltages] = useState<{ [pos: number]: number }>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0
  });

  const calculateDefaultTapVoltages = (count: number, primV: number): { [pos: number]: number } => {
    const result: { [pos: number]: number } = {};
    if (!primV || primV <= 0) {
      for (let i = 1; i <= count; i++) {
        result[i] = 0;
      }
      return result;
    }

    if (count === 5) {
      result[1] = Math.round(primV * 1.05);
      result[2] = Math.round(primV * 1.025);
      result[3] = Math.round(primV);
      result[4] = Math.round(primV * 0.975);
      result[5] = Math.round(primV * 0.95);
    } else if (count === 3) {
      result[1] = Math.round(primV * 1.05);
      result[2] = Math.round(primV);
      result[3] = Math.round(primV * 0.95);
    } else {
      const center = Math.ceil(count / 2);
      const maxOffset = 0.05;
      const step = count > 1 ? (maxOffset * 2) / (count - 1) : 0;
      for (let i = 1; i <= count; i++) {
        const factor = 1 + (center - i) * step;
        result[i] = Math.round(primV * factor);
      }
    }
    return result;
  };

  // Sync TAP voltages on primary voltage change if default
  useEffect(() => {
    const numPrim = typeof primaryVoltageV === 'number' ? primaryVoltageV : 0;
    if (numPrim > 0) {
      const defaults = calculateDefaultTapVoltages(tapCount, numPrim);
      setTapVoltages(defaults);
      notifyTapChange(activeTapIndex, tapCount, defaults);
    }
  }, [selectedTransformer.primaryVoltageV]);

  const notifyTapChange = (activePos: number, count: number, voltages: { [pos: number]: number }) => {
    const v = voltages[activePos];
    const vStr = v && v > 0 ? `${v} V (${(v / 1000).toFixed(3)} kV)` : 'Tensão N/I';
    onTapChange(`TAP ${activePos} (${vStr}) — ${count} TAPs Totais`);
  };

  const handleTapCountChange = (newCount: number) => {
    const validCount = Math.max(1, Math.min(15, newCount));
    setTapCount(validCount);
    const newActive = Math.min(activeTapIndex, validCount);
    setActiveTapIndex(newActive);

    const numPrim = typeof primaryVoltageV === 'number' ? primaryVoltageV : 0;
    const defaults = calculateDefaultTapVoltages(validCount, numPrim);
    setTapVoltages(defaults);
    notifyTapChange(newActive, validCount, defaults);
    updateActiveTransformer({ tapCount: validCount, activeTapIndex: newActive, tapVoltages: defaults });
  };

  const handleTapVoltageChange = (pos: number, voltage: number) => {
    const updated = { ...tapVoltages, [pos]: voltage };
    setTapVoltages(updated);
    notifyTapChange(activeTapIndex, tapCount, updated);
    updateActiveTransformer({ tapCount, activeTapIndex, tapVoltages: updated });
  };

  const handleSelectActiveTap = (pos: number) => {
    setActiveTapIndex(pos);
    notifyTapChange(pos, tapCount, tapVoltages);
    updateActiveTransformer({ tapCount, activeTapIndex: pos, tapVoltages });
  };

  const handleResetDefaultTaps = () => {
    const numPrim = typeof primaryVoltageV === 'number' ? primaryVoltageV : 0;
    const defaults = calculateDefaultTapVoltages(tapCount, numPrim);
    setTapVoltages(defaults);
    notifyTapChange(activeTapIndex, tapCount, defaults);
    updateActiveTransformer({ tapCount, activeTapIndex, tapVoltages: defaults });
  };
  const [powerKva, setPowerKva] = useState<number | ''>(selectedTransformer.powerKva || '');
  const [primaryVoltageV, setPrimaryVoltageV] = useState<number | ''>(selectedTransformer.primaryVoltageV || '');
  const [secondaryVoltageV, setSecondaryVoltageV] = useState<number | ''>(selectedTransformer.secondaryVoltageV || '');
  const [secondaryNeutralV, setSecondaryNeutralV] = useState<number | ''>(selectedTransformer.secondaryNeutralV || '');
  const [impedancePercent, setImpedancePercent] = useState<number | ''>(selectedTransformer.impedancePercent || '');
  const [oilTempC, setOilTempC] = useState<number | ''>(selectedTransformer.oilTempC || '');
  const [windingMaterial, setWindingMaterial] = useState<'ALUMINIO' | 'COBRE'>(selectedTransformer.windingMaterial || 'ALUMINIO');
  const [oilType, setOilType] = useState<'MINERAL' | 'VEGETAL'>(selectedTransformer.oilType || 'MINERAL');
  const [manufacturingDate, setManufacturingDate] = useState<string>(selectedTransformer.manufacturingDate || '');
  const [efficiencyLevel, setEfficiencyLevel] = useState<number | string>(selectedTransformer.efficiencyLevel || '');
  const [noLoadLossW, setNoLoadLossW] = useState<number | ''>(selectedTransformer.noLoadLossW || '');
  const [loadLoss75cW, setLoadLoss75cW] = useState<number | ''>(selectedTransformer.loadLoss75cW || '');
  
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);

  // Sync state when selectedTransformer prop changes from outside
  useEffect(() => {
    setCategory(selectedTransformer.category || 'NOVO');
    setPhaseType(selectedTransformer.phaseType || 'TRIFASICO');
    setPowerKva(selectedTransformer.powerKva || '');
    setPrimaryVoltageV(selectedTransformer.primaryVoltageV || '');
    setSecondaryVoltageV(selectedTransformer.secondaryVoltageV || '');
    setSecondaryNeutralV(selectedTransformer.secondaryNeutralV || '');
    setImpedancePercent(selectedTransformer.impedancePercent || '');
    setOilTempC(selectedTransformer.oilTempC || '');
    setWindingMaterial(selectedTransformer.windingMaterial || 'ALUMINIO');
    setOilType(selectedTransformer.oilType || 'MINERAL');
    setManufacturingDate(selectedTransformer.manufacturingDate || '');
    setEfficiencyLevel(selectedTransformer.efficiencyLevel || '');
    setNoLoadLossW(selectedTransformer.noLoadLossW || '');
    setLoadLoss75cW(selectedTransformer.loadLoss75cW || '');

    if (initialData && onChangeInitialData && selectedTransformer.brand !== undefined && selectedTransformer.brand !== initialData.transformerBrand) {
      onChangeInitialData({
        ...initialData,
        transformerBrand: selectedTransformer.brand,
        serialNumber: selectedTransformer.serialNumber !== undefined ? selectedTransformer.serialNumber : initialData.serialNumber
      });
    }

    if (selectedTransformer.tapCount) {
      setTapCount(selectedTransformer.tapCount);
    }
    if (selectedTransformer.activeTapIndex) {
      setActiveTapIndex(selectedTransformer.activeTapIndex);
    }
    if (selectedTransformer.tapVoltages) {
      setTapVoltages(selectedTransformer.tapVoltages);
      notifyTapChange(
        selectedTransformer.activeTapIndex || 3,
        selectedTransformer.tapCount || 5,
        selectedTransformer.tapVoltages
      );
    }
  }, [
    selectedTransformer.id,
    selectedTransformer.powerKva,
    selectedTransformer.primaryVoltageV,
    selectedTransformer.secondaryVoltageV,
    selectedTransformer.secondaryNeutralV,
    selectedTransformer.impedancePercent,
    selectedTransformer.oilTempC,
    selectedTransformer.windingMaterial,
    selectedTransformer.oilType,
    selectedTransformer.manufacturingDate,
    selectedTransformer.efficiencyLevel,
    selectedTransformer.tapCount,
    selectedTransformer.activeTapIndex,
    selectedTransformer.tapVoltages
  ]);

  const numPower = typeof powerKva === 'number' ? powerKva : 0;
  const numP0 = typeof noLoadLossW === 'number' ? noLoadLossW : 0;
  const numPk = typeof loadLoss75cW === 'number' ? loadLoss75cW : 0;

  // Compute total loss and efficiency in real time
  const calculatedLosses = computeNominalLossesAndEfficiency(
    numPower,
    phaseType,
    category,
    numP0,
    numPk,
    windingMaterial
  );
  const displayedEfficiencyPercent = selectedTransformer.state === 'REFERENCIA_NORMATIVA'
    ? selectedTransformer.efficiencyPercent
    : calculatedLosses.efficiencyPercent;

  // Update active transformer spec on field changes
  const updateActiveTransformer = (updates: Partial<TransformerSpec>) => {
    const updatedCategory = updates.category !== undefined ? updates.category : category;
    const updatedPhase = updates.phaseType !== undefined ? updates.phaseType : phaseType;
    const updatedPower = updates.powerKva !== undefined ? updates.powerKva : (typeof powerKva === 'number' ? powerKva : 0);
    const updatedPrimV = updates.primaryVoltageV !== undefined ? updates.primaryVoltageV : (typeof primaryVoltageV === 'number' ? primaryVoltageV : 0);
    const updatedSecV = updates.secondaryVoltageV !== undefined ? updates.secondaryVoltageV : (typeof secondaryVoltageV === 'number' ? secondaryVoltageV : 0);
    const updatedSecNeutV = updates.secondaryNeutralV !== undefined ? updates.secondaryNeutralV : (typeof secondaryNeutralV === 'number' ? secondaryNeutralV : 0);
    const updatedImp = updates.impedancePercent !== undefined ? updates.impedancePercent : (typeof impedancePercent === 'number' ? impedancePercent : 0);
    const updatedTemp = updates.oilTempC !== undefined ? updates.oilTempC : (typeof oilTempC === 'number' ? oilTempC : 0);
    const updatedMat = updates.windingMaterial !== undefined ? updates.windingMaterial : windingMaterial;
    const updatedOilType = updates.oilType !== undefined ? updates.oilType : oilType;
    const updatedMfgDate = updates.manufacturingDate !== undefined ? updates.manufacturingDate : manufacturingDate;
    const updatedEfficiencyLevel = updates.efficiencyLevel !== undefined ? updates.efficiencyLevel : efficiencyLevel;
    const updatedP0 = updates.noLoadLossW !== undefined ? updates.noLoadLossW : (typeof noLoadLossW === 'number' ? noLoadLossW : 0);
    const updatedPk = updates.loadLoss75cW !== undefined ? updates.loadLoss75cW : (typeof loadLoss75cW === 'number' ? loadLoss75cW : 0);
    const updatedTapCount = updates.tapCount !== undefined ? updates.tapCount : tapCount;
    const updatedActiveTapIndex = updates.activeTapIndex !== undefined ? updates.activeTapIndex : activeTapIndex;
    const updatedTapVoltages = updates.tapVoltages !== undefined ? updates.tapVoltages : tapVoltages;

    const computed = computeNominalLossesAndEfficiency(
      updatedPower,
      updatedPhase,
      updatedCategory,
      updatedP0,
      updatedPk,
      updatedMat
    );

    const updatedSpec: TransformerSpec = {
      ...selectedTransformer,
      id: selectedTransformer.id || buildTransformerNameOrId(
        initialData?.transformerBrand,
        updatedPhase,
        updatedPower,
        updatedPrimV,
        updatedSecV,
        updatedSecNeutV,
        updatedOilType,
        updatedMat,
        updatedCategory
      ),
      category: updatedCategory,
      state: updatedCategory === 'RECONDICIONADO' ? 'RECONDICIONADO' : 'NOVO',
      phaseType: updatedPhase,
      powerKva: updatedPower,
      primaryVoltageV: updatedPrimV,
      secondaryVoltageV: updatedSecV,
      secondaryNeutralV: updatedSecNeutV,
      impedancePercent: updatedImp,
      oilTempC: updatedTemp,
      windingMaterial: updatedMat,
      oilType: updatedOilType,
      manufacturingDate: updatedMfgDate,
      efficiencyLevel: updatedEfficiencyLevel,
      noLoadLossW: computed.noLoadLossW,
      loadLoss75cW: computed.loadLoss75cW,
      totalLossW: computed.totalLossW,
      efficiencyPercent: computed.efficiencyPercent,
      standardReference: 'Dados da Placa do Transformador (Técnico)',
      tapCount: updatedTapCount,
      activeTapIndex: updatedActiveTapIndex,
      tapVoltages: updatedTapVoltages
    };

    onSelectTransformer(updatedSpec);
  };

  const handleSaveToDatabase = () => {
    if (!numPower || numPower === 0) {
      alert('Preencha ao menos a Potência (kVA) do transformador para salvar no banco.');
      return;
    }

    const primV = typeof primaryVoltageV === 'number' ? primaryVoltageV : 13800;
    const secV = typeof secondaryVoltageV === 'number' ? secondaryVoltageV : 220;
    const secN = typeof secondaryNeutralV === 'number' ? secondaryNeutralV : 127;

    const baseId = buildTransformerNameOrId(
      initialData?.transformerBrand,
      phaseType,
      numPower,
      primV,
      secV,
      secN,
      oilType,
      windingMaterial,
      category
    );

    let customId = baseId;
    let counter = 1;
    while (allTransformers.some((t) => t.id === customId)) {
      customId = `${baseId}-${counter}`;
      counter++;
    }

    const newSpec: TransformerSpec = {
      id: customId,
      category,
      state: category === 'RECONDICIONADO' ? 'RECONDICIONADO' : 'NOVO',
      phaseType,
      powerKva: numPower,
      primaryVoltageV: primV,
      secondaryVoltageV: secV,
      secondaryNeutralV: secN,
      impedancePercent: typeof impedancePercent === 'number' ? impedancePercent : 3.5,
      oilTempC: typeof oilTempC === 'number' ? oilTempC : 65,
      windingMaterial,
      oilType,
      manufacturingDate: manufacturingDate || undefined,
      efficiencyLevel: `${calculatedLosses.efficiencyPercent.toFixed(2)}%`,
      brand: initialData?.transformerBrand,
      serialNumber: initialData?.serialNumber,
      noLoadLossW: calculatedLosses.noLoadLossW,
      loadLoss75cW: calculatedLosses.loadLoss75cW,
      totalLossW: calculatedLosses.totalLossW,
      efficiencyPercent: calculatedLosses.efficiencyPercent,
      standardReference: 'Placa Alimentada pelo Técnico',
      dateAdded: new Date().toISOString().split('T')[0],
      tapCount,
      activeTapIndex,
      tapVoltages: { ...tapVoltages }
    };

    // Check duplicate technical plate spec (permits saving if ANY technical field or state/category is different)
    const isDuplicate = allTransformers.some((existing) => {
      // 0. Situação / Estado do Equipamento (NOVO vs RECONDICIONADO)
      const exCat = (existing.state || existing.category || 'NOVO').toUpperCase();
      const newCat = (newSpec.state || newSpec.category || 'NOVO').toUpperCase();
      if (exCat !== newCat) return false;

      // 1. Marca / Fabricante
      const exBrand = (existing.brand || '').trim().toLowerCase();
      const newBrand = (newSpec.brand || '').trim().toLowerCase();
      if (exBrand !== newBrand) return false;

      // 2. Tipo de Fase
      if (existing.phaseType !== newSpec.phaseType) return false;

      // 3. Potência (kVA)
      if (Number(existing.powerKva) !== Number(newSpec.powerKva)) return false;

      // 4. Tensão Primária (V)
      if (Number(existing.primaryVoltageV) !== Number(newSpec.primaryVoltageV)) return false;

      // 5. Tensão Secundária F-F (V)
      if (Number(existing.secondaryVoltageV) !== Number(newSpec.secondaryVoltageV)) return false;

      // 6. Tensão Secundária F-N (V)
      if (Number(existing.secondaryNeutralV) !== Number(newSpec.secondaryNeutralV)) return false;

      // 7. Impedância (%Z)
      if (Number(existing.impedancePercent) !== Number(newSpec.impedancePercent)) return false;

      // 8. Temp. Óleo (°C)
      if (Number(existing.oilTempC || 0) !== Number(newSpec.oilTempC || 0)) return false;

      // 9. Perdas em Vazio P0 (W)
      if (Number(existing.noLoadLossW) !== Number(newSpec.noLoadLossW)) return false;

      // 10. Perdas em Carga Pk (W)
      if (Number(existing.loadLoss75cW) !== Number(newSpec.loadLoss75cW)) return false;

      // 11. Perdas Totais (W)
      if (Number(existing.totalLossW) !== Number(newSpec.totalLossW)) return false;

      // 12. Eficiência Nominal (%)
      if (Number(existing.efficiencyPercent) !== Number(newSpec.efficiencyPercent)) return false;

      // 13. Tipo de Óleo Isolante
      if (existing.oilType !== newSpec.oilType) return false;

      // 14. Material dos Enrolamentos
      if (existing.windingMaterial !== newSpec.windingMaterial) return false;

      // 15. Configuração do Comutador de TAPs (Tensão em cada posição)
      const exTapCount = existing.tapCount !== undefined ? existing.tapCount : 5;
      if (exTapCount !== newSpec.tapCount) return false;

      const exTapVoltages = existing.tapVoltages || {};
      for (let i = 1; i <= newSpec.tapCount; i++) {
        if (Number(exTapVoltages[i] || 0) !== Number(newSpec.tapVoltages?.[i] || 0)) return false;
      }

      return true;
    });

    if (isDuplicate) {
      alert('⚠️ Os dados técnicos desta placa já estão cadastrados no Banco de Dados! Para cadastrar uma nova placa, altere algum parâmetro técnico (potência, tensões, impedância, perdas, TAPs, etc.).');
      return;
    }

    onAddTransformer(newSpec);
    onSelectTransformer(newSpec);
    setSavedSuccessMessage(`Placa ${newSpec.powerKva} kVA (${oilType === 'VEGETAL' ? 'Óleo Vegetal' : 'Óleo Mineral'}) salva no banco com sucesso!`);
    setTimeout(() => setSavedSuccessMessage(null), 3500);
  };

  const handleSelectPreSavedModel = (id: string) => {
    if (!id) {
      onSelectTransformer({
        id: '',
        category: 'NOVO',
        phaseType: 'TRIFASICO',
        powerKva: 0,
        primaryVoltageV: 0,
        secondaryVoltageV: 0,
        secondaryNeutralV: 0,
        impedancePercent: 0,
        oilTempC: 0,
        noLoadLossW: 0,
        loadLoss75cW: 0,
        totalLossW: 0,
        efficiencyPercent: 0,
        standardReference: 'Dados da Placa do Transformador',
        dateAdded: new Date().toISOString()
      });
      if (onChangeInitialData && initialData) {
        onChangeInitialData({
          ...initialData,
          transformerBrand: '',
          serialNumber: ''
        });
      }
      return;
    }
    const found = allTransformers.find((t) => t.id === id);
    if (found) {
      onSelectTransformer(found);
      if (onChangeInitialData && initialData) {
        onChangeInitialData({
          ...initialData,
          transformerBrand: found.brand || '',
          serialNumber: found.serialNumber || initialData.serialNumber || ''
        });
      }
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              2. DADOS DA PLACA DO TRANSFORMADOR E BANCO TÉCNICO
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Preencha os dados reais da Placa do Equipamento para cálculo de Perdas e Eficiência
            </p>
          </div>
        </div>

        {savedSuccessMessage && (
          <div className="text-[11px] font-bold font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{savedSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* 1. Carregar Dados de uma Placa Cadastrada no Banco de Dados (NO TOPO) */}
      <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
        <label className="label-xs mb-1 block text-blue-700 dark:text-blue-400 font-bold">
          CARREGAR DADOS DE UMA PLACA JÁ CADASTRADA NO BANCO DE DADOS
        </label>
        <select
          value={selectedTransformer.id || ''}
          onChange={(e) => handleSelectPreSavedModel(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-blue-300 dark:border-blue-700/80 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono font-bold focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 focus:outline-none cursor-pointer"
        >
          <option value="">-- Selecionar Placa do Banco de Dados (ou preencher campos abaixo) --</option>
          {allTransformers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id} — %Z: {t.impedancePercent}% | η: {t.efficiencyPercent}%
            </option>
          ))}
        </select>
      </div>

      {/* 2. Situação do Equipamento & Tipo de Fase */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Situação do Equipamento (Novo vs Usado/Recondicionado) */}
        <div>
          <label className="label-xs mb-1 block">SITUAÇÃO DO EQUIPAMENTO</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setCategory('USADO');
                const norm = computeNominalLossesAndEfficiency(numPower, phaseType, 'USADO', 0, 0, windingMaterial);
                setNoLoadLossW(norm.noLoadLossW || '');
                setLoadLoss75cW(norm.loadLoss75cW || '');
                updateActiveTransformer({ category: 'USADO', noLoadLossW: norm.noLoadLossW, loadLoss75cW: norm.loadLoss75cW });
              }}
              className={`p-2 rounded border text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                category === 'USADO'
                  ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-600 dark:border-amber-500 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/50'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>USADO</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCategory('RECONDICIONADO');
                const norm = computeNominalLossesAndEfficiency(numPower, phaseType, 'RECONDICIONADO', 0, 0, windingMaterial);
                setNoLoadLossW(norm.noLoadLossW || '');
                setLoadLoss75cW(norm.loadLoss75cW || '');
                updateActiveTransformer({ category: 'RECONDICIONADO', noLoadLossW: norm.noLoadLossW, loadLoss75cW: norm.loadLoss75cW });
              }}
              className={`p-2 rounded border text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                category === 'RECONDICIONADO'
                  ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-600 dark:border-purple-500 text-purple-900 dark:text-purple-200 ring-1 ring-purple-500/50'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>RECONDICIONADO</span>
            </button>
          </div>
        </div>

        {/* Tipo de Fase (Monofásico, Trifásico) */}
        <div>
          <label className="label-xs mb-1 block">TIPO DE FASE</label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setPhaseType('MONOFASICO');
                const norm = computeNominalLossesAndEfficiency(numPower, 'MONOFASICO', category, 0, 0, windingMaterial);
                setNoLoadLossW(norm.noLoadLossW || '');
                setLoadLoss75cW(norm.loadLoss75cW || '');
                updateActiveTransformer({ phaseType: 'MONOFASICO', noLoadLossW: norm.noLoadLossW, loadLoss75cW: norm.loadLoss75cW });
              }}
              className={`py-2 px-1 rounded border text-center text-xs font-bold transition cursor-pointer ${
                phaseType === 'MONOFASICO'
                  ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
              }`}
            >
              Monofásico (1Ø)
            </button>

            <button
              type="button"
              onClick={() => {
                setPhaseType('TRIFASICO');
                const norm = computeNominalLossesAndEfficiency(numPower, 'TRIFASICO', category, 0, 0, windingMaterial);
                setNoLoadLossW(norm.noLoadLossW || '');
                setLoadLoss75cW(norm.loadLoss75cW || '');
                updateActiveTransformer({ phaseType: 'TRIFASICO', noLoadLossW: norm.noLoadLossW, loadLoss75cW: norm.loadLoss75cW });
              }}
              className={`py-2 px-1 rounded border text-center text-xs font-bold transition cursor-pointer ${
                phaseType === 'TRIFASICO'
                  ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
              }`}
            >
              Trifásico (3Ø)
            </button>
          </div>
        </div>
      </div>

      {/* 3. Plate Data Inputs Fed by Technician */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/80 space-y-3">
        {/* Identification Fields: TAG, MARCA, N° DE SÉRIE, LOCAL/ALIMENTADOR, DATA FABRICAÇÃO */}
        {initialData && onChangeInitialData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-700/80">
            <div>
              <label className="label-xs mb-1 block">TAG / N° TRANSFORMADOR</label>
              <input
                type="text"
                value={initialData.transformerTag || ''}
                onChange={(e) => onChangeInitialData({ ...initialData, transformerTag: e.target.value })}
                placeholder=""
                className="w-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-amber-900 dark:text-amber-200 focus:bg-white dark:focus:bg-slate-950 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="label-xs mb-1 block">MARCA / FABRICANTE</label>
              <input
                type="text"
                value={initialData.transformerBrand || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  onChangeInitialData({ ...initialData, transformerBrand: val });
                  updateActiveTransformer({ brand: val });
                }}
                placeholder=""
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="label-xs mb-1 block">N° DE SÉRIE</label>
              <input
                type="text"
                value={initialData.serialNumber || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  onChangeInitialData({ ...initialData, serialNumber: val });
                  updateActiveTransformer({ serialNumber: val });
                }}
                placeholder=""
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="label-xs mb-1 block">LOCAL/ALIMENTADOR</label>
              <input
                type="text"
                value={initialData.locationName || ''}
                onChange={(e) => onChangeInitialData({ ...initialData, locationName: e.target.value })}
                placeholder=""
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="label-xs mb-1 block">DATA FABRICAÇÃO</label>
              <input
                type="text"
                value={manufacturingDate}
                placeholder="MM/AAAA"
                onChange={(e) => {
                  const val = e.target.value;
                  setManufacturingDate(val);
                  updateActiveTransformer({ manufacturingDate: val });
                }}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Potencia kVA */}
          <div>
            <label className="label-xs mb-1 block">POTÊNCIA (kVA)</label>
            <input
              type="number"
              step="0.5"
              value={powerKva}
              placeholder=""
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Number(e.target.value);
                setPowerKva(val);
                const numV = val === '' ? 0 : val;
                const norm = computeNominalLossesAndEfficiency(numV, phaseType, category, 0, 0, windingMaterial);
                setNoLoadLossW(norm.noLoadLossW || '');
                setLoadLoss75cW(norm.loadLoss75cW || '');
                updateActiveTransformer({
                  powerKva: numV,
                  noLoadLossW: norm.noLoadLossW,
                  loadLoss75cW: norm.loadLoss75cW
                });
              }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Tensao Primario */}
          <div>
            <label className="label-xs mb-1 block">TENSÃO PRIM. (V)</label>
            <input
              type="number"
              step="100"
              value={primaryVoltageV}
              placeholder=""
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Number(e.target.value);
                setPrimaryVoltageV(val);
                updateActiveTransformer({ primaryVoltageV: val === '' ? 0 : val });
              }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Tensao Secundario F-F */}
          <div>
            <label className="label-xs mb-1 block">TENS. SEC. F-F (V)</label>
            <input
              type="number"
              value={secondaryVoltageV}
              placeholder=""
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Number(e.target.value);
                setSecondaryVoltageV(val);
                updateActiveTransformer({ secondaryVoltageV: val === '' ? 0 : val });
              }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Tensao Secundario F-N */}
          <div>
            <label className="label-xs mb-1 block">TENS. SEC. F-N (V)</label>
            <input
              type="number"
              value={secondaryNeutralV}
              placeholder=""
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Number(e.target.value);
                setSecondaryNeutralV(val);
                updateActiveTransformer({ secondaryNeutralV: val === '' ? 0 : val });
              }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Impedancia %Z */}
          <div>
            <label className="label-xs mb-1 block">IMPEDÂNCIA (%Z)</label>
            <input
              type="number"
              step="0.01"
              value={impedancePercent}
              placeholder=""
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Number(e.target.value);
                setImpedancePercent(val);
                updateActiveTransformer({ impedancePercent: val === '' ? 0 : val });
              }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-amber-800 dark:text-amber-300 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Temp Oleo (°C) */}
          <div>
            <label className="label-xs mb-1 block">TEMP. ÓLEO (°C)</label>
            <input
              type="number"
              value={oilTempC}
              placeholder=""
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Number(e.target.value);
                setOilTempC(val);
                updateActiveTransformer({ oilTempC: val === '' ? 0 : val });
              }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Tipo de Óleo Isolante e Enrolamentos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {/* Tipo de Óleo Isolante */}
          <div className="p-2.5 rounded bg-emerald-50/60 dark:bg-slate-900/80 border border-emerald-200 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="label-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                TIPO DE ÓLEO ISOLANTE (FLUIDO TÉRMICO)
              </label>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                NBR 10576 / NBR 15422
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setOilType('MINERAL');
                  updateActiveTransformer({ oilType: 'MINERAL' });
                }}
                className={`p-2 rounded border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                  oilType === 'MINERAL'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-500/50'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="text-left">
                  <div className="font-extrabold text-xs">🛢️ ÓLEO MINERAL</div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-normal">NBR 10576 (Convencional)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOilType('VEGETAL');
                  updateActiveTransformer({ oilType: 'VEGETAL' });
                }}
                className={`p-2 rounded border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                  oilType === 'VEGETAL'
                    ? 'bg-emerald-500/20 border-emerald-600 text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-600/50'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="text-left">
                  <div className="font-extrabold text-xs">🌱 ÓLEO VEGETAL</div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-normal">NBR 15422 (Éster Natural)</div>
                </div>
              </button>
            </div>

            <div className="text-[10px] font-mono bg-white dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              {oilType === 'VEGETAL' ? (
                <span><strong>Óleo Vegetal / Éster Natural:</strong> Elevado ponto de fulgor (&gt;300°C), fluido K-Class biodegradável de alta segurança contra incêndio e proteção estendida ao papel isolante (NBR 15422 / IEEE C57.147).</span>
              ) : (
                <span><strong>Óleo Mineral Isolante:</strong> Naftênico/parafínico padrão (NBR 10576). Ponto de fulgor ~140°C. Padrão operacional de redes de distribuição urbanas e rurais.</span>
              )}
            </div>
          </div>

          {/* Material dos Enrolamentos & Fator de Correção Térmica */}
          <div className="p-2.5 rounded bg-blue-50/60 dark:bg-slate-900/80 border border-blue-200 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="label-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                MATERIAL DOS ENROLAMENTOS (CONDUÇÃO TÉRMICA)
              </label>
              <div className="text-[10px] font-mono text-slate-600 dark:text-slate-400">
                ABNT NBR 5356-1
              </div>
            </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setWindingMaterial('ALUMINIO');
                const norm = computeNominalLossesAndEfficiency(numPower, phaseType, category, 0, 0, 'ALUMINIO');
                setNoLoadLossW(norm.noLoadLossW || '');
                setLoadLoss75cW(norm.loadLoss75cW || '');
                updateActiveTransformer({ windingMaterial: 'ALUMINIO', noLoadLossW: norm.noLoadLossW, loadLoss75cW: norm.loadLoss75cW });
              }}
              className={`p-2 rounded border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                windingMaterial === 'ALUMINIO'
                  ? 'bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/50'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-slate-500"></span>
                <div className="text-left">
                  <div className="font-extrabold text-xs">⚡ ALUMÍNIO (Al)</div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-normal">Padrão Concessionárias</div>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800 font-bold">
                Tk = 225,0 °C
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setWindingMaterial('COBRE');
                const norm = computeNominalLossesAndEfficiency(numPower, phaseType, category, 0, 0, 'COBRE');
                setNoLoadLossW(norm.noLoadLossW || '');
                setLoadLoss75cW(norm.loadLoss75cW || '');
                updateActiveTransformer({ windingMaterial: 'COBRE', noLoadLossW: norm.noLoadLossW, loadLoss75cW: norm.loadLoss75cW });
              }}
              className={`p-2 rounded border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                windingMaterial === 'COBRE'
                  ? 'bg-amber-500/20 border-amber-600 text-amber-900 dark:text-amber-200 ring-1 ring-amber-600/50'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600 border border-amber-700"></span>
                <div className="text-left">
                  <div className="font-extrabold text-xs">🔶 COBRE (Cu)</div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-normal">Alta Condutividade</div>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800 font-bold">
                Tk = 234,5 °C
              </span>
            </button>
          </div>

          <div className="text-[10px] font-mono bg-white dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-between flex-wrap gap-2">
            <span>
              <strong>Fator Térmico Kt:</strong> Kt = (Tk + T_óleo) / (Tk + 75°C) = ({windingMaterial === 'COBRE' ? 234.5 : 225.0} + {typeof oilTempC === 'number' && oilTempC > 0 ? oilTempC : 75}) / ({windingMaterial === 'COBRE' ? 234.5 : 225.0} + 75) = {
                (((windingMaterial === 'COBRE' ? 234.5 : 225.0) + (typeof oilTempC === 'number' && oilTempC > 0 ? oilTempC : 75)) / ((windingMaterial === 'COBRE' ? 234.5 : 225.0) + 75)).toFixed(3)
              }
            </span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">
              Pk_corrigida = Pk_75°C × (I / I_nom)² × Kt
            </span>
          </div>
        </div>
      </div>

        {/* Losses & Efficiency Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
          <div>
            <label className="label-xs mb-1 block">PERDAS EM VAZIO P0 (W)</label>
            <input
              type="number"
              value={noLoadLossW}
              placeholder=""
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Number(e.target.value);
                setNoLoadLossW(val);
                updateActiveTransformer({ noLoadLossW: val === '' ? 0 : val });
              }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="label-xs mb-1 block">PERDAS EM CARGA Pk (W)</label>
            <input
              type="number"
              value={loadLoss75cW}
              placeholder=""
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Number(e.target.value);
                setLoadLoss75cW(val);
                updateActiveTransformer({ loadLoss75cW: val === '' ? 0 : val });
              }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="label-xs mb-1 block">PERDAS TOTAIS (P0+Pk)</label>
            <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-extrabold text-slate-800 dark:text-slate-200">
              {calculatedLosses.totalLossW} W
            </div>
          </div>

          <div>
            <label className="label-xs mb-1 block text-emerald-800 dark:text-emerald-400">EFICIÊNCIA NOMINAL (%)</label>
            <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded px-2.5 py-1 text-xs font-mono font-extrabold text-emerald-800 dark:text-emerald-300">
              {displayedEfficiencyPercent}%
            </div>
          </div>
        </div>

        {/* Dynamic Tap Bank Configuration Block */}
        <div className="p-3 bg-amber-50/50 dark:bg-slate-800/60 rounded-lg border border-amber-200/80 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-amber-200/80 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wider">
                CONFIGURAÇÃO DO COMUTADOR DE TAPS (TENSÃO EM CADA POSIÇÃO)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                QTD. DE TAPs DO TRAFO:
              </label>
              <div className="flex items-center gap-1">
                {[3, 5, 7].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => handleTapCountChange(count)}
                    className={`px-2 py-0.5 rounded text-xs font-bold font-mono transition cursor-pointer ${
                      tapCount === count
                        ? 'bg-amber-600 dark:bg-amber-600 text-white border border-amber-700 dark:border-amber-500 shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {count} TAPs
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={tapCount}
                  onChange={(e) => handleTapCountChange(Math.max(1, Math.min(15, Number(e.target.value) || 1)))}
                  className="w-12 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1 py-0.5 text-xs text-center font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* TAP Voltage Levels & Active Selector Grid */}
          <div className="space-y-2">
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              Defina o nível de tensão primária (V) para cada posição e selecione qual TAP está ligado no campo:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {Array.from({ length: tapCount }, (_, i) => i + 1).map((pos) => {
                const isActive = activeTapIndex === pos;
                const currentV = tapVoltages[pos] !== undefined ? tapVoltages[pos] : 0;
                const kvValue = currentV > 0 ? (currentV / 1000).toFixed(3) : '0';

                return (
                  <div
                    key={pos}
                    onClick={() => handleSelectActiveTap(pos)}
                    className={`p-2 rounded border transition cursor-pointer flex flex-col justify-between ${
                      isActive
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 dark:border-amber-500 shadow-xs ring-1 ring-amber-500/50'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-mono font-extrabold ${isActive ? 'text-amber-900 dark:text-amber-200' : 'text-slate-700 dark:text-slate-200'}`}>
                        TAP {pos}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectActiveTap(pos);
                        }}
                        className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded transition ${
                          isActive
                            ? 'bg-amber-600 dark:bg-amber-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                        }`}
                      >
                        {isActive ? '✓ ATIVO' : 'USAR TAP'}
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                        TENSÃO PRIMÁRIA (V)
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={currentV || ''}
                        placeholder=""
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleTapVoltageChange(pos, e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none"
                      />
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block mt-0.5 text-right min-h-[15px]">
                        {currentV > 0 ? `${kvValue} kV` : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end pt-1 flex-wrap gap-2">
              <div className="text-xs font-mono font-bold text-amber-900 dark:text-amber-200 bg-amber-100/80 dark:bg-amber-950/60 px-3 py-1 rounded border border-amber-300 dark:border-amber-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-600 dark:bg-amber-400 inline-block animate-pulse"></span>
                TAP Em Operação: TAP {activeTapIndex} ({tapVoltages[activeTapIndex] ? tapVoltages[activeTapIndex] + ' V / ' + (tapVoltages[activeTapIndex] / 1000).toFixed(3) + ' kV' : 'N/I'})
              </div>
            </div>
          </div>
        </div>

        {/* Actions Bar - Placed at the very end of Block 2 */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleResetDefaultTaps}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              <span>Calcular TAPs Padrão (+5%, Nominal, -5%)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveToDatabase}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar Esta Placa no Banco de Dados</span>
          </button>
        </div>
      </div>
    </div>
  );
};
