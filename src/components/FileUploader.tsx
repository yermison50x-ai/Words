import { useRef } from 'react';

interface FileUploaderProps {
  onFileLoad: (arrayBuffer: ArrayBuffer, filename: string) => void;
}

export function FileUploader({ onFileLoad }: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    onFileLoad(arrayBuffer, file.name);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    onFileLoad(arrayBuffer, file.name);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <div className="file-uploader">
      <div
        className="drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="drop-zone-content">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="title">Drop .wld file here or click to browse</p>
          <p className="subtitle">Serious Engine 1 World Files (.wld)</p>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".wld"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
