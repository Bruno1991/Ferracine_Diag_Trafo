import React from 'react';
import { DatabaseExplorer } from '../components/DatabaseExplorer';
import { TransformerSpec, InmetroTransformerModel } from '../types';

interface DatabasePageProps {
  transformers: TransformerSpec[];
  setTransformers: React.Dispatch<React.SetStateAction<TransformerSpec[]>>;
  inmetroModels: InmetroTransformerModel[];
  setInmetroModels: React.Dispatch<React.SetStateAction<InmetroTransformerModel[]>>;
  handleAddTransformer: (newTrafo: TransformerSpec) => void;
  handleUpdateTransformers: (updated: TransformerSpec[]) => void;
}

export const DatabasePage: React.FC<DatabasePageProps> = (props) => {
  const {
    transformers,
    inmetroModels,
    setInmetroModels,
    handleAddTransformer,
    handleUpdateTransformers,
  } = props;

  return (
    <DatabaseExplorer
      transformers={transformers}
      inmetroModels={inmetroModels}
      onAddTransformer={handleAddTransformer}
      onUpdateTransformers={handleUpdateTransformers}
      onInmetroModelsUpdated={setInmetroModels}
    />
  );
};

