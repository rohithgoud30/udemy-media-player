import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CourseManager, ProgressManager } from "../../../js/database";
import db from "../../../js/database";

// Helper for checking if a file exists
const checkFileExists = async (filePath) => {
  if (window.electronAPI) {
    return await window.electronAPI.checkFileExists(filePath);
  }
  return false;
};

// Create video URL from file path
// In development, webSecurity is disabled, so file:// URLs work directly
const createVideoUrl = (filePath) => {
  if (!filePath) return null;
  try {
    const normalizedPath = filePath.replace(/\\/g, "/");
    const url = `file://${normalizedPath.split("/").map(encodeURIComponent).join("/")}`;
    console.log("Created video URL:", url);
    return url;
  } catch {
    return `file://${filePath}`;
  }
};

const VideoPlayer = () => {
  const { lectureId } = useParams();
  const navigate = useNavigate();
  const playerRef = useRef(null);

  const [lecture, setLecture] = useState(null);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nearbyLectures, setNearbyLectures] = useState([]);
  const [notification, setNotification] = useState(null);
  const [_isReady, setIsReady] = useState(false);

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Show notification helper
  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Load lecture data
  useEffect(() => {
    async function loadLectureData() {
      try {
        setLoading(true);
        setError(null);

        const lectureData = await db.lectures.get(parseInt(lectureId));
        if (!lectureData) {
          setError(`Lecture ${lectureId} not found`);
          return;
        }

        const videoUrl = createVideoUrl(lectureData.filePath);
        const progress = await ProgressManager.getLectureProgress(lectureData.id);

        setLecture({
          ...lectureData,
          videoUrl,
          savedProgress: progress.watched !== 1 ? progress.position : 0,
          completed: progress.watched === 1,
        });

        // Save last played
        if (lectureData.courseId) {
          await ProgressManager.saveLastPlayedLecture(lectureData.courseId, lectureData.id);

          const courseData = await CourseManager.getCourseDetails(lectureData.courseId);
          setCourse(courseData);

          // Get nearby lectures
          if (courseData?.sections) {
            const allLectures = [];
            courseData.sections.forEach((s) => {
              if (s.lectures) {
                allLectures.push(...s.lectures.map((l) => ({ ...l, sectionTitle: s.title })));
              }
            });
            const idx = allLectures.findIndex((l) => l.id === parseInt(lectureId));
            const start = Math.max(0, idx - 2);
            const end = Math.min(allLectures.length - 1, idx + 4);
            setNearbyLectures(allLectures.slice(start, end + 1));
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

  // Handle player ready - seek to saved position
  const handleReady = useCallback(() => {
    setIsReady(true);
    if (playerRef.current && lecture?.savedProgress > 0) {
      playerRef.current.seekTo(lecture.savedProgress, "seconds");
    }
  }, [lecture]);

  // Handle progress updates
  const handleProgress = useCallback(
    ({ playedSeconds }) => {
      if (lecture && playedSeconds > 0) {
        ProgressManager.saveProgress(lecture.id, playedSeconds);
      }
    },
    [lecture],
  );

  // Handle video end
  const handleEnded = useCallback(() => {
    if (lecture && !lecture.completed) {
      ProgressManager.saveProgress(lecture.id, 0, true);
      setLecture((prev) => ({ ...prev, completed: true }));
      showNotification("Lecture Completed!", "success");
    }
  }, [lecture]);

  // Navigate to next/prev lecture
  const navigateToLecture = useCallback(
    (direction) => {
      if (!lecture || !course) return;

      const allLectures = [];
      course.sections.forEach((section) => {
        if (section.lectures) allLectures.push(...section.lectures);
      });

      const currentIndex = allLectures.findIndex((l) => l.id === lecture.id);
      if (currentIndex === -1) return;

      const targetIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
      if (targetIndex >= 0 && targetIndex < allLectures.length) {
        navigate(`/watch/${allLectures[targetIndex].id}`);
      }
    },
    [lecture, course, navigate],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          setPlaying((prev) => !prev);
          break;
        case "arrowleft":
          e.preventDefault();
          if (playerRef.current) {
            const current = playerRef.current.getCurrentTime();
            playerRef.current.seekTo(Math.max(0, current - 5), "seconds");
          }
          break;
        case "arrowright":
          e.preventDefault();
          if (playerRef.current) {
            const current = playerRef.current.getCurrentTime();
            playerRef.current.seekTo(current + 5, "seconds");
          }
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
  }, [navigateToLecture]);

  if (loading) return <div className="loading">Loading...</div>;
  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="video-player-container">
      <div className="video-wrapper">
        <video
          ref={playerRef}
          src={lecture?.videoUrl}
          controls
          style={{ width: "100%", height: "100%" }}
          onLoadedMetadata={() => {
            setIsReady(true);
            console.log("Video loaded, saved progress:", lecture?.savedProgress);
            if (playerRef.current && lecture?.savedProgress > 0) {
              playerRef.current.currentTime = lecture.savedProgress;
              console.log("Resumed video at:", lecture.savedProgress);
            }
          }}
          onTimeUpdate={() => {
            if (playerRef.current && lecture) {
              const currentTime = playerRef.current.currentTime;
              // Save progress every 5 seconds using a simple check
              const lastSave = playerRef.current.dataset.lastSave || 0;
              if (currentTime - lastSave > 5) {
                ProgressManager.saveProgress(lecture.id, currentTime);
                playerRef.current.dataset.lastSave = currentTime;
                console.log("Saved progress:", currentTime);
              }
            }
          }}
          onPause={() => {
            // Save progress when paused
            if (playerRef.current && lecture) {
              ProgressManager.saveProgress(lecture.id, playerRef.current.currentTime);
              console.log("Saved on pause:", playerRef.current.currentTime);
            }
            setPlaying(false);
          }}
          onEnded={handleEnded}
          onPlay={() => setPlaying(true)}
          onError={(e) => {
            console.error("Video error:", e);
            setError(`Video playback error: Could not load video file`);
          }}
        />
      </div>

      <div className="player-info">
        <h1>{lecture?.title}</h1>

        <div className="player-meta">
          <span className="course-link">
            <strong>Course:</strong> {course?.title}
          </span>
          <button
            className="back-to-course-btn"
            onClick={() => navigate(`/course/${lecture?.courseId}`)}
          >
            ← Back to Course
          </button>
        </div>

        {/* Playback Speed */}
        <div style={{ marginTop: "var(--space-4)" }}>
          <label style={{ marginRight: "var(--space-2)", color: "var(--text-secondary)" }}>
            Speed:
          </label>
          <select
            value={playbackRate}
            onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
            style={{
              padding: "var(--space-2) var(--space-3)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              color: "var(--text-primary)",
            }}
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
              <option key={rate} value={rate}>
                {rate}x
              </option>
            ))}
          </select>
        </div>

        {/* Up Next */}
        {nearbyLectures.length > 0 && (
          <div className="up-next-section">
            <h3>Up Next</h3>
            <div className="up-next-list">
              {nearbyLectures.map((l) => (
                <div
                  key={l.id}
                  className={`up-next-item ${l.id === lecture?.id ? "active" : ""}`}
                  onClick={() => navigate(`/watch/${l.id}`)}
                >
                  {l.title}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {notification && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
