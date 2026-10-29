import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Fragment, memo, useMemo, type Dispatch } from 'react';
import { endDelta, formatDelta, type Reference, type ReferenceEntry } from '../core/compare';
import { sortStaffByName } from '../core/filters';
import { crewStats } from '../core/focus';
import { architectLabel, crewKey, normalizeName } from '../core/scheduler';
import {
  AUTO_ASSIGN,
  type FlagCode,
  type IsoDate,
  type JiraItem,
  type ScheduledItem,
  type StaffMember,
} from '../core/types';
import type { Action, AppState } from '../state/store';
import { staffColor } from '../utils/colors';
import { formatMedium, formatShort } from '../utils/format';
import type { Zoom } from './FilterBar';
import {
  GanttCell,
  GanttHeader,
  buildTimeline,
  closureBlocks,
  vacationBlocks,
  type Block,
  type Timeline,
} from './GanttChart';
import { AlertIcon, ClockIcon, GripIcon, UserIcon, UserXIcon } from './icons';
import { NumberCell } from './NumberCell';

interface Props {
  state: AppState;
  visible: JiraItem[];
  scheduled: Map<string, ScheduledItem>;
  dispatch: Dispatch<Action>;
  zoom: Zoom;
  compact: boolean;
  reference: Reference | null;
  groupByCrew: boolean;
}

const FLAG_INFO: Record<FlagCode, { label: string; Icon: typeof AlertIcon; tone: string }> = {
  'no-estimate': { label: 'No SLA or story point estimate', Icon: AlertIcon, tone: 'warn' },
  'no-architect': { label: 'No architect assigned', Icon: UserXIcon, tone: 'warn' },
  'unknown-architect': {
    label: 'Architect is not in the staff list',
    Icon: UserIcon,
    tone: 'info',
  },
  late: { label: 'Forecast finishes after the Jira end date', Icon: ClockIcon, tone: 'danger' },
  'no-crew-pool': {
    label: 'The crew has no architect pool; assigned to the next available architect',
    Icon: UserXIcon,
    tone: 'info',
  },
};

function assignNote(
  s: ScheduledItem | undefined,
  jiraArchitect: string,
): { label: string; title: string } | null {
  if (!s) return null;
  if (s.suggested) return { label: 'suggested', title: 'Suggested: next available architect' };
  if (s.assignedVia === 'backup') {
    return { label: `backup ${s.role ?? ''}`.trim(), title: `Backup ${s.role} from the crew pool` };
  }
  if (s.assignedVia === 'primary' && normalizeName(jiraArchitect) !== normalizeName(s.architect)) {
    return { label: 'crew pool', title: 'Primary architect from the crew pool' };
  }
  return null;
}

export function DeltaBadge({ days, isNew }: { days: number | null; isNew?: boolean }) {
  if (isNew) return <span className="delta delta--new">new</span>;
  if (days === null) return null;
  const tone = days > 0 ? 'later' : days < 0 ? 'earlier' : 'same';
  return (
    <span className={`delta delta--${tone}`} title="Calendar days versus the comparison forecast">
      {formatDelta(days)}
    </span>
  );
}

export function Flags({ flags }: { flags: FlagCode[] }) {
  return (
    <span className="flags">
      {flags.map((f) => {
        const { label, Icon, tone } = FLAG_INFO[f];
        return (
          <span
            key={f}
            className={`flag flag--${tone}`}
            title={label}
            aria-label={label}
            role="img"
            data-flag={f}
          >
            <Icon size={14} />
          </span>
        );
      })}
    </span>
  );
}

interface RowProps {
  item: JiraItem;
  position: number;
  s: ScheduledItem | undefined;
  staff: StaffMember[];
  color: string;
  compact: boolean;
  t: Timeline;
  closures: Block[];
  vacations: Block[] | undefined;
  forecastStart: IsoDate;
  baselineEntry: ReferenceEntry | undefined;
  showDelta: boolean;
  dispatch: Dispatch<Action>;
  onKeyboardMove: (key: string, delta: -1 | 1) => void;
}

const SortableRow = memo(function SortableRow(p: RowProps) {
  const { item, s, staff, dispatch } = p;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.key });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const jiraLabel = architectLabel(item.architect, staff);

  const note = assignNote(s, item.architect);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`row row--${s?.state ?? 'planned'}${isDragging ? ' is-dragging' : ''}`}
      data-testid={`row-${item.key}`}
      data-key={item.key}
    >
      <td className="col-handle sticky-col" style={{ left: 0 }}>
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="drag-handle"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${item.key}. Press Alt+Up or Alt+Down to move.`}
          data-testid={`handle-${item.key}`}
          onKeyDown={(e) => {
            if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
              e.preventDefault();
              p.onKeyboardMove(item.key, e.key === 'ArrowUp' ? -1 : 1);
              return;
            }
            listeners?.onKeyDown?.(e);
          }}
        >
          <GripIcon />
        </button>
      </td>
      <td className="col-pos sticky-col num" style={{ left: 36 }} data-testid="position">
        {p.position}
      </td>
      <td className="col-key sticky-col" style={{ left: 76 }}>
        <span className="key-pill" style={{ ['--pill-color' as string]: p.color }}>
          {item.key}
        </span>
      </td>
      <td
        className="col-summary sticky-col sticky-col--last"
        style={{ left: 176 }}
        title={item.summary}
      >
        <span className="truncate">{item.summary}</span>
      </td>
      {!p.compact && <td className="col-crew">{item.crew}</td>}
      <td className="col-arch">
        <select
          className="cell-select"
          aria-label={`Architect for ${item.key}`}
          value={item.architectOverride ?? ''}
          onChange={(e) =>
            dispatch({
              type: 'updateItem',
              key: item.key,
              patch: { architectOverride: e.target.value || null },
            })
          }
        >
          <option value="">{jiraLabel}</option>
          <option value={AUTO_ASSIGN}>Auto (next available)</option>
          {sortStaffByName(staff).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {note && (
          <span className="suggested" data-label={note.label} title={note.title}>
            {s?.architect}
          </span>
        )}
      </td>
      {!p.compact && (
        <td className="col-status">
          <span className={`status status--${s?.state ?? 'planned'}`}>{item.status || '-'}</span>
        </td>
      )}
      <td className="col-num">
        <NumberCell
          value={item.storyPoints}
          step={0.5}
          label={`Story points for ${item.key}`}
          testId={`sp-${item.key}`}
          onChange={(v) =>
            dispatch({ type: 'updateItem', key: item.key, patch: { storyPoints: v } })
          }
        />
      </td>
      <td className="col-num">
        <NumberCell
          value={item.slaDays}
          label={`SLA days for ${item.key}`}
          testId={`sla-${item.key}`}
          onChange={(v) => dispatch({ type: 'updateItem', key: item.key, patch: { slaDays: v } })}
        />
      </td>
      {!p.compact && <td className="col-date">{formatShort(item.startDate)}</td>}
      {!p.compact && <td className="col-date">{formatShort(item.endDate)}</td>}
      <td
        className="col-date col-forecast"
        data-testid={`fstart-${item.key}`}
        title={formatMedium(s?.start)}
      >
        {formatShort(s?.start)}
      </td>
      <td
        className="col-date col-forecast"
        data-testid={`fend-${item.key}`}
        title={formatMedium(s?.end)}
      >
        {formatShort(s?.end)}
      </td>
      {p.showDelta && (
        <td className="col-delta" data-testid={`delta-${item.key}`}>
          <DeltaBadge
            days={endDelta(p.baselineEntry, s)}
            isNew={!!s?.end && s.state !== 'done' && !p.baselineEntry?.end}
          />
        </td>
      )}
      <td className="col-flags">
        <Flags flags={s?.flags ?? []} />
      </td>
      <td className="col-gantt">
        <GanttCell
          t={p.t}
          item={item}
          s={s}
          color={p.color}
          closures={p.closures}
          vacations={p.vacations}
          forecastStart={p.forecastStart}
          ghost={p.baselineEntry}
        />
      </td>
    </tr>
  );
});

export function JiraGrid({
  state,
  visible,
  scheduled,
  dispatch,
  zoom,
  compact,
  reference,
  groupByCrew,
}: Props) {
  const { staff, items, settings } = state;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const positions = useMemo(() => new Map(items.map((i, idx) => [i.key, idx + 1])), [items]);
  const visibleKeys = useMemo(() => visible.map((i) => i.key), [visible]);

  const t = useMemo(() => {
    const dates: IsoDate[] = [];
    for (const s of scheduled.values()) {
      if (s.start) dates.push(s.start);
      if (s.end) dates.push(s.end);
    }
    for (const i of items) if (i.endDate) dates.push(i.endDate);
    for (const r of Object.values(reference?.items ?? {})) {
      if (r.start) dates.push(r.start);
      if (r.end) dates.push(r.end);
    }
    return buildTimeline(dates, settings.forecastStart, zoom);
  }, [scheduled, items, settings.forecastStart, zoom, reference]);

  const showDelta = reference !== null;
  const columnCount =
    4 +
    (compact ? 0 : 1) +
    1 +
    (compact ? 0 : 1) +
    2 +
    (compact ? 0 : 2) +
    2 +
    (showDelta ? 1 : 0) +
    2;
  const groups = useMemo(
    () => (groupByCrew ? new Map(crewStats(visible, scheduled).map((c) => [c.key, c])) : null),
    [groupByCrew, visible, scheduled],
  );

  const closures = useMemo(() => closureBlocks(t, state.closures), [t, state.closures]);
  const vacations = useMemo(
    () =>
      vacationBlocks(t, state.vacations, (id) => staff.find((s) => s.id === id)?.name ?? 'Staff'),
    [t, state.vacations, staff],
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      dispatch({ type: 'moveItem', activeKey: String(active.id), overKey: String(over.id) });
    }
  };

  const onKeyboardMove = (key: string, delta: -1 | 1) =>
    dispatch({ type: 'moveWithinVisible', key, delta, visibleKeys });

  return (
    <div className="grid-scroll" data-testid="grid-scroll">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onDragEnd}
      >
        <table
          className={`grid${compact ? ' is-compact' : ''}`}
          aria-label="Jira items in plan order"
        >
          <thead>
            <tr>
              <th className="col-handle sticky-col" style={{ left: 0 }}>
                <span className="sr-only">Reorder</span>
              </th>
              <th className="col-pos sticky-col" style={{ left: 36 }}>
                #
              </th>
              <th className="col-key sticky-col" style={{ left: 76 }}>
                Key
              </th>
              <th className="col-summary sticky-col sticky-col--last" style={{ left: 176 }}>
                Summary
              </th>
              {!compact && <th className="col-crew">Crew</th>}
              <th className="col-arch">Architect</th>
              {!compact && <th className="col-status">Status</th>}
              <th className="col-num" title="Story points">
                SP
              </th>
              <th className="col-num" title="SLA in business days">
                SLA
              </th>
              {!compact && <th className="col-date">Jira start</th>}
              {!compact && <th className="col-date">Jira end</th>}
              <th className="col-date col-forecast">Fcst start</th>
              <th className="col-date col-forecast">Fcst end</th>
              {showDelta && (
                <th className="col-delta" title="Forecast end versus the comparison forecast">
                  Δ end
                </th>
              )}
              <th className="col-flags">
                <span className="sr-only">Warnings</span>
              </th>
              <th className="col-gantt">
                <GanttHeader t={t} closures={closures} />
              </th>
            </tr>
          </thead>
          <SortableContext items={visibleKeys} strategy={verticalListSortingStrategy}>
            <tbody>
              {visible.map((item, index) => {
                const s = scheduled.get(item.key);
                const gKey = crewKey(item.crew);
                const startsGroup =
                  groups !== null && (index === 0 || crewKey(visible[index - 1]!.crew) !== gKey);
                const group = groups?.get(gKey);
                return (
                  <Fragment key={item.key}>
                    {startsGroup && (
                      <tr className="group-row" data-testid={`group-${gKey || 'none'}`}>
                        <td colSpan={columnCount}>
                          <div className="group-row__inner">
                            <strong>{group?.name ?? (item.crew.trim() || '(No crew)')}</strong>
                            <span>{group?.items ?? 0} open items</span>
                            <span>{group?.points ?? 0} story points</span>
                            <span>finish {group?.finish ? formatMedium(group.finish) : '-'}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                    <SortableRow
                      item={item}
                      position={positions.get(item.key) ?? 0}
                      s={s}
                      staff={staff}
                      color={staffColor(staff, s?.staffId ?? null)}
                      compact={compact}
                      t={t}
                      closures={closures}
                      vacations={s?.staffId ? vacations.get(s.staffId) : undefined}
                      forecastStart={settings.forecastStart}
                      baselineEntry={reference?.items[item.key]}
                      showDelta={showDelta}
                      dispatch={dispatch}
                      onKeyboardMove={onKeyboardMove}
                    />
                  </Fragment>
                );
              })}
            </tbody>
          </SortableContext>
        </table>
      </DndContext>
      {visible.length === 0 && (
        <p className="empty-filter">No items match the current search and filters.</p>
      )}
    </div>
  );
}
