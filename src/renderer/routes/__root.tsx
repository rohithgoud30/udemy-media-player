import React, { Suspense } from "react";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { AppRouterContext } from "../router-context";

const isDev = process.env.NODE_ENV === "development";

const TanStackRouterDevtools = isDev
  ? React.lazy(() =>
      import("@tanstack/react-router-devtools").then((m) => ({
        default: m.TanStackRouterDevtools,
      })),
    )
  : () => null;

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  const { error, onClearError } = Route.useRouteContext();

  return (
    <div className="app-container">
      {error && (
        <div className="error-message">
          {error}
          <button onClick={onClearError}>Dismiss</button>
        </div>
      )}
      <Outlet />
      {isDev && (
        <Suspense fallback={null}>
          <TanStackRouterDevtools />
        </Suspense>
      )}
    </div>
  );
}
