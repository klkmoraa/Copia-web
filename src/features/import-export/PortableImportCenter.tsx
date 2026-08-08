import { useMemo, type ComponentProps } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { ImportCenterDialog } from './ImportCenterDialog';
import { createPortableImportCenterAdapter } from './portableImportAdapter';

type PortableImportCenterProps = Omit<ComponentProps<typeof ImportCenterDialog>, 'adapter'>;

/** Lazy boundary keeps PDF/import workflow code out of the initial editor bundle. */
export const PortableImportCenter = (props: PortableImportCenterProps) => {
  const { language } = useI18n();
  const adapter = useMemo(() => createPortableImportCenterAdapter(language), [language]);
  return <ImportCenterDialog {...props} adapter={adapter} />;
};
