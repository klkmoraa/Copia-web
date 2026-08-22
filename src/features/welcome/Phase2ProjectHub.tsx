import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import { ProjectHub } from '../project-hub/ProjectHub';

export const Phase2ProjectHub = ({ onOpenWorkspace }: { onOpenWorkspace: () => void }) => {
  const { replaceProject } = useProject();
  const { language } = useI18n();
  return <ProjectHub onOpen={(record) => {
    replaceProject({ ...record.project, settings: { ...record.project.settings, language } }, undefined, record.revision);
    onOpenWorkspace();
  }} />;
};
