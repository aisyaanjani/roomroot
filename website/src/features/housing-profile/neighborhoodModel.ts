export function parseNeighborhoods(value: string) {
  return value.split(',').map(item => item.trim()).filter((item, index, items) => item && items.findIndex(existing => existing.toLowerCase() === item.toLowerCase()) === index)
}

export function addNeighborhood(value: string, entry: string) {
  const items = parseNeighborhoods(value)
  const additions = parseNeighborhoods(entry)
  for (const item of additions) if (!items.some(existing => existing.toLowerCase() === item.toLowerCase())) items.push(item)
  return items.join(', ')
}

export function removeNeighborhood(value: string, index: number) {
  return parseNeighborhoods(value).filter((_, itemIndex) => itemIndex !== index).join(', ')
}
