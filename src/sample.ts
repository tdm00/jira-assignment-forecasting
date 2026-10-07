import closures from '../docs/sample-data/closures.csv?raw';
import jira from '../docs/sample-data/jira-export.csv?raw';
import staff from '../docs/sample-data/staff.csv?raw';
import vacations from '../docs/sample-data/vacations.csv?raw';
import type { NamedText } from './state/importFile';

export const SAMPLE_FILES: NamedText[] = [
  { name: 'staff.csv', text: staff },
  { name: 'vacations.csv', text: vacations },
  { name: 'closures.csv', text: closures },
  { name: 'jira-export.csv', text: jira },
];
