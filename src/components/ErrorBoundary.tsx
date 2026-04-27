import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State;
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Algo salió mal.";
      try {
        // Check if it's a Firestore error
        const firestoreError = JSON.parse(this.state.error?.message || "");
        if (firestoreError.error) {
          errorMessage = `Error de base de datos: ${firestoreError.error}`;
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] p-6 text-center text-white">
          <h2 className="mb-4 text-2xl font-bold">Error en la aplicación</h2>
          <p className="mb-6 text-white/60">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-black transition-all hover:scale-105"
          >
            Recargar Aplicación
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
