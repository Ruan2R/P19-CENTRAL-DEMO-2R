import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('P19 failed to render:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: '100vh', padding: '32px 20px', display: 'grid', placeContent: 'center', gap: '14px', background: '#f5f7fa', color: '#182638', fontFamily: 'Arial, sans-serif' }}>
          <h1 style={{ margin: 0, fontSize: '24px' }}>A demonstração encontrou um erro</h1>
          <p style={{ margin: 0, maxWidth: '560px', lineHeight: 1.6 }}>A tela não conseguiu iniciar corretamente. O detalhe abaixo ajuda a identificar o problema:</p>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: '14px', borderRadius: '10px', background: '#fff', border: '1px solid #dce4ec', fontSize: '12px' }}>{String(this.state.error?.message || this.state.error)}</pre>
          <button type="button" onClick={() => window.location.reload()} style={{ minHeight: '46px', border: 0, borderRadius: '10px', padding: '0 18px', background: '#00529d', color: '#fff', fontWeight: 700 }}>Recarregar demonstração</button>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
