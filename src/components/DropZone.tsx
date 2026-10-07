import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import type { NamedText } from '../state/importFile';
import { UploadIcon } from './icons';

interface Props {
  onFiles: (files: NamedText[]) => void;
  variant?: 'hero' | 'compact';
  children?: ReactNode;
}

export async function readFiles(list: FileList | File[]): Promise<NamedText[]> {
  return Promise.all(
    Array.from(list).map(async (file) => ({ name: file.name, text: await file.text() })),
  );
}

export function DropZone({ onFiles, variant = 'compact', children }: Props) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);

  const handle = async (list: FileList | null) => {
    if (list && list.length) onFiles(await readFiles(list));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    depth.current = 0;
    setOver(false);
    void handle(e.dataTransfer.files);
  };

  return (
    <div
      className={`dropzone dropzone--${variant}${over ? ' is-over' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Drop files here or press to choose files"
      data-testid={`dropzone-${variant}`}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          input.current?.click();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current++;
        setOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={onDrop}
    >
      <div className="dropzone__icon">
        <UploadIcon size={variant === 'hero' ? 36 : 22} />
      </div>
      <div className="dropzone__text">
        <strong>Drop files here</strong>
        <span>or click to browse - CSV, TXT or project JSON</span>
      </div>
      {children}
      <input
        ref={input}
        type="file"
        multiple
        accept=".csv,.txt,.json,text/csv,application/json,text/plain"
        hidden
        data-testid="file-input"
        onChange={(e) => {
          void handle(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
