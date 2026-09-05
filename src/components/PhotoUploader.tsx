import React, { useRef } from 'react';
import { Camera, Upload, Trash2, Image as ImageIcon, AlertCircle } from 'lucide-react';

interface PhotoUploaderProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({ photos, onPhotosChange }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Resize and compress uploaded image to max 1024px to optimize PDF build size
  const processFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1024;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
            resolve(compressedDataUrl);
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    const MAX_PHOTOS = 15;
    const availableSlots = MAX_PHOTOS - photos.length;
    const selectedFiles = files.slice(0, availableSlots);

    try {
      const processed = await Promise.all(selectedFiles.map(processFile));
      onPhotosChange([...photos, ...processed]);
    } catch (err) {
      console.error('Erro ao processar imagem:', err);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    const updated = photos.filter((_, i) => i !== index);
    onPhotosChange(updated);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4 transition-colors duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
            <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            REGISTROS FOTOGRÁFICOS DO TRANSFORMADOR (ATÉ 15 FOTOS)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Anexe imagens da placa, buchas, caixa de ligação e instalação em campo. Cada foto sairá em uma página dedicada no laudo PDF sem distorção.
          </p>
        </div>
        <span className="self-start sm:self-center text-xs font-mono font-bold px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          {photos.length} / 15 Fotos
        </span>
      </div>

      {/* Grid of uploaded photos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {photos.map((photoUrl, index) => (
          <div key={index} className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 aspect-square flex flex-col justify-between shadow-xs">
            <img
              src={photoUrl}
              alt={`Foto do Trafo ${index + 1}`}
              className="w-full h-full object-cover"
            />
            
            {/* Badge overlay */}
            <div className="absolute top-1.5 left-1.5 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-700">
              Foto {index + 1}
            </div>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => handleRemovePhoto(index)}
              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors shadow-xs cursor-pointer"
              title="Remover Foto"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* Upload Slot / Dropzone if < 15 photos */}
        {photos.length < 15 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 bg-slate-50 dark:bg-slate-800/40 hover:bg-blue-50/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer p-3 text-center space-y-1.5"
          >
            <div className="p-2 rounded-full bg-white dark:bg-slate-900 shadow-xs border border-slate-200 dark:border-slate-700">
              <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-bold">Adicionar Foto</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Clique ou tire foto</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {photos.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 p-2.5 rounded border border-amber-200 dark:border-amber-800/80">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Nenhuma foto anexada. Fotos da placa e do equipamento agregam valor técnico e comprovação pericial ao laudo PDF.</span>
        </div>
      )}
    </div>
  );
};
