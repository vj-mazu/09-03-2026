import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = { hasError: false, error: null };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    minHeight: '60vh', padding: '40px', textAlign: 'center'
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #fff5f5, #fee2e2)', borderRadius: '16px',
                        padding: '40px', maxWidth: '500px', width: '100%',
                        boxShadow: '0 4px 20px rgba(239,68,68,0.15)', border: '1px solid #fecaca'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                        <h2 style={{ margin: '0 0 8px', fontSize: '20px', color: '#991b1b', fontWeight: '700' }}>
                            Something went wrong
                        </h2>
                        <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#7f1d1d', lineHeight: '1.5' }}>
                            An unexpected error occurred. Please try again.
                        </p>
                        {this.state.error && (
                            <details style={{ marginBottom: '16px', textAlign: 'left' }}>
                                <summary style={{ cursor: 'pointer', fontSize: '12px', color: '#b91c1c', fontWeight: '600' }}>
                                    Error Details
                                </summary>
                                <pre style={{
                                    fontSize: '11px', color: '#7f1d1d', background: '#fef2f2',
                                    padding: '8px', borderRadius: '4px', overflow: 'auto', marginTop: '8px',
                                    maxHeight: '120px', whiteSpace: 'pre-wrap', wordBreak: 'break-all'
                                }}>
                                    {this.state.error.message}
                                </pre>
                            </details>
                        )}
                        <button
                            onClick={this.handleRetry}
                            style={{
                                padding: '10px 24px', backgroundColor: '#ef4444', color: 'white',
                                border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600',
                                cursor: 'pointer', transition: 'background 0.2s'
                            }}
                            onMouseOver={e => (e.currentTarget.style.backgroundColor = '#dc2626')}
                            onMouseOut={e => (e.currentTarget.style.backgroundColor = '#ef4444')}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
