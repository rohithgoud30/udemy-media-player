import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "./ModernVideoPlayer.css";
import { CourseManager, ProgressManager } from "../../../js/database";
import db from "../../../js/database";
import SettingsManager from "../../utils/settingsManager";
import { checkFileExists } from "../../utils/formatters";

// Hooks
import { useVideoPlayer } from "../../hooks/useVideoPlayer";
import { useSubtitles } from "../../hooks/useSubtitles";

// Components
import VideoControls from "./VideoControls";

const ModernVideoPlayer = () => {
  const { lectureId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state || {}) as {
    maintainFullscreen?: boolean;
    filePath?: string;
    videoUrl?: string;
    startPosition?: number;
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nearbyLectures, setNearbyLectures] = useState<Lecture[]>([]);
  const [showControls, setShowControls] = useState(true);
  const [showCompletionOverlay, setShowCompletionOverlay] = useState(false);

  // Use custom hooks
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackRate,
    isFullscreen,
    togglePlay,
    seek,
    seekRelative,
    setVolume,
    toggleMute,
    setPlaybackRate,
    toggleFullscreen,
    videoEvents,
  } = useVideoPlayer(videoRef, {
    defaultSpeed: 1.0,
  });

  const { subtitlesEnabled, subtitleSettings, toggleSubtitles } = useSubtitles(
    videoRef,
    lecture?.filePath,
  );

  // Apply subtitle settings to container CSS
  useEffect(() => {
    if (containerRef.current && subtitleSettings) {
      const fontSize =
        ({
          small: "0.9rem",
          medium: "1.1rem",
          large: "1.4rem",
          "x-large": "1.7rem",
        } as Record<string, string>)[subtitleSettings.fontSize] || "1.1rem";

      const fontColor =
        ({
          white: "#ffffff",
          yellow: "#ffff00",
          green: "#00ff00",
          red: "#ff0000",
          blue: "#0066ff",
          cyan: "#00ffff",
        } as Record<string, string>)[subtitleSettings.fontColor] || "#ffffff";

      const backgroundColor =
        ({
          black: "rgba(0, 0, 0, 0.85)",
          transparent: "transparent",
          "semi-transparent": "rgba(0, 0, 0, 0.5)",
          "dark-blue": "rgba(0, 30, 60, 0.85)",
          "dark-green": "rgba(0, 40, 20, 0.85)",
        } as Record<string, string>)[subtitleSettings.backgroundColor] || "rgba(0, 0, 0, 0.85)";

      containerRef.current.style.setProperty("--subtitle-font-size", fontSize);
      containerRef.current.style.setProperty("--subtitle-font-color", fontColor);
      containerRef.current.style.setProperty("--subtitle-background-color", backgroundColor);
    }
  }, [subtitleSettings]);

  // Navigate to lecture
  const navigateToLecture = useCallback(
    async (direction: "next" | "prev") => {
      if (!lecture || !lecture.courseId || !course) return;

      try {
        // Flatten all lectures
        let allLectures: Lecture[] = [];
        course.sections?.forEach((section) => {
          if (section.lectures) allLectures.push(...section.lectures);
        });

        // Sort
        allLectures.sort((a, b) => {
          const sectionA = course.sections?.find((s) => s.id === a.sectionId);
          const sectionB = course.sections?.find((s) => s.id === b.sectionId);
          if (sectionA?.index !== sectionB?.index)
            return (sectionA?.index ?? 0) - (sectionB?.index ?? 0);
          return (a.index ?? 0) - (b.index ?? 0);
        });

        const currentIndex = allLectures.findIndex((l) => l.id === lecture.id);
        if (currentIndex === -1) return;

        let targetIndex = currentIndex;
        if (direction === "next") targetIndex++;
        else if (direction === "prev") targetIndex--;

        if (targetIndex >= 0 && targetIndex < allLectures.length) {
          // Save progress before navigating
          if (videoRef.current) {
            await ProgressManager.saveProgress(lecture.id!, videoRef.current.currentTime);
          }

          const targetLecture = allLectures[targetIndex];
          const wasInFullscreen = !!document.fullscreenElement;

          setLoading(true);
          navigate(`/watch/${targetLecture.id}`, {
            state: { ...routeState, maintainFullscreen: wasInFullscreen },
          });
        }
      } catch (err) {
        console.error("Error navigating:", err);
      }
    },
    [lecture, course, navigate, routeState],
  );

  // Load Lecture Data
  useEffect(() => {
    async function loadLectureData() {
      try {
        setLoading(true);
        setError(null);

        // Handle pre-emptive fullscreen
        if (routeState.maintainFullscreen && containerRef.current && !document.fullscreenElement) {
          try {
            await containerRef.current.requestFullscreen();
          } catch {
            // Fullscreen may be blocked by browser policy
          }
        }

        // Get lecture from DB
        const lectureData = await db.lectures.get(parseInt(lectureId!));
        if (!lectureData) {
          setError(`Lecture ${lectureId} not found`);
          return;
        }

        // Override paths if provided in route state
        if (routeState.filePath) lectureData.filePath = routeState.filePath;

        // Video URL - use file:// protocol (webSecurity is disabled in dev mode)
        const createVideoUrl = (filePath: string): string | null => {
          if (!filePath) return null;
          try {
            const normalizedPath = filePath.replace(/\\/g, "/");
            return `file://${normalizedPath.split("/").map(encodeURIComponent).join("/")}`;
          } catch (e) {
            return `file://${filePath}`;
          }
        };

        const videoUrl = routeState.videoUrl || createVideoUrl(lectureData.filePath);

        // Progress
        const progress = await ProgressManager.getLectureProgress(lectureData.id!);
        const savedPos =
          routeState.startPosition !== undefined
            ? routeState.startPosition
            : progress.watched !== 1
              ? progress.position
              : 0;

        setLecture({
          ...lectureData,
          videoUrl,
          savedProgress: savedPos,
          completed: progress.watched === 1,
        });

        // Save last played
        if (lectureData.courseId) {
          await ProgressManager.saveLastPlayedLecture(lectureData.courseId, lectureData.id!);

          // Load Course
          const courseData = await CourseManager.getCourseDetails(lectureData.courseId);
          setCourse(courseData);

          // Nearby lectures logic
          if (courseData?.sections) {
            const all: Lecture[] = [];
            courseData.sections.forEach((s) => {
              if (s.lectures)
                all.push(...s.lectures.map((l) => ({ ...l, sectionTitle: s.title })));
            });
            const idx = all.findIndex((l) => l.id === parseInt(lectureId!));
            const start = Math.max(0, idx - 3);
            const end = Math.min(all.length - 1, idx + 3);
            setNearbyLectures(all.slice(start, end + 1));
          }
        }

        if (!window.electronAPI) {
          setError("Electron required for local video playback");
          return;
        }

        if (!(await checkFileExists(lectureData.filePath))) {
          setError(`File not found: ${lectureData.filePath}`);
          return;
        }
      } catch (err) {
        console.error("Load error:", err);
        setError("Failed to load lecture");
      } finally {
        setLoading(false);
      }
    }

    loadLectureData();
  }, [lectureId]);

  // Restore position when video is ready
  const hasRestoredPosition = useRef(false);
  useEffect(() => {
    hasRestoredPosition.current = false;
  }, [lectureId]);

  const onLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      videoEvents.onLoadedMetadata();
      if (!hasRestoredPosition.current && lecture?.savedProgress && lecture.savedProgress > 0) {
        if (videoRef.current) {
          videoRef.current.currentTime = lecture.savedProgress;
          hasRestoredPosition.current = true;
        }
      }

      // Auto-play if enabled in settings
      const playerSettings = SettingsManager.getPlayerSettings();
      if (playerSettings.autoPlay && videoRef.current) {
        // Small delay to ensure position is restored first
        setTimeout(() => {
          videoRef.current?.play().catch(() => {
            // Auto-play may be blocked by browser policy
          });
        }, 100);
      }
    },
    [videoEvents, lecture],
  );

  // 5-second progress saver
  useEffect(() => {
    if (!lecture || !videoRef.current) return;

    const interval = setInterval(() => {
      if (videoRef.current && isPlaying) {
        ProgressManager.saveProgress(lecture.id!, videoRef.current.currentTime);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [lecture, isPlaying]);

  // Auto-mark completed
  useEffect(() => {
    if (duration > 0 && currentTime > duration * 0.98 && !lecture?.completed) {
      ProgressManager.saveProgress(lecture!.id!, 0, true);
      setLecture((prev) => (prev ? { ...prev, completed: true } : prev));
      const playerSettings = SettingsManager.getPlayerSettings();
      if (playerSettings.showCompletionOverlay) {
        setShowCompletionOverlay(true);
      }
    }
  }, [currentTime, duration, lecture]);

  // Auto-hide completion toast
  useEffect(() => {
    if (!showCompletionOverlay) return;
    const timer = setTimeout(() => setShowCompletionOverlay(false), 3000);
    return () => clearTimeout(timer);
  }, [showCompletionOverlay]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((document.activeElement as HTMLElement)?.tagName)) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
          e.preventDefault();
          seekRelative(-5);
          break;
        case "arrowright":
          e.preventDefault();
          seekRelative(5);
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen(containerRef);
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "c":
          e.preventDefault();
          toggleSubtitles();
          break;
        case ",":
          e.preventDefault();
          navigateToLecture("prev");
          break;
        case ".":
          e.preventDefault();
          navigateToLecture("next");
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, seekRelative, toggleFullscreen, toggleMute, toggleSubtitles, navigateToLecture]);

  // Auto-hide controls
  useEffect(() => {
    const resetTimer = () => {
      setShowControls(true);
      clearTimeout(hideControlsTimeoutRef.current!);
      if (isPlaying) {
        hideControlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", resetTimer);
      container.addEventListener("mouseenter", resetTimer);
    }

    if (!isPlaying) setShowControls(true);

    return () => {
      if (container) {
        container.removeEventListener("mousemove", resetTimer);
        container.removeEventListener("mouseenter", resetTimer);
      }
      clearTimeout(hideControlsTimeoutRef.current!);
    };
  }, [isPlaying]);

  if (loading) return <div className="loading">Loading...</div>;
  if (error)
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );

  return (
    <div className="modern-video-player-container">
      <div className="player-top-bar">
        <button
          className="player-back-btn"
          onClick={() => navigate(`/course/${lecture?.courseId}`)}
        >
          ← Back to Course
        </button>
      </div>
      <div className="modern-video-container" ref={containerRef}>
        <video
          ref={videoRef}
          src={lecture?.videoUrl}
          crossOrigin="anonymous"
          playsInline
          onClick={togglePlay}
          {...videoEvents}
          onLoadedMetadata={onLoadedMetadata}
        />

        <VideoControls
          // State
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          isMuted={isMuted}
          playbackRate={playbackRate}
          isFullscreen={isFullscreen}
          subtitlesEnabled={subtitlesEnabled}
          visible={showControls}
          // Actions
          onPlayPause={togglePlay}
          onSeek={seek}
          onSeekRelative={seekRelative}
          onVolumeChange={setVolume}
          onToggleMute={toggleMute}
          onToggleFullscreen={() => toggleFullscreen(containerRef)}
          onToggleSubtitles={toggleSubtitles}
          onPlaybackRateChange={setPlaybackRate}
          onNextLecture={() => navigateToLecture("next")}
          onPrevLecture={() => navigateToLecture("prev")}
        />

        {showCompletionOverlay && (
          <div className="completion-toast">
            <span className="completion-toast-icon">✓</span>
            Lecture Complete!
          </div>
        )}
      </div>

      <div className="pi-container">
        <div className="pi-header">
          <div className="pi-title-block">
            <h1 className="pi-title">{lecture?.title}</h1>
            <div className="pi-meta">
              <span className="pi-course-name">{course?.title}</span>
              <span className="pi-divider" />
              <span className={`pi-status ${lecture?.completed ? "done" : ""}`}>
                {lecture?.completed ? "Completed" : "In Progress"}
              </span>
            </div>
          </div>
        </div>

        {nearbyLectures.length > 0 && (
          <div className="pi-playlist">
            <div className="pi-playlist-label">Nearby Lectures</div>
            <div className="pi-playlist-items">
              {nearbyLectures.map((l) => (
                <div
                  key={l.id}
                  className={`pi-item ${l.id === lecture?.id ? "current" : ""}`}
                  onClick={() => navigate(`/watch/${l.id}`)}
                >
                  <span className="pi-item-dot" />
                  <span className="pi-item-title">{l.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModernVideoPlayer;
