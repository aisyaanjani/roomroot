export function nextComboboxIndex(current: number, direction: 1 | -1, count: number) {
  if (!count) return -1
  if (current < 0) return direction === 1 ? 0 : count - 1
  return (current + direction + count) % count
}

export function suggestionStatus(count: number, activeLabel?: string) {
  return `${count} matching ${count === 1 ? 'result' : 'results'}${activeLabel ? `. ${activeLabel} highlighted.` : '.'}`
}
