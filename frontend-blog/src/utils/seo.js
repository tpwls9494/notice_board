const origin = (import.meta.env.VITE_BLOG_ORIGIN || 'https://blog.jionc.com').replace(/\/$/, '')
const defaultTitle = 'jion.log — 배우고, 만들고, 기록합니다.'
const defaultDescription = '직접 부딪히며 이해한 것들. AI와 개발, 그 사이의 생각을 차곡차곡 남깁니다.'

function setMeta(key, value, property = false) {
  const attribute = property ? 'property' : 'name'
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`)
  if (!element) { element = document.createElement('meta'); element.setAttribute(attribute, key); document.head.append(element) }
  element.content = value
}

export function applyBlogMetadata({ post, privatePage = false, title: customTitle } = {}) {
  const title = customTitle || (post ? `${post.title} · jion.log` : defaultTitle)
  const description = post ? (post.summary || post.content || '').replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]*>|[#*_`~>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180) : defaultDescription
  const canonical = origin + '/' + (post ? encodeURIComponent(post.slug) : '')
  const fallbackImage = origin + '/api/v1/blog/og/default.png'
  let image = fallbackImage
  try { const url = new URL(post?.thumbnail_url || fallbackImage, origin); if (['http:', 'https:'].includes(url.protocol)) image = url.href } catch { /* Use the default card. */ }
  const noindex = privatePage || (post && !post.is_published) || import.meta.env.DEV
  document.title = title
  setMeta('description', description)
  setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow')
  for (const [key, value] of Object.entries({ 'og:title': title, 'og:description': description, 'og:type': post ? 'article' : 'website', 'og:url': canonical, 'og:image': image, 'og:site_name': 'jion.log' })) setMeta(key, value, true)
  for (const [key, value] of Object.entries({ 'twitter:card': 'summary_large_image', 'twitter:title': title, 'twitter:description': description, 'twitter:image': image })) setMeta(key, value)
  let link = document.head.querySelector('link[rel=canonical]')
  if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.append(link) }
  link.href = canonical
  document.getElementById('blog-structured-data')?.remove()
  if (!noindex) {
    const script = document.createElement('script')
    script.id = 'blog-structured-data'; script.type = 'application/ld+json'
    script.textContent = JSON.stringify(post ? { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description, url: canonical, image, datePublished: post.published_at, dateModified: post.updated_at || post.created_at, author: { '@type': 'Person', name: post.author?.username || 'jion' } } : { '@context': 'https://schema.org', '@type': 'WebSite', name: defaultTitle, url: canonical })
    document.head.append(script)
  }
}
