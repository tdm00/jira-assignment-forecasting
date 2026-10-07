import { useRef } from 'react';
import type { NamedText } from '../state/importFile';
import { readFiles } from './DropZone';
import {
  ChartIcon,
  DownloadIcon,
  MoonIcon,
  SidebarIcon,
  SunIcon,
  TrashIcon,
  UploadIcon,
} from './icons';

interface Props {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onOpenProject: (files: NamedText[]) => void;
  onExportProject: () => void;
  onExportCsv: () => void;
  onClear: () => void;
  hasItems: boolean;
}

export function Header(p: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <header className="app-header">
      <button
        type="button"
        className="icon-btn icon-btn--header"
        aria-label={p.sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        aria-pressed={p.sidebarOpen}
        onClick={p.onToggleSidebar}
      >
        <SidebarIcon size={18} />
      </button>
      <div className="brand">
        <span className="brand__logo">
          <ChartIcon size={18} />
        </span>
        <div>
          <h1 className="brand__title">Jira Gantt Forecaster</h1>
          <p className="brand__subtitle">Architect capacity forecasting</p>
        </div>
      </div>
      <div className="app-header__actions">
        <button type="button" className="btn btn--header" onClick={() => input.current?.click()}>
          <UploadIcon /> Open project
        </button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          hidden
          data-testid="project-input"
          onChange={async (e) => {
            if (e.target.files?.length) p.onOpenProject(await readFiles(e.target.files));
            e.target.value = '';
          }}
        />
        <button type="button" className="btn btn--header" onClick={p.onExportProject}>
          <DownloadIcon /> Export project
        </button>
        <button
          type="button"
          className="btn btn--header"
          onClick={p.onExportCsv}
          disabled={!p.hasItems}
        >
          <DownloadIcon /> Export CSV
        </button>
        <button type="button" className="btn btn--header" onClick={p.onClear}>
          <TrashIcon /> Clear all
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--header"
          aria-label={p.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={p.onToggleTheme}
        >
          {p.theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
        </button>
      </div>
    </header>
  );
}
