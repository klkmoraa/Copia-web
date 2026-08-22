import { ArrowRight, Upload } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { DxfImportDialog } from '../../import/dxf/DxfImportDialog';

export const Phase2DxfAction = ({
  open,
  onOpenChange,
  onOpenWorkspace,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenWorkspace: () => void;
}) => {
  const { t } = useI18n();
  return <>
    <button type="button" className="welcome-import-card welcome-import-card--dxf" onClick={() => onOpenChange(true)}>
      <span className="welcome-import-icon"><Upload size={20} /></span>
      <span className="welcome-import-text">
        <strong>{t('welcome.importDxf')}</strong>
        <small>{t('welcome.importDxfDescription')}</small>
      </span>
      <ArrowRight size={16} className="welcome-launcher-arrow" />
    </button>
    {open ? <DxfImportDialog
      open
      onOpenChange={onOpenChange}
      onImported={() => {
        onOpenChange(false);
        onOpenWorkspace();
      }}
    /> : null}
  </>;
};
