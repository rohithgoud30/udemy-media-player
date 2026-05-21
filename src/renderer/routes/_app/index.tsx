import { createFileRoute } from "@tanstack/react-router";
import Library from "../../components/Library/Library";

export const Route = createFileRoute("/_app/")({
  component: LibraryPage,
});

function LibraryPage() {
  const { courses, loading, onDeleteCourse } = Route.useRouteContext();
  return <Library courses={courses} loading={loading} onDeleteCourse={onDeleteCourse} />;
}
