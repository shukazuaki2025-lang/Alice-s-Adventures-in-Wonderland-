import { createRoot } from 'react-dom/client';
import { App } from './App';

console.log('[Alice: Down the Rabbit-Hole] Initializing React game runtime...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in DOM');
}

const root = createRoot(rootElement);
root.render(<App />);
