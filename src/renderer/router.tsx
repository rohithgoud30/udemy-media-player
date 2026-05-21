import { createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import type { AppRouterContext } from "./router-context";

const placeholderContext: AppRouterContext = {
  courses: [],
  loading: true,
  error: null,
  onClearError: () => {},
  onImportComplete: () => {},
  onDeleteCourse: () => {},
};

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  context: placeholderContext,
  defaultPreload: false,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
