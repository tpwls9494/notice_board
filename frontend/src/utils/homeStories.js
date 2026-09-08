export function selectHomeStories(items) {
  const unique = [...new Map(items.map(item => [item.id, item])).values()]
  const lead = unique.find(item => item.is_featured) || unique.find(item => item.body?.trim()) || unique[0] || null
  return { lead, stories: unique.filter(item => item.id !== lead?.id).slice(0, 4) }
}

export async function loadHomeSignals(getSignals) {
  const response = await getSignals({ page_size: 12, sort: 'important' })
  return response.data.items?.length ? response : getSignals({ page_size: 12, sort: 'latest' })
}
