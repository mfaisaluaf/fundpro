/**
 * Dashboard config helpers — single source of truth.
 *
 * Stored format: config[workspace] = { cards: string[], custom: object }
 * Legacy format: config[workspace] = string[]   (auto-upgraded on read)
 *
 * Always use these helpers instead of reading config[workspace] directly.
 */

/** Extract the cards array from a workspace config entry (handles both formats). */
export function getCards(config, workspace) {
  const raw = config?.[workspace]
  if (!raw) return []
  return Array.isArray(raw) ? raw : (raw.cards || [])
}

/** Extract the custom object from a workspace config entry. */
export function getCustom(config, workspace) {
  const raw = config?.[workspace]
  if (!raw || Array.isArray(raw)) return {}
  return raw.custom || {}
}

/** Return a new config with updated cards for a workspace (preserves custom). */
export function setCards(config, workspace, cards) {
  const custom = getCustom(config, workspace)
  return { ...config, [workspace]: { cards, custom } }
}

/** Return a new config with updated custom for a workspace (preserves cards). */
export function setCustom(config, workspace, custom) {
  const cards = getCards(config, workspace)
  return { ...config, [workspace]: { cards, custom } }
}

/** Return a new config with both cards and custom updated. */
export function setWorkspace(config, workspace, cards, custom) {
  return { ...config, [workspace]: { cards, custom } }
}
