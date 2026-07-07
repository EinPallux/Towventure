import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.js';
import { useStore } from './store.js';
import './styles.css';

function Root() {
  const bootstrap = useStore((s) => s.bootstrap);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
