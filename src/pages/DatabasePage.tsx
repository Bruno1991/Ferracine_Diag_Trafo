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
  handleSyncApplied: (
    communityTransformers: TransformerSpec[],
    normativeTransformers: TransformerSpec[] | null,
    status: any
  ) => void;
}

export const DatabasePage: React.FC<DatabasePageProps> = (props) => {
  const {
    transformers,
    setTransformers,
    inmetroModels,
    setInmetroModels,
    handleAddTransformer,
    handleUpdateTransformers,
    handleSyncApplied,
  } = props;

  return (
    <DatabaseExplorer
      transformers={transformers}
      setTransformers={setTransformers}
      inmetroModels={inmetroModels}
      setInmetroModels={setInmetroModels}
      onAddTransformer={handleAddTransformer}
      onUpdateTransformers={handleUpdateTransformers}
      onInmetroModelsUpdated={setInmetroModels}
    />
  );
};
