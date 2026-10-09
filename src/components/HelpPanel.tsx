import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from './icons';

interface HelpSection {
  id: string;
  title: string;
  body: ReactNode;
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    body: (
      <>
        <p>
          Drag files onto the page, or use the Data tab. The app works out what each file is from
          its header row, so you can drop them in any order. A good order is staff first, then the
          Jira export.
        </p>
        <ul>
          <li>
            <strong>Staff:</strong> a <code>Name</code> column and an optional <code>User ID</code>{' '}
            (or <code>ID</code>) column, or just one name per line.
          </li>
          <li>
            <strong>Jira export:</strong> needs <code>Issue key</code> and <code>Summary</code>. The
            Jira <code>Assignee</code> is matched to a staff User ID first, then the architect name
            is tried. Crew, Rank, Status, Story Points, SLA, Target start, Target end and Due Date
            columns are picked up, including the <code>Custom field (...)</code> forms.
          </li>
          <li>
            <strong>Vacations:</strong> a person column and a date column.
          </li>
          <li>
            <strong>Closures:</strong> a date column and no person column. Closures are company
            holidays that nobody works.
          </li>
          <li>
            <strong>Crew pools:</strong> a crew column, a person column and a <code>Role</code>{' '}
            column.
          </li>
          <li>
            <strong>Project file:</strong> a <code>.json</code> file saved with Export project.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'order',
    title: 'Plan order and the forecast',
    body: (
      <>
        <p>
          The grid is the plan. Each architect works one item at a time, from the top of the grid to
          the bottom, so an item never starts before the items above it for the same architect. An
          item&apos;s status does not move it up or down.
        </p>
        <ul>
          <li>
            An item takes its SLA in working days. If SLA is blank it takes story points times the
            days-per-point setting. With neither, it is not scheduled and is flagged.
          </li>
          <li>Weekends, closures and that architect&apos;s vacation days are not working days.</li>
          <li>Done items keep their recorded dates and use no capacity.</li>
          <li>
            In-progress items start on their Jira start date if they have one, otherwise on the
            forecast start date, or when the architect is free if that is later.
          </li>
          <li>
            Reorder by dragging the handle at the left of a row, or focus the handle and press
            Alt+Arrow Up or Down. <strong>Reset to Jira rank</strong> puts the rows back in Jira
            rank order.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'filters-stats',
    title: 'Filters and the summary cards',
    body: (
      <>
        <p>
          Search, Architects, Crews and Status only choose which rows you see. They never change the
          forecast: hidden rows still use their architect&apos;s time, so dates are the same with or
          without filters.
        </p>
        <p>
          The summary cards and the architect list above the grid follow the filters. While a filter
          is on, a note says how many items the numbers cover. Clear filters brings back the
          whole-plan numbers.
        </p>
      </>
    ),
  },
  {
    id: 'warnings',
    title: 'Warning icons',
    body: (
      <ul>
        <li>
          <strong>No SLA or story point estimate:</strong> the item has no duration, so it is not
          scheduled.
        </li>
        <li>
          <strong>No architect assigned:</strong> nobody is set and auto-assign is off.
        </li>
        <li>
          <strong>Architect is not in the staff list:</strong> the Jira architect or assignee does
          not match anyone on the Staff tab. Add them there, or choose someone in the grid.
        </li>
        <li>
          <strong>Forecast finishes after the due date:</strong> the forecast end is later than the
          Jira Due Date. The tooltip shows that due date.
        </li>
        <li>
          <strong>The crew has no architect pool:</strong> crew pools are on but this crew has no
          one assigned.
        </li>
      </ul>
    ),
  },
  {
    id: 'baseline',
    title: 'Set baseline',
    body: (
      <>
        <p>
          <strong>Set baseline</strong> takes a snapshot of the forecast as it is right now: every
          open item&apos;s dates and architect, and the overall finish date. It lets you ask
          &quot;what changed?&quot; after you try something.
        </p>
        <p>With a baseline set:</p>
        <ul>
          <li>
            The Forecast finish card shows the shift, for example &quot;+3d vs baseline&quot;.
          </li>
          <li>
            The grid gets a column showing how many calendar days each item moved. Plus means later,
            minus means earlier.
          </li>
          <li>Each architect shows how many items they gained or lost.</li>
        </ul>
        <p>
          A typical use: set the baseline, then reorder items, add a vacation, change an SLA or add
          a backup architect, and watch the numbers move. Press <strong>Clear baseline</strong> when
          you are done. The baseline is saved with the project.
        </p>
        <p>
          The baseline covers the whole plan. Filters only change which rows the comparison counts.
        </p>
      </>
    ),
  },
  {
    id: 'export',
    title: 'Export project, Open project and Export CSV',
    body: (
      <>
        <p>
          <strong>Export project</strong> and <strong>Export CSV</strong> are for different jobs.
        </p>
        <ul>
          <li>
            <strong>Export project</strong> (a <code>.json</code> file) is a full save. It holds
            staff, Jira items, your manual order and edits, vacations, closures, crew pools,
            settings and the baseline. Use it to keep your work, move it to another computer, or
            share a scenario you can keep working on. <strong>Open project</strong> (or dropping the
            file on the page) loads it back exactly as it was.
          </li>
          <li>
            <strong>Export CSV</strong> is a read-only report for Excel or sharing. Each row is a
            Jira item with its plan order, the forecast start and end, the forecast architect,
            working days, warnings and the original Jira fields. It cannot be opened as a project.
            In Architect focus it only contains that architect&apos;s items.
          </li>
        </ul>
        <p>
          Rule of thumb: Export project to continue later, Export CSV to show someone the result.
          <strong> Clear all</strong> deletes everything, so export the project first if you might
          want it back.
        </p>
      </>
    ),
  },
  {
    id: 'crew-pools',
    title: 'Crew pools',
    body: (
      <>
        <p>
          By default each item is worked by the architect named in Jira. Crew pools let you plan by
          crew instead: each crew gets a <strong>primary</strong> architect and up to two{' '}
          <strong>backups</strong> (Backup 2 and Backup 3). An architect can be primary for several
          crews. The point is to test questions like &quot;what if a backup helps Phoenix?&quot;
        </p>
        <p>
          <strong>Use crew pools</strong> (on the Crews tab) switches the setting &quot;Who works an
          item&quot; from the Jira architect to the crew pool. Switch back in Settings at any time.
        </p>
        <ul>
          <li>
            Pick a primary and backups for each crew. A slot can be switched off, and can have an
            &quot;Available from&quot; date before which that person will not be used.
          </li>
          <li>
            In Settings, the <strong>Crew pool policy</strong> decides when a backup is used:{' '}
            <em>Primary only</em> never uses backups; <em>Primary preferred</em> uses a backup only
            if they can start at least the chosen number of business days sooner;{' '}
            <em>Earliest available</em> gives the item to whichever pool member can start first.
          </li>
          <li>
            Items you assign by hand in the grid keep that architect. In-progress items keep their
            Jira architect.
          </li>
          <li>
            A crew with no pool follows the Jira architect, or the next available architect when the
            item has none and auto-assign is on.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'seed-primaries',
    title: 'Seed primaries from Jira',
    body: (
      <>
        <p>
          This is a quick way to fill in primaries instead of choosing them one by one. For each
          crew that has no primary yet, it looks at who the Jira items of that crew are assigned to
          (by Assignee User ID or architect name) and makes the person who appears most often the
          primary. Ties go to the person higher in the staff list.
        </p>
        <ul>
          <li>It never changes a primary you already chose.</li>
          <li>It does not add backups. Choose those yourself.</li>
          <li>People who are not on the Staff tab are ignored.</li>
          <li>It needs staff and Jira items loaded.</li>
        </ul>
        <p>
          Seed first so the pool matches today&apos;s Jira, then change primaries and add backups to
          try different plans.
        </p>
      </>
    ),
  },
  {
    id: 'focus',
    title: 'Architect focus',
    body: (
      <>
        <p>
          Switch from <strong>Team</strong> to <strong>Architect focus</strong> to look at one
          architect crew by crew. Choose the crews to include, then choose a scope:
        </p>
        <ul>
          <li>
            <strong>Selected crews only</strong> forecasts as if the architect worked only those
            crews, which shows how much time they free up or need.
          </li>
          <li>
            <strong>Full workload</strong> shows the selected crews while keeping the
            architect&apos;s whole workload in the forecast.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'settings',
    title: 'Settings',
    body: (
      <ul>
        <li>
          <strong>Forecast start date:</strong> nothing starts before this date. It defaults to
          today.
        </li>
        <li>
          <strong>Days per story point:</strong> used only when SLA is blank.
        </li>
        <li>
          <strong>Who works an item:</strong> the Jira architect, or crew pools.
        </li>
        <li>
          <strong>Assign unassigned items:</strong> gives items with no architect to whoever can
          start first. These show as suggestions.
        </li>
        <li>
          <strong>Done and in-progress statuses:</strong> comma-separated lists that decide which
          Jira statuses count as finished or under way.
        </li>
      </ul>
    ),
  },
];

interface Props {
  onClose: () => void;
}

export function HelpPanel({ onClose }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialog.current) return;
      const focusable = [
        ...dialog.current.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])',
        ),
      ];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const jumpTo = (id: string) => {
    const el = document.getElementById(`help-${id}`);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start' });
  };

  // Rendered on the body so the sticky header cannot clip or re-position it.
  return createPortal(
    <div
      className="help-backdrop"
      data-testid="help-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        data-testid="help-dialog"
      >
        <header className="help-dialog__head">
          <h2 id="help-title">Help</h2>
          <button
            ref={closeButton}
            type="button"
            className="icon-btn"
            aria-label="Close help"
            onClick={onClose}
          >
            <XIcon size={18} />
          </button>
        </header>
        <div className="help-dialog__body">
          <nav className="help-dialog__nav" aria-label="Help topics">
            {HELP_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="help-dialog__link"
                onClick={() => jumpTo(s.id)}
              >
                {s.title}
              </button>
            ))}
          </nav>
          <div className="help-dialog__content">
            {HELP_SECTIONS.map((s) => (
              <section key={s.id} id={`help-${s.id}`} aria-labelledby={`help-${s.id}-title`}>
                <h3 id={`help-${s.id}-title`}>{s.title}</h3>
                {s.body}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
