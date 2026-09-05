import React from 'react';
import { SettingsView } from '../components/SettingsView';
import type { TransformerSpec } from '../types';
import type { OfflineDatabaseStatus } from '../utils/sqliteAndSplitLoader';

interface SettingsPageProps {
  transformers: TransformerSpec[];
  databaseState: {
    loading: boolean;
    error: string;
    transformerCount: number;
    inmetroModelCount: number;
    fuseCount: number;
    schemaVersion: number;
    generatedAt: string;
    source: OfflineDatabaseStatus['source'];
  };
  handleSyncApplied: (
    communityTransformers: TransformerSpec[],
    normativeTransformers: TransformerSpec[] | null,
    status: OfflineDatabaseStatus
  ) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  transformers,
  databaseState,
  handleSyncApplied
}) => {
  return (
    <SettingsView
      transformers={transformers}
      databaseState={databaseState}
      onSyncApplied={handleSyncApplied}
    />
  );
};

