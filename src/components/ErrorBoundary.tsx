import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * React Error Boundary — catches any render/lifecycle error in child components
 * and shows a user-friendly fallback instead of a blank white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
    public state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('🔴 ErrorBoundary caught:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    minHeight: '300px',
                    padding: '40px',
                    fontFamily: 'system-ui, sans-serif',
                    color: '#374151',
                }}>
                    <div style={{
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: '12px',
                        padding: '32px',
                        maxWidth: '500px',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: '#991B1B' }}>
                            Algo salió mal
                        </h2>
                        <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '20px', lineHeight: 1.5 }}>
                            Ocurrió un error inesperado. Puedes intentar recargar esta sección o volver a la página principal.
                        </p>
                        {this.state.error && (
                            <details style={{
                                fontSize: '12px',
                                color: '#9CA3AF',
                                marginBottom: '20px',
                                textAlign: 'left',
                                background: '#F9FAFB',
                                padding: '12px',
                                borderRadius: '8px',
                            }}>
                                <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>Detalles técnicos</summary>
                                <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {this.state.error.message}
                                </code>
                            </details>
                        )}
                        <button
                            onClick={this.handleRetry}
                            style={{
                                background: '#B8925C',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '10px 24px',
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.background = '#a07d4d')}
                            onMouseOut={(e) => (e.currentTarget.style.background = '#B8925C')}
                        >
                            Reintentar
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
