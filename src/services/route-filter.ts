import type { Route, McpPluginOptions, HTTPMethods } from "../types.ts";

export function routeFilter(options: McpPluginOptions) {
  const { skipHeadRoutes, skipOptionsRoutes, filter } = options;

  function filterRoutes(routes: Route[]): Route[] {
    return routes.filter((route) => {
      // Skip HEAD routes if configured
      if (skipHeadRoutes && route.methods.includes("HEAD" as HTTPMethods)) {
        return false;
      }

      // Skip OPTIONS routes if configured
      if (
        skipOptionsRoutes &&
        route.methods.includes("OPTIONS" as HTTPMethods)
      ) {
        return false;
      }

      // Custom filter function
      if (filter && !filter(route as any)) {
        return false;
      }

      return true;
    });
  }

  return {
    filterRoutes,
  };
}
