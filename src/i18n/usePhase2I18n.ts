import { useCallback } from 'react';
import { translatePhase2, type Phase2TranslationKey } from './phase2Catalogs';
import type { Language } from './catalogs';

export const usePhase2I18n = (language: Language) => {
  const t = useCallback(
    (key: Phase2TranslationKey, variables?: Record<string, string | number>) =>
      translatePhase2(language, key, variables),
    [language],
  );
  return { language, t };
};
