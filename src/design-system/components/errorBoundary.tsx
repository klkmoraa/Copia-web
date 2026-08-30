import { Component, type ErrorInfo, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from './controls';
import { EmptyState } from './feedback';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Qué pintar en lugar de la pantalla completa cuando el error se puede acotar.
   *
   * Sin esto, cualquier fallo se lleva por delante toda la aplicación — que es lo
   * correcto en la raíz y desproporcionado alrededor de un panel diferido: si el
   * chunk del asistente no carga, el usuario no tiene por qué perder de vista su
   * modelo. El texto lo pone quien llama porque el sistema de diseño no habla
   * ningún idioma; el de la raíz va fijo y en los dos a la vez justamente porque
   * allí el i18n puede ser lo que falló.
   */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Último cinturón de seguridad: un error de render después de montar no debe
 * dejar la pantalla en blanco. `index.html` ya cubre el caso de antes del
 * montaje (publicación obsoleta); este cubre el de después, dentro del árbol
 * de React. Sin contexto del proyecto ni del i18n —pueden ser justo lo que
 * falló—, así que el texto va fijo, en los dos idiomas a la vez.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[structureCo] Unhandled render error', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div className="sc-error-boundary" role="alert">
        <EmptyState
          icon={<TriangleAlert size={22} />}
          title="Algo se rompió en structureCo · Something broke in structureCo"
          description={<>
            <div>Ocurrió un error inesperado y esta pantalla no puede seguir. Tus proyectos guardados no se pierden: están en este navegador, no aquí.</div>
            <div>An unexpected error occurred and this screen can't continue. Your saved projects aren't lost — they live in this browser, not here.</div>
          </>}
          action={<Button variant="primary" onClick={this.handleReload}>Recargar · Reload</Button>}
        />
      </div>
    );
  }
}
