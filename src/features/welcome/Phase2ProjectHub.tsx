import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import { ProjectHub } from '../project-hub/ProjectHub';

export const Phase2ProjectHub = ({ onOpenWorkspace, filter }: { onOpenWorkspace: () => void; filter?: string }) => {
  const { replaceProject } = useProject();
  const { language } = useI18n();
  return <ProjectHub filter={filter} onOpen={(record) => {
    replaceProject({ ...record.project, settings: { ...record.project.settings, language } }, undefined, record.revision);
    onOpenWorkspace();
  }} />;
};
