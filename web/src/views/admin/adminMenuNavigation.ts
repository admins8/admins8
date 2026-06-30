export interface AdminMenuRouter {
  push(path: string): Promise<unknown> | unknown
}

export function isAdminRouteMenuIndex(index: string): boolean {
  return index.startsWith('/admin/')
}

export async function navigateAdminMenu(
  index: string,
  currentPath: string,
  router: AdminMenuRouter,
): Promise<void> {
  if (!isAdminRouteMenuIndex(index)) return
  if (index === currentPath) return
  await router.push(index)
}
