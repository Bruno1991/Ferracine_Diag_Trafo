import React from 'react';
import { FormulaKey, getFormulaSvgString } from '../utils/formulaSvgs';

interface FormulaSvgProps {
  formula: FormulaKey;
  className?: string;
}

export const FormulaSvg: React.FC<FormulaSvgProps> = ({ formula, className = '' }) => {
  const svgXml = getFormulaSvgString(formula, false);

  return (
    <div
      className={`w-full flex justify-center items-center overflow-x-auto select-none ${className}`}
      dangerouslySetInnerHTML={{ __html: svgXml }}
    />
  );
};
