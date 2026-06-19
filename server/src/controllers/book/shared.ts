export function normalizeText(value: any): string {
  return String(value || '').trim().toLowerCase();
}

export function isValidAuthor(author: any): boolean {
  const value = String(author || '').trim();
  return !!value && value !== '佚名' && value !== '未知' && value !== '未知作者';
}
