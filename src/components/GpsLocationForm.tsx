import React, { useState } from 'react';
import { MapPin, Navigation, User, Calendar, Building2, CheckCircle2, AlertCircle, Loader2, Award, Users, Plus, Trash2 } from 'lucide-react';
import { InitialDiagnosticData, ReportAuthor, AuthorRole } from '../types';
import { getCurrentGpsPosition, latLonToUtm, utmToLatLon } from '../utils/geoUtm';

interface GpsLocationFormProps {
  initialData: InitialDiagnosticData;
  onChange: (updated: InitialDiagnosticData) => void;
}

const CONCESSIONARIAS = [
  'Energisa'
];

export const GpsLocationForm: React.FC<GpsLocationFormProps> = ({ initialData, onChange }) => {
  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsSuccess, setGpsSuccess] = useState(false);

  // Local state for Lat / Lon input strings to allow free typing
  const [latInput, setLatInput] = useState<string>(
    initialData.utm?.latitude ? String(initialData.utm.latitude) : ''
  );
  const [lonInput, setLonInput] = useState<string>(
    initialData.utm?.longitude ? String(initialData.utm.longitude) : ''
  );

  // Local state for UTM inputs (Easting, Northing, Zone)
  const [eastingInput, setEastingInput] = useState<string>(
    initialData.utm?.easting ? String(initialData.utm.easting) : ''
  );
  const [northingInput, setNorthingInput] = useState<string>(
    initialData.utm?.northing ? String(initialData.utm.northing) : ''
  );
  const [zoneInput, setZoneInput] = useState<string>(
    initialData.utm?.zone || ''
  );

  // Sync inputs if initialData.utm changes externally (e.g., via GPS button)
  React.useEffect(() => {
    if (initialData.utm) {
      if (initialData.utm.latitude !== undefined) setLatInput(String(initialData.utm.latitude));
      if (initialData.utm.longitude !== undefined) setLonInput(String(initialData.utm.longitude));
      if (initialData.utm.easting !== undefined) setEastingInput(String(Math.round(initialData.utm.easting)));
      if (initialData.utm.northing !== undefined) setNorthingInput(String(Math.round(initialData.utm.northing)));
      if (initialData.utm.zone) setZoneInput(initialData.utm.zone);
    }
  }, [
    initialData.utm?.latitude,
    initialData.utm?.longitude,
    initialData.utm?.easting,
    initialData.utm?.northing,
    initialData.utm?.zone
  ]);

  // Auto-fill initial date and time if empty
  React.useEffect(() => {
    if (!initialData.dateTime) {
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR');
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      onChange({
        ...initialData,
        dateTime: `${dateStr} ${timeStr}`
      });
    }
  }, []);

  const handleManualCoordUpdate = async (newLatStr: string, newLonStr: string) => {
    setLatInput(newLatStr);
    setLonInput(newLonStr);

    const latNum = parseFloat(newLatStr.replace(',', '.'));
    const lonNum = parseFloat(newLonStr.replace(',', '.'));

    if (!isNaN(latNum) && !isNaN(lonNum) && latNum !== 0 && lonNum !== 0) {
      const newUtm = latLonToUtm(latNum, lonNum);
      setEastingInput(String(newUtm.easting));
      setNorthingInput(String(newUtm.northing));
      setZoneInput(newUtm.zone || '');

      onChange({
        ...initialData,
        utm: newUtm
      });
    }
  };

  const handleManualUtmUpdate = async (newEStr: string, newNStr: string, newZoneStr: string) => {
    setEastingInput(newEStr);
    setNorthingInput(newNStr);
    setZoneInput(newZoneStr);

    const eastingNum = parseFloat(newEStr.replace(',', '.'));
    const northingNum = parseFloat(newNStr.replace(',', '.'));

    if (!isNaN(eastingNum) && !isNaN(northingNum) && eastingNum > 0 && northingNum > 0) {
      const convertedLatLon = utmToLatLon(eastingNum, northingNum, newZoneStr || '23K', true);
      setLatInput(String(convertedLatLon.latitude));
      setLonInput(String(convertedLatLon.longitude));

      onChange({
        ...initialData,
        utm: {
          easting: eastingNum,
          northing: northingNum,
          zone: newZoneStr || '',
          hemisphere: 'S',
          latitude: convertedLatLon.latitude,
          longitude: convertedLatLon.longitude
        }
      });
    }
  };

  const handleAcquireGps = async () => {
    setIsLoadingGps(true);
    setGpsError(null);
    setGpsSuccess(false);

    try {
      const utm = await getCurrentGpsPosition();
      
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR');
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const currentDateTime = `${dateStr} ${timeStr}`;

      setLatInput(String(utm.latitude));
      setLonInput(String(utm.longitude));

      onChange({
        ...initialData,
        utm,
        dateTime: currentDateTime
      });
      setGpsSuccess(true);
    } catch (err: any) {
      setGpsError(err.message || 'Erro ao capturar sinal de GPS.');
    } finally {
      setIsLoadingGps(false);
    }
  };

  // Authors list initialized from initialData.authors or fallback to legacy fields
  const authors: ReportAuthor[] = (initialData.authors && initialData.authors.length > 0)
    ? initialData.authors
    : [
        {
          id: '1',
          role: 'ELETRICISTA',
          name: initialData.electrician1Name || '',
          matricula: initialData.electrician1Matricula || ''
        },
        ...(initialData.electrician2Name ? [{
          id: '2',
          role: 'ELETRICISTA',
          name: initialData.electrician2Name,
          matricula: initialData.electrician2Matricula || ''
        }] : [])
      ];

  const updateAuthors = (newAuthors: ReportAuthor[]) => {
    onChange({
      ...initialData,
      authors: newAuthors,
      electrician1Name: newAuthors[0]?.name || '',
      electrician1Matricula: newAuthors[0]?.matricula || '',
      electrician2Name: newAuthors[1]?.name || '',
      electrician2Matricula: newAuthors[1]?.matricula || ''
    });
  };

  const handleAddAuthor = () => {
    const newAuthor: ReportAuthor = {
      id: Date.now().toString(),
      role: 'ELETRICISTA',
      name: '',
      matricula: ''
    };
    updateAuthors([...authors, newAuthor]);
  };

  const handleRemoveAuthor = (index: number) => {
    if (authors.length <= 1) return;
    const updated = authors.filter((_, i) => i !== index);
    updateAuthors(updated);
  };

  const handleAuthorFieldChange = (index: number, field: keyof ReportAuthor, value: string) => {
    const updated = [...authors];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    updateAuthors(updated);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              1. DADOS INICIAIS DO DIAGNÓSTICO E LOCALIZAÇÃO
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Aquisição direta do sensor GPS do dispositivo (sem provedor de internet / IP) e conversão automática para coordenadas UTM (WGS84)
            </p>
          </div>
        </div>

        <button
          onClick={handleAcquireGps}
          disabled={isLoadingGps}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs border border-blue-700 transition cursor-pointer shrink-0"
        >
          {isLoadingGps ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
          ) : (
            <Navigation className="w-3.5 h-3.5" />
          )}
          <span>{isLoadingGps ? 'BUSCANDO SINAL...' : 'ADQUIRIR VIA GPS'}</span>
        </button>
      </div>

      {gpsError && (
        <div className="mb-3 p-2.5 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{gpsError} Você pode preencher as coordenadas manualmente abaixo.</span>
        </div>
      )}

      {gpsSuccess && (
        <div className="mb-3 p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>Coordenadas GPS e UTM adquiridas com sucesso! (Precisão: {initialData.utm?.accuracyMeters || 5}m)</span>
        </div>
      )}

      {/* Coordinates Inputs & UTM Summary */}
      <div className="mb-3 p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/80 space-y-2">
        <div className="flex items-center justify-between pb-1">
          <label className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>COORDENADAS GEOGRÁFICAS E LOCALIZAÇÃO UTM</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Latitude */}
          <div>
            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
              LATITUDE (GRAUS DECIMAIS)
            </label>
            <input
              type="text"
              value={latInput}
              placeholder=""
              onChange={(e) => handleManualCoordUpdate(e.target.value, lonInput)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Longitude */}
          <div>
            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
              LONGITUDE (GRAUS DECIMAIS)
            </label>
            <input
              type="text"
              value={lonInput}
              placeholder=""
              onChange={(e) => handleManualCoordUpdate(latInput, e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* UTM Zona */}
          <div>
            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
              ZONA UTM
            </label>
            <input
              type="text"
              value={zoneInput}
              placeholder=""
              onChange={(e) => handleManualUtmUpdate(eastingInput, northingInput, e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-blue-900 dark:text-blue-300 focus:border-blue-500 focus:outline-none uppercase"
            />
          </div>

          {/* UTM Easting (E) */}
          <div>
            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
              EIXO X / UTM LESTE (E)
            </label>
            <input
              type="text"
              value={eastingInput}
              placeholder=""
              onChange={(e) => handleManualUtmUpdate(e.target.value, northingInput, zoneInput)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-blue-900 dark:text-blue-300 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* UTM Northing (N) */}
          <div>
            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
              EIXO Y / UTM NORTE (N)
            </label>
            <input
              type="text"
              value={northingInput}
              placeholder=""
              onChange={(e) => handleManualUtmUpdate(eastingInput, e.target.value, zoneInput)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-blue-900 dark:text-blue-300 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Dados Gerais: Data, Concessionária, Cidade, Equipe */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {/* Data e Hora */}
        <div>
          <label className="label-xs mb-1 flex items-center gap-1 min-h-[18px]">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>DATA E HORA</span>
          </label>
          <input
            type="text"
            value={initialData.dateTime}
            onChange={(e) => onChange({ ...initialData, dateTime: e.target.value })}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono font-bold focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 focus:outline-none"
            placeholder="DD/MM/AAAA HH:MM"
          />
        </div>

        {/* Concessionária */}
        <div>
          <label className="label-xs mb-1 flex items-center gap-1 min-h-[18px]">
            <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>CONCESSIONÁRIA</span>
          </label>
          <select
            value={initialData.concessionaria || 'Energisa'}
            onChange={(e) => onChange({ ...initialData, concessionaria: e.target.value })}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono font-bold focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 focus:outline-none cursor-pointer"
          >
            {CONCESSIONARIAS.map((conc) => (
              <option key={conc} value={conc}>
                {conc}
              </option>
            ))}
          </select>
        </div>

        {/* Cidade / Estado */}
        <div>
          <label className="label-xs mb-1 flex items-center gap-1 min-h-[18px]">
            <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>CIDADE / ESTADO</span>
          </label>
          <input
            type="text"
            value={initialData.cityState}
            onChange={(e) => onChange({ ...initialData, cityState: e.target.value })}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 focus:outline-none"
            placeholder="Cidade - UF"
          />
        </div>

        {/* Campo EQUIPE */}
        <div>
          <label className="label-xs mb-1 flex items-center gap-1 min-h-[18px]">
            <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>EQUIPE</span>
          </label>
          <input
            type="text"
            value={initialData.equipe || ''}
            onChange={(e) => onChange({ ...initialData, equipe: e.target.value })}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 focus:outline-none"
            placeholder="Nome ou código da equipe (opcional)"
          />
        </div>
      </div>

      {/* Seção Dinâmica de Autores do Laudo (Técnicos / Eletricistas) */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/80">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700/60 flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              AUTORES DO LAUDO (TÉCNICOS E/OU ELETRICISTAS)
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              ({authors.length} autor{authors.length > 1 ? 'es' : ''})
            </span>
          </div>

          <button
            type="button"
            onClick={handleAddAuthor}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ADICIONAR TÉCNICO / ELETRICISTA</span>
          </button>
        </div>

        <div className="space-y-2.5">
          {authors.map((author, index) => (
            <div
              key={author.id || index}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 items-end shadow-xs"
            >
              {/* Função / Papel */}
              <div className="sm:col-span-3">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  FUNÇÃO / CARGO #{index + 1}
                </label>
                <select
                  value={author.role}
                  onChange={(e) => handleAuthorFieldChange(index, 'role', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="ELETRICISTA">ELETRICISTA</option>
                  <option value="TÉCNICO">TÉCNICO</option>
                  <option value="ENGENHEIRO">ENGENHEIRO</option>
                </select>
              </div>

              {/* Nome */}
              <div className="sm:col-span-5">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  NOME COMPLETO
                </label>
                <input
                  type="text"
                  value={author.name}
                  onChange={(e) => handleAuthorFieldChange(index, 'name', e.target.value)}
                  placeholder={`Nome do ${author.role.toLowerCase()}`}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Matrícula */}
              <div className="sm:col-span-3">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  MATRÍCULA / REGISTRO
                </label>
                <input
                  type="text"
                  value={author.matricula}
                  onChange={(e) => handleAuthorFieldChange(index, 'matricula', e.target.value)}
                  placeholder="Nº matrícula (opcional)"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Remover (se mais de 1) */}
              <div className="sm:col-span-1 flex justify-end">
                {authors.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveAuthor(index)}
                    title="Remover autor"
                    className="p-1.5 rounded text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/60 transition cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-8 h-8" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
