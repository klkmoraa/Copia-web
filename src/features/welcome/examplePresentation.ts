import type { TranslationKey } from '../../i18n/catalogs';

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

const exampleCopy: Record<string, { name: TranslationKey; description: TranslationKey }> = {
  'Hibbeler · carga tributaria Fig. 2–11': {
    name: 'examples.hibbelerTributaryName',
    description: 'examples.hibbelerTributaryDescription',
  },
  'Práctica tipo Hibbeler · diagramas': {
    name: 'examples.hibbelerDiagramsName',
    description: 'examples.hibbelerDiagramsDescription',
  },
  'Práctica tipo Hibbeler · armadura': {
    name: 'examples.hibbelerTrussName',
    description: 'examples.hibbelerTrussDescription',
  },
  'Pórtico de ejemplo': {
    name: 'examples.frameName',
    description: 'examples.frameDescription',
  },
  'Viga simplemente apoyada': {
    name: 'examples.simpleBeamName',
    description: 'examples.simpleBeamDescription',
  },
  'Armadura triangular': {
    name: 'examples.triangularTrussName',
    description: 'examples.triangularTrussDescription',
  },
};

export const presentExample = (name: string, description: string, t: Translate) => {
  const copy = exampleCopy[name];
  return copy
    ? { name: t(copy.name), description: t(copy.description) }
    : { name, description };
};
