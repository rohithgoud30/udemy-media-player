import { createFileRoute, Outlet } from "@tanstack/react-router";
import Navbar from "../components/Navbar";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <>
      <Navbar />
      <div className="content-area">
        <Outlet />
      </div>
    </>
  );
}
