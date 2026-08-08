import { useCallback } from 'react';
import { useProject } from '../store/ProjectContext';
import { translate, type TranslationKey } from './catalogs';

export const useI18n = () => {
  const { project } = useProject();
  const language = project.settings.language;
  const t = useCallback(
    (key: TranslationKey, variables?: Record<string, string | number>) =>
      translate(language, key, variables),
    [language],
  );
  return { language, t };
};
