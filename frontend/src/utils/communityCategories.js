const NAV_CATEGORY_SLUGS = ['notice', 'free', 'humor', 'qna', 'dev-news', 'showcase'];

const EXCLUDED_NAV_SLUGS = new Set(['team-recruit']);
const EXCLUDED_PREVIEW_SLUGS = new Set(['notice', 'team-recruit']);

export function sortCategoriesByOrder(categories = []) {
  return [...categories].sort((a, b) => {
    if (a.order != null && b.order != null) return a.order - b.order;
    return a.id - b.id;
  });
}

export function getMainNavCategories(categories = []) {
  const sortedCategories = sortCategoriesByOrder(categories)
    .filter((category) => !EXCLUDED_NAV_SLUGS.has(category.slug));

  return NAV_CATEGORY_SLUGS
    .map((slug) => sortedCategories.find((category) => category.slug === slug))
    .filter(Boolean);
}

export function getPreviewCategories(categories = []) {
  return sortCategoriesByOrder(categories)
    .filter((category) => !EXCLUDED_PREVIEW_SLUGS.has(category.slug));
}
