const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'a', 'ul', 'ol', 'li', 'blockquote',
  'pre', 'code', 'h1', 'h2', 'h3', 'hr',
  'figure', 'figcaption', 'img', 'span', 'div',
])

const GLOBAL_ALLOWED_ATTRS = new Set([
  'class',
  'style',
  'data-editor-image',
  'data-image-id',
])

const TAG_ALLOWED_ATTRS = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt']),
  figure: new Set(['style', 'class', 'data-editor-image', 'data-image-id']),
  figcaption: new Set(['class']),
}

const ALLOWED_STYLE_PROPS = new Set([
  'width',
  'max-width',
  'height',
  'text-align',
  'display',
  'margin',
  'margin-left',
  'margin-right',
])

const escapeHtml = (value = '') => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
)

const sanitizeStyle = (styleText = '') => {
  if (!styleText) return ''

  const sanitizedDeclarations = []
  const declarations = styleText.split(';')

  for (const declaration of declarations) {
    const [rawKey, ...rawValueParts] = declaration.split(':')
    const key = (rawKey || '').trim().toLowerCase()
    const value = rawValueParts.join(':').trim()

    if (!key || !value) continue
    if (!ALLOWED_STYLE_PROPS.has(key)) continue
    if (/expression|javascript:|url\(/i.test(value)) continue

    if ((key === 'width' || key === 'max-width' || key === 'height') && !/^\d+(px|%)$/i.test(value)) {
      continue
    }

    if (key === 'text-align' && !/^(left|right|center)$/i.test(value)) {
      continue
    }

    if (key === 'display' && !/^(block|inline|inline-block)$/i.test(value)) {
      continue
    }

    sanitizedDeclarations.push(`${key}: ${value}`)
  }

  return sanitizedDeclarations.join('; ')
}

const sanitizeUrl = (urlValue = '', { allowTemporaryUrls = false, allowImageDataUrl = false } = {}) => {
  const url = (urlValue || '').trim()
  if (!url) return ''

  if (
    url.startsWith('http://')
    || url.startsWith('https://')
    || url.startsWith('/')
    || url.startsWith('#')
    || url.startsWith('mailto:')
    || url.startsWith('tel:')
  ) {
    return url
  }

  if (allowImageDataUrl && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(url)) {
    return url
  }

  if (allowTemporaryUrls && (url.startsWith('blob:') || url.startsWith('upload://'))) {
    return url
  }

  return ''
}

const sanitizeNode = (node, outputDocument, options) => {
  if (node.nodeType === Node.TEXT_NODE) {
    return outputDocument.createTextNode(node.textContent || '')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return outputDocument.createDocumentFragment()
  }

  const tag = node.tagName.toLowerCase()
  const childNodes = Array.from(node.childNodes || [])

  if (!ALLOWED_TAGS.has(tag)) {
    const fragment = outputDocument.createDocumentFragment()
    childNodes.forEach((child) => {
      fragment.appendChild(sanitizeNode(child, outputDocument, options))
    })
    return fragment
  }

  const cleanElement = outputDocument.createElement(tag)
  const allowedAttrs = new Set([
    ...GLOBAL_ALLOWED_ATTRS,
    ...(TAG_ALLOWED_ATTRS[tag] ? Array.from(TAG_ALLOWED_ATTRS[tag]) : []),
  ])

  Array.from(node.attributes || []).forEach((attribute) => {
    const name = attribute.name.toLowerCase()
    const value = attribute.value

    if (!name || name.startsWith('on')) return

    if (name.startsWith('data-upload-')) {
      if (options.keepUploadPlaceholders && (name === 'data-upload-placeholder' || name === 'data-upload-token')) {
        cleanElement.setAttribute(name, value)
      }
      return
    }

    if (!allowedAttrs.has(name)) return

    if (name === 'style') {
      const safeStyle = sanitizeStyle(value)
      if (safeStyle) {
        cleanElement.setAttribute('style', safeStyle)
      }
      return
    }

    if (name === 'href') {
      const safeHref = sanitizeUrl(value, { allowTemporaryUrls: options.allowTemporaryUrls })
      if (safeHref) {
        cleanElement.setAttribute('href', safeHref)
      }
      return
    }

    if (name === 'src') {
      const safeSrc = sanitizeUrl(value, {
        allowTemporaryUrls: options.allowTemporaryUrls,
        allowImageDataUrl: true,
      })
      if (safeSrc) {
        cleanElement.setAttribute('src', safeSrc)
      }
      return
    }

    cleanElement.setAttribute(name, value)
  })

  if (tag === 'a' && cleanElement.getAttribute('href')) {
    cleanElement.setAttribute('target', '_blank')
    cleanElement.setAttribute('rel', 'noopener noreferrer')
  }

  childNodes.forEach((child) => {
    cleanElement.appendChild(sanitizeNode(child, outputDocument, options))
  })

  return cleanElement
}

export const isLikelyHtml = (value = '') => /<[^>]+>/.test(value || '')

export const convertPlainTextToHtml = (rawText = '') => {
  const text = String(rawText || '')
  const trimmed = text.trim()

  if (!trimmed) return '<p><br></p>'

  const paragraphs = trimmed.split(/\n{2,}/)

  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export const sanitizeRichHtml = (
  rawHtml = '',
  { allowTemporaryUrls = false, keepUploadPlaceholders = false } = {},
) => {
  if (typeof window === 'undefined') {
    return String(rawHtml || '').replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  }

  const parser = new DOMParser()
  const parsed = parser.parseFromString(String(rawHtml || ''), 'text/html')
  const outputDocument = document.implementation.createHTMLDocument('sanitized')
  const wrapper = outputDocument.createElement('div')

  Array.from(parsed.body.childNodes || []).forEach((node) => {
    wrapper.appendChild(
      sanitizeNode(node, outputDocument, {
        allowTemporaryUrls,
        keepUploadPlaceholders,
      }),
    )
  })

  return wrapper.innerHTML
}

export const extractPlainTextFromRichContent = (value = '') => {
  const raw = String(value || '')
  if (!raw) return ''

  if (!isLikelyHtml(raw)) {
    return raw.replace(/\s+/g, ' ').trim()
  }

  if (typeof window === 'undefined') {
    return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  const parser = new DOMParser()
  const parsed = parser.parseFromString(raw, 'text/html')
  return (parsed.body.textContent || '').replace(/\s+/g, ' ').trim()
}

export const normalizeStoredContentForEditor = (value = '') => {
  const raw = String(value || '')
  if (!raw.trim()) return '<p><br></p>'

  if (isLikelyHtml(raw)) {
    const sanitized = sanitizeRichHtml(raw, { allowTemporaryUrls: true, keepUploadPlaceholders: true })
    return sanitized || '<p><br></p>'
  }

  return convertPlainTextToHtml(raw)
}

export const hasInlineAttachmentInContent = (value = '') => {
  const raw = String(value || '')
  if (!raw) return false

  if (/<img\b/i.test(raw)) return true
  if (/data-editor-image\s*=\s*["']true["']/i.test(raw)) return true
  if (/\/api\/v1\/files\/download\/\d+/i.test(raw)) return true
  if (/!\[[^\]]*]\(([^)]+)\)/.test(raw)) return true

  return false
}
