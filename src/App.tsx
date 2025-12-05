import { useState } from 'react';
import { FileUploader } from './components/FileUploader';
import { WldViewer } from './components/WldViewer';
import { WorldInfo } from './components/WorldInfo';
import { Console, ConsoleMessage } from './components/Console';
import { WldParser, WldWorld } from './lib/WldParser';
import './App.css';

function App() {
  const [world, setWorld] = useState<WldWorld | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);

  const addConsoleMessage = (type: 'info' | 'warn' | 'error' | 'success', message: string) => {
    setConsoleMessages(prev => [...prev, {
      type,
      message,
      timestamp: new Date()
    }]);
  };

  const handleFileLoad = async (arrayBuffer: ArrayBuffer, filename: string) => {
    setLoading(true);
    setError('');
    setConsoleMessages([]);

    try {
      addConsoleMessage('info', `Loading file: ${filename}`);
      addConsoleMessage('info', `File size: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`);

      const parser = new WldParser(arrayBuffer, addConsoleMessage);
      const parsedWorld = parser.parse();

      setWorld(parsedWorld);
      setFilename(filename);

      addConsoleMessage('success', 'File loaded successfully!');
      console.log('Parsed world:', parsedWorld);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Error loading file: ${errorMsg}`);
      addConsoleMessage('error', `Parse failed: ${errorMsg}`);
      console.error('Parse error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Serious Engine 1 - WLD Viewer</h1>
        <p className="subtitle">3D World File Viewer</p>
      </header>

      <main className="app-main">
        {!world && !loading && (
          <FileUploader onFileLoad={handleFileLoad} />
        )}

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <p>Loading world...</p>
          </div>
        )}

        {error && (
          <div className="error">
            <p>{error}</p>
            <button onClick={() => { setError(''); setWorld(null); }}>Try Again</button>
          </div>
        )}

        {world && (
          <div className="viewer-layout">
            <aside className="sidebar">
              <WorldInfo world={world} filename={filename} />
              <button
                className="load-new-btn"
                onClick={() => { setWorld(null); setConsoleMessages([]); }}
              >
                Load New File
              </button>
            </aside>
            <div className="viewer-main">
              <WldViewer world={world} />
            </div>
          </div>
        )}

        <Console messages={consoleMessages} />
      </main>
    </div>
  );
}

export default App;
