import { createFileRoute } from "@tanstack/react-router";
import ModernVideoPlayer from "../components/Player/ModernVideoPlayer";

export const Route = createFileRoute("/watch/$lectureId")({
  component: WatchPage,
});

function WatchPage() {
  return (
    <div className="content-area-player">
      <ModernVideoPlayer />
    </div>
  );
}
