import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { CourseManager, ProgressManager } from "../../../js/database";

const CourseView = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lectureProgress, setLectureProgress] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [courseDurations, setCourseDurations] = useState(null);
  const [updatingDurations, setUpdatingDurations] = useState(false);

  // Load course data and progress
  useEffect(() => {
    async function loadCourseDetails() {
      try {
        setLoading(true);
        const courseData = await CourseManager.getCourseDetails(
          parseInt(courseId)
        );

        if (!courseData) {
          setError("Course not found");
          return;
        }

        setCourse(courseData);

        // Check if we need to update lecture durations
        const needsDurationUpdate = courseData.sections.some((section) =>
          section.lectures.some((lecture) => lecture.duration === 0)
        );

        if (needsDurationUpdate) {
          console.log("Updating lecture durations...");
          await CourseManager.updateLectureDurations(parseInt(courseId));
        }

        // Load course and section durations
        const durations = await CourseManager.getCourseDurations(
          parseInt(courseId)
        );
        console.log("Course durations:", durations);
        setCourseDurations(durations);

        // Set only the first section expanded by default
        const expanded = {};
        if (courseData.sections && courseData.sections.length > 0) {
          // Get the first section by index (not ID)
          const firstSection =
            courseData.sections.find((s) => s.index === 0) ||
            courseData.sections[0];
          if (firstSection) {
            expanded[firstSection.id] = true;
          }
        }
        setExpandedSections(expanded);

        // Load progress for all lectures
        const progress = {};
        for (const section of courseData.sections) {
          for (const lecture of section.lectures) {
            const lectureProgress = await ProgressManager.getLectureProgress(
              lecture.id
            );
            progress[lecture.id] = lectureProgress;
          }
        }
        setLectureProgress(progress);
      } catch (error) {
        console.error("Error loading course details:", error);
        setError("Failed to load course details");
      } finally {
        setLoading(false);
      }
    }

    loadCourseDetails();
  }, [courseId]);

  // Toggle section expansion with accordion behavior
  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => {
      // If this section is already open and being clicked, just close it
      if (prev[sectionId]) {
        return {
          ...prev,
          [sectionId]: false,
        };
      }

      // Create a new object with all sections closed
      const newState = {};

      // Then set only the clicked section to open
      newState[sectionId] = true;

      return newState;
    });
  };

  // Mark lecture as watched/unwatched
  const toggleWatchStatus = async (lectureId, e) => {
    e.stopPropagation();

    try {
      const currentProgress = lectureProgress[lectureId];
      const newWatchedStatus = currentProgress.watched !== 1;

      await ProgressManager.markLectureWatched(lectureId, newWatchedStatus);

      // Update local state
      setLectureProgress((prev) => ({
        ...prev,
        [lectureId]: {
          ...prev[lectureId],
          watched: newWatchedStatus ? 1 : 0,
        },
      }));
    } catch (error) {
      console.error("Error toggling watch status:", error);
    }
  };

  // Mark all lectures as completed
  const markAllAsCompleted = async () => {
    try {
      if (!course) return;

      // Update all lectures in database
      for (const section of course.sections) {
        for (const lecture of section.lectures) {
          await ProgressManager.markLectureWatched(lecture.id, true);
        }
      }

      // Update local state
      const updatedProgress = {};
      for (const section of course.sections) {
        for (const lecture of section.lectures) {
          updatedProgress[lecture.id] = {
            ...lectureProgress[lecture.id],
            watched: 1,
          };
        }
      }
      setLectureProgress(updatedProgress);
    } catch (error) {
      console.error("Error marking all as completed:", error);
    }
  };

  // Function to manually update durations
  const refreshDurations = async () => {
    try {
      setUpdatingDurations(true);
      const updated = await CourseManager.updateLectureDurations(
        parseInt(courseId)
      );

      if (updated) {
        // Reload durations
        const durations = await CourseManager.getCourseDurations(
          parseInt(courseId)
        );
        setCourseDurations(durations);
      }
    } catch (error) {
      console.error("Error refreshing durations:", error);
    } finally {
      setUpdatingDurations(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading course details...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate("/")}>Back to Library</button>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="not-found">
        <h2>Course Not Found</h2>
        <p>The requested course could not be found.</p>
        <Link to="/">Back to Library</Link>
      </div>
    );
  }

  return (
    <div className="course-view">
      <div className="course-header">
        <h1>{course.title}</h1>
        <div className="course-actions">
          <button
            className="refresh-durations-button"
            onClick={refreshDurations}
            disabled={updatingDurations}
          >
            {updatingDurations ? "Updating..." : "Refresh Durations"}
          </button>
          <Link to="/" className="back-button">
            ← Back to Library
          </Link>
        </div>
      </div>

      <div className="course-progress">
        <h3>Course Progress</h3>
        <CourseProgressBar course={course} lectureProgress={lectureProgress} />
        {courseDurations && (
          <div className="course-total-duration">
            Total Duration: {formatDuration(courseDurations.totalDuration)}
          </div>
        )}
      </div>

      <div className="sections-container">
        {course.sections.map((section) => (
          <div key={section.id} className="section">
            <div
              className="section-header"
              onClick={() => toggleSection(section.id)}
            >
              <div className="section-title">
                <span className="expand-icon">
                  {expandedSections[section.id] ? "▼" : "►"}
                </span>
                <h3>{section.title}</h3>
              </div>
              <div className="section-meta">
                {section.lectures.length} lectures
                {courseDurations &&
                  courseDurations.sectionDurations[section.id] && (
                    <span className="section-duration">
                      •{" "}
                      {formatDuration(
                        courseDurations.sectionDurations[section.id]
                      )}
                    </span>
                  )}
              </div>
            </div>

            {expandedSections[section.id] && (
              <div className="lectures-list">
                {section.lectures.map((lecture) => {
                  const progress = lectureProgress[lecture.id] || {
                    watched: 0,
                    position: 0,
                  };
                  const watchStatus =
                    progress.watched === 1
                      ? "watched"
                      : progress.watched === 0.5
                      ? "partial"
                      : "unwatched";

                  return (
                    <div key={lecture.id} className={`lecture ${watchStatus}`}>
                      <div className="lecture-info">
                        <button
                          className={`watch-toggle ${watchStatus}`}
                          onClick={(e) => toggleWatchStatus(lecture.id, e)}
                          title={
                            watchStatus === "watched"
                              ? "Mark as unwatched"
                              : "Mark as watched"
                          }
                        >
                          {watchStatus === "watched" ? "✓" : ""}
                        </button>

                        <Link
                          to={`/watch/${lecture.id}`}
                          className="lecture-title"
                        >
                          {lecture.title}
                          {lecture.duration > 0 && (
                            <span className="lecture-duration">
                              {formatDuration(lecture.duration)}
                            </span>
                          )}
                        </Link>
                      </div>

                      <div className="lecture-actions">
                        <Link
                          to={`/watch/${lecture.id}`}
                          className={`play-button ${
                            progress.position > 0 ? "resume" : ""
                          }`}
                          title={
                            progress.position > 0
                              ? `Resume at ${formatTime(progress.position)}`
                              : "Play lecture"
                          }
                          state={{ startPosition: progress.position }}
                        >
                          {progress.position > 0 && progress.watched !== 1 ? (
                            <>
                              <span className="resume-icon">↻</span>
                              <span className="resume-text">
                                {formatTime(progress.position)}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="play-icon">▶</span>
                              <span className="play-text">Play</span>
                            </>
                          )}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <button className="mark-as-completed" onClick={markAllAsCompleted}>
        Mark as Completed
      </button>
    </div>
  );
};

// Helper component for course progress bar
const CourseProgressBar = ({ course, lectureProgress }) => {
  // Calculate overall completion
  const totalLectures = course.sections.reduce(
    (total, section) => total + section.lectures.length,
    0
  );

  const watchedLectures = Object.values(lectureProgress).filter(
    (p) => p.watched === 1
  ).length;

  const partialLectures = Object.values(lectureProgress).filter(
    (p) => p.watched === 0.5
  ).length;

  const completionPercentage = totalLectures
    ? Math.round(
        ((watchedLectures + partialLectures * 0.5) / totalLectures) * 100
      )
    : 0;

  return (
    <div className="progress-container">
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${completionPercentage}%` }}
        ></div>
      </div>
      <div className="progress-stats">
        <span>{completionPercentage}% Complete</span>
        <span>
          {watchedLectures} of {totalLectures} lectures completed
        </span>
      </div>
    </div>
  );
};

// Helper function to format time
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

// Add a helper function to format duration
function formatDuration(seconds) {
  if (!seconds) return "0:00:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  // Always include hours regardless of value
  return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

export default CourseView;
