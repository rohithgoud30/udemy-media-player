import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "./ModernVideoPlayer.css";
import { CourseManager, ProgressManager } from "../../../js/database";
import db from "../../../js/database";

// Hooks
import { useVideoPlayer } from "../../hooks/useVideoPlayer";
import { useSubtitles } from "../../hooks/useSubtitles";

// Components
import VideoControls from "./VideoControls";

// Helper for checking if a file exists
const checkFileExists = async (filePath) => {
  if (window.electronAPI) {
    return await window.electronAPI.checkFileExists(filePath);
  }
  return false;
};

const ModernVideoPlayer = () => {
  const { lectureId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state || {};

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hideControlsTimeoutRef = useRef(null);

  const [lecture, setLecture] = useState(null);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nearbyLectures, setNearbyLectures] = useState([]);
  const [showControls, setShowControls] = useState(true);
  const [notification, setNotification] = useState(null);

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
        {
          small: "0.9rem",
          medium: "1.1rem",
          large: "1.4rem",
          "x-large": "1.7rem",
        }[subtitleSettings.fontSize] || "1.1rem";

      const fontColor =
        {
          white: "#ffffff",
          yellow: "#ffff00",
          green: "#00ff00",
          red: "#ff0000",
          blue: "#0066ff",
          cyan: "#00ffff",
        }[subtitleSettings.fontColor] || "#ffffff";

      const backgroundColor =
        {
          black: "rgba(0, 0, 0, 0.85)",
          transparent: "transparent",
          "semi-transparent": "rgba(0, 0, 0, 0.5)",
          "dark-blue": "rgba(0, 30, 60, 0.85)",
          "dark-green": "rgba(0, 40, 20, 0.85)",
        }[subtitleSettings.backgroundColor] || "rgba(0, 0, 0, 0.85)";

      containerRef.current.style.setProperty("--subtitle-font-size", fontSize);
      containerRef.current.style.setProperty("--subtitle-font-color", fontColor);
      containerRef.current.style.setProperty("--subtitle-background-color", backgroundColor);
    }
  }, [subtitleSettings]);

  // Show notification helper
  const showNotification = (message, type = "info", duration = 3000) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), duration);
  };

  // Navigate to lecture
  const navigateToLecture = useCallback(
    async (direction) => {
      if (!lecture || !lecture.courseId || !course) return;

      try {
        // Flatten all lectures
        let allLectures = [];
        course.sections.forEach((section) => {
          if (section.lectures) allLectures.push(...section.lectures);
        });

        // Sort
        allLectures.sort((a, b) => {
          const sectionA = course.sections.find((s) => s.id === a.sectionId);
          const sectionB = course.sections.find((s) => s.id === b.sectionId);
          if (sectionA.index !== sectionB.index) return sectionA.index - sectionB.index;
          return a.index - b.index;
        });

        const currentIndex = allLectures.findIndex((l) => l.id === lecture.id);
        if (currentIndex === -1) return;

        let targetIndex = currentIndex;
        if (direction === "next") targetIndex++;
        else if (direction === "prev") targetIndex--;

        if (targetIndex >= 0 && targetIndex < allLectures.length) {
          // Save progress before navigating
          if (videoRef.current) {
            await ProgressManager.saveProgress(lecture.id, videoRef.current.currentTime);
          }

          const targetLecture = allLectures[targetIndex];
          const wasInFullscreen = !!document.fullscreenElement;

          setLoading(true);
          navigate(`/watch/${targetLecture.id}`, {
            state: { ...routeState, maintainFullscreen: wasInFullscreen },
          });
        }
      } catch (error) {
        console.error("Error navigating:", error);
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
            console.warn("Could not maintain fullscreen:");
          }
        }

        // Get lecture from DB
        const lectureData = await db.lectures.get(parseInt(lectureId));
        if (!lectureData) {
          setError(`Lecture ${lectureId} not found`);
          return;
        }

        // Override paths if provided in route state
        if (routeState.filePath) lectureData.filePath = routeState.filePath;

        // Video URL
        const createVideoUrl = (filePath) => {
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
        const progress = await ProgressManager.getLectureProgress(lectureData.id);
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
          await ProgressManager.saveLastPlayedLecture(lectureData.courseId, lectureData.id);

          // Load Course
          const courseData = await CourseManager.getCourseDetails(lectureData.courseId);
          setCourse(courseData);

          // Nearby lectures logic
          if (courseData?.sections) {
            const all = [];
            courseData.sections.forEach((s) => {
              if (s.lectures) all.push(...s.lectures.map((l) => ({ ...l, sectionTitle: s.title })));
            });
            // Sort... ( reusing sort logic or trusting DB order if index is reliable)
            // Simplified nearby logic
            const idx = all.findIndex((l) => l.id === parseInt(lectureId));
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
    (e) => {
      videoEvents.onLoadedMetadata(e);
      if (!hasRestoredPosition.current && lecture?.savedProgress > 0) {
        if (videoRef.current) {
          videoRef.current.currentTime = lecture.savedProgress;
          hasRestoredPosition.current = true;
        }
      }
    },
    [videoEvents, lecture],
  );

  // 5-second progress saver
  useEffect(() => {
    if (!lecture || !videoRef.current) return;

    const interval = setInterval(() => {
      if (videoRef.current && isPlaying) {
        ProgressManager.saveProgress(lecture.id, videoRef.current.currentTime);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [lecture, isPlaying]);

  // Auto-mark completed
  useEffect(() => {
    if (duration > 0 && currentTime > duration * 0.98 && !lecture?.completed) {
      ProgressManager.saveProgress(lecture.id, 0, true);
      setLecture((prev) => ({ ...prev, completed: true }));
      showNotification("Lecture Completed!", "success");
    }
  }, [currentTime, duration, lecture]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;

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
      clearTimeout(hideControlsTimeoutRef.current);
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
      clearTimeout(hideControlsTimeoutRef.current);
    };
  }, [isPlaying]);

  const handleSeekStart = () => {
    // Optional: pause while seeking?
  };

  const handleSeekEnd = () => {
    // Resume if was playing?
  };

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
          onSeekStart={handleSeekStart}
          onSeekEnd={handleSeekEnd}
          onSeekRelative={seekRelative}
          onVolumeChange={setVolume}
          onToggleMute={toggleMute}
          onToggleFullscreen={() => toggleFullscreen(containerRef)}
          onToggleSubtitles={toggleSubtitles}
          onPlaybackRateChange={setPlaybackRate}
          onNextLecture={() => navigateToLecture("next")}
          onPrevLecture={() => navigateToLecture("prev")}
        />

        {notification && (
          <div className={`notification notification-${notification.type}`}>
            {notification.message}
          </div>
        )}
      </div>

      <div className="player-content">
        <div className="player-header-collapsed">
          <h1 className="lecture-title-top">{lecture?.title}</h1>
          <div className="course-header-row">
            <div className="course-title">
              <strong>Course:</strong> {course?.title}
            </div>
            <button
              className="back-to-course-btn"
              onClick={() => navigate(`/course/${lecture?.courseId}`)}
            >
              ← Back to Course
            </button>
          </div>
        </div>

        {/* Placeholder for lecture list and details to keep structure similar */}
        <div className="player-body">
          <div className="video-info">
            <div className="video-info-section">
              <h3>Status</h3>
              <div
                className={`completion-status ${lecture?.completed ? "completed" : "in-progress"}`}
              >
                {lecture?.completed ? "Completed" : "In Progress"}
              </div>
            </div>

            <div className="mini-course-view">
              <h3>Up Next</h3>
              <div className="mini-lectures-list">
                {nearbyLectures.map((l) => (
                  <div
                    key={l.id}
                    className={`mini-lecture-item ${l.id === lecture?.id ? "active" : ""}`}
                    onClick={() => navigate(`/watch/${l.id}`)}
                  >
                    {l.title}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernVideoPlayer;
