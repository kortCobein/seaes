import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Prevent a blank page if a client-side rendering exception occurs. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('SEAES rendering error', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="loading-screen" role="alert">
      <h1>SEAES no pudo mostrar la interfaz</h1>
      <p>Comprueba que estén publicados el index.html, assets/ y data/ de la misma compilación.</p>
      <button className="button primary" onClick={() => location.reload()}>Volver a cargar</button>
    </main>;
  }
}
