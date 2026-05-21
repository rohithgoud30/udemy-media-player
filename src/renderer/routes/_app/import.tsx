import { createFileRoute } from "@tanstack/react-router";
import ImportCourse from "../../components/Library/ImportCourse";

export const Route = createFileRoute("/_app/import")({
  component: ImportPage,
});

function ImportPage() {
  const { onImportComplete } = Route.useRouteContext();
  return <ImportCourse onImportComplete={onImportComplete} />;
}
