export function safeNextPath(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || Array.from(value).some(char => char.charCodeAt(0) < 32)) return '/'
  return value
}
