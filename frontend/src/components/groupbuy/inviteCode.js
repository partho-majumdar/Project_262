/**
 * Turns whatever a shopper pastes into a join route: the 8-character code, an invite link,
 * or the whole share message the group page produces ("Use code ABCD1234 or open https://…").
 */

const JOIN_PATH = '/group-buy/join/';
/** The server builds codes from letters and digits only, leaving out look-alikes like O and 0. */
const CODE_CHARS = /[^A-Z0-9]/g;

/** Returns `{ code, ref }`, where `ref` is the inviter carried by a pasted link, or null if there is no code. */
export function parseInviteInput(input) {
  const text = String(input ?? '').trim();
  if (!text) return null;

  const joinAt = text.lastIndexOf(JOIN_PATH);
  if (joinAt >= 0) {
    // An invite link or the share message that contains one
    const rest = text.slice(joinAt + JOIN_PATH.length).split(/\s/)[0];
    const [path, query] = rest.split('?');
    const ref = query ? new URLSearchParams(query.split('#')[0]).get('ref') : null;
    return build(path.split('#')[0].split('/')[0], ref);
  }

  const looksLikeUrl = text.includes('://') || text.startsWith('/');
  if (looksLikeUrl) {
    // Some other link: fall back to its last path segment, ignoring the host
    const withoutQuery = text.split(/\s/)[0].split('?')[0].split('#')[0];
    const afterScheme = withoutQuery.includes('://') ? withoutQuery.split('://')[1] : withoutQuery;
    const segments = afterScheme.split('/').filter(Boolean);
    const path = withoutQuery.includes('://') ? segments.slice(1) : segments;
    return path.length ? build(path[path.length - 1], null) : null;
  }

  return build(text.split(/\s/).pop(), null);
}

/** The route to send someone to, or null when the text holds no usable code. */
export function inviteRoute(input) {
  const parsed = parseInviteInput(input);
  if (!parsed) return null;
  return `${JOIN_PATH}${parsed.code}${parsed.ref ? `?ref=${encodeURIComponent(parsed.ref)}` : ''}`;
}

function build(candidate, ref) {
  const code = String(candidate ?? '').toUpperCase().replace(CODE_CHARS, '');
  return code ? { code, ref: ref || null } : null;
}
