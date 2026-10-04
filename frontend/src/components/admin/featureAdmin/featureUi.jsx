/**
 * One import surface for the shared admin chrome, so the feature panels do not each reach into the
 * group-buy folder and the seller dashboard for primitives.
 */
export {
  Banner,
  Bar,
  ConfirmAction,
  EmptyState,
  FilterChips,
  Loading,
  Panel,
  Pill,
  listOf,
  tableClass,
  theadClass,
  rowClass,
} from '../groupbuy/adminUi';

import { Pill } from '../groupbuy/adminUi';

/**
 * Feature status colours come from `statusMeta` as a `[label, tone]` tuple, which is a different
 * contract from the group-buy `StatusPill`'s status-keyed lookup map.
 */
export function StatusPill({ meta }) {
  const [label, tone] = meta ?? ['Unknown', 'slate'];
  return <Pill tone={tone}>{label}</Pill>;
}

export { default as StatTile } from '../../seller/groupbuy/StatTile';
