import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { CourseManager, ProgressManager } from "../../../js/database";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faArrowRotateRight } from "@fortawesome/free-solid-svg-icons";
import { formatDuration, formatTimeWords } from "../../utils/formatters";

interface CourseProgressBarProps {
  course: Course;
  lectureProgress: Record<number, LectureProgress>;
}

const CourseView = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lectureProgress, setLectureProgress] = useState<Record<number, LectureProgress>>({});
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});
  const [courseDurations, setCourseDurations] = useState<CourseDurations | null>(null);
  const [lastPlayedLectureId, setLastPlayedLectureId] = useState<number | null>(null);

  // Load course data and progress
  useEffect(() => {
    async function loadCourseDetails() {
      try {
        setLoading(true);
        const courseData = await CourseManager.getCourseDetails(
          parseInt(courseId!)
        );

        if (!courseData) {
          setError("Course not found");
          return;
        }

        setCourse(courseData);

        // Check if we need to update lecture durations
        const needsDurationUpdate = courseData.sections!.some((section) =>
          section.lectures!.some((lecture) => lecture.duration === 0)
        );

        if (needsDurationUpdate) {
          await CourseManager.updateLectureDurations(parseInt(courseId!));
        }

        // Load course and section durations
        const durations = await CourseManager.getCourseDurations(
          parseInt(courseId!)
        );
        setCourseDurations(durations);

        // Get the last played lecture
        const lastPlayedId = await ProgressManager.getLastPlayedLecture(
          parseInt(courseId!)
        );
        setLastPlayedLectureId(lastPlayedId);

        // Set expanded sections based on last played lecture
        const expanded: Record<number, boolean> = {};
        if (lastPlayedId) {
          // Find the section containing the last played lecture
          let sectionFound = false;
          for (const section of courseData.sections!) {
            if (
              section.lectures!.some((lecture) => lecture.id === lastPlayedId)
            ) {
              expanded[section.id!] = true;
              sectionFound = true;
              break;
            }
          }

          // If we couldn't find the section, default to first section
          if (!sectionFound && courseData.sections!.length > 0) {
            const firstSection =
              courseData.sections!.find((s) => s.index === 0) ||
              courseData.sections![0];
            if (firstSection) {
              expanded[firstSection.id!] = true;
            }
          }
        } else if (courseData.sections && courseData.sections.length > 0) {
          // Default to expanding first section if no last played lecture
          const firstSection =
            courseData.sections.find((s) => s.index === 0) ||
            courseData.sections[0];
          if (firstSection) {
            expanded[firstSection.id!] = true;
          }
        }

        setExpandedSections(expanded);

        // Load progress for all lectures
        const progress: Record<number, LectureProgress> = {};
        for (const section of courseData.sections!) {
          for (const lecture of section.lectures!) {
            const lp = await ProgressManager.getLectureProgress(lecture.id!);
            progress[lecture.id!] = lp;
          }
        }
        setLectureProgress(progress);
      } catch (err) {
        console.error("Error loading course details:", err);
        setError("Failed to load course details");
      } finally {
        setLoading(false);
      }
    }

    loadCourseDetails();
  }, [courseId]);

  // Toggle section expansion with accordion behavior
  const toggleSection = (sectionId: number) => {
    setExpandedSections((prev) => {
      // If this section is already open and being clicked, just close it
      if (prev[sectionId]) {
        return {
          ...prev,
          [sectionId]: false,
        };
      }

      // Create a new object with all sections closed
      const newState: Record<number, boolean> = {};

      // Then set only the clicked section to open
      newState[sectionId] = true;

      return newState;
    });
  };

  // Mark lecture as watched/unwatched
  const toggleWatchStatus = async (lectureId: number, e: React.MouseEvent) => {
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
    } catch (err) {
      console.error("Error toggling watch status:", err);
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
        <h1 title={course.title}>{course.title}</h1>
        <div className="course-actions">
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
            Total Duration: {formatTimeWords(courseDurations.totalDuration)}
          </div>
        )}
      </div>

      <div className="sections-container">
        {course.sections!.map((section) => (
          <div key={section.id} className="section">
            <div
              className="section-header"
              onClick={() => toggleSection(section.id!)}
            >
              <div className="section-title">
                <span className="expand-icon">
                  {expandedSections[section.id!] ? "▼" : "►"}
                </span>
                <h3>{section.title}</h3>
              </div>
              <div className="section-meta">
                {section.lectures!.length} lectures
                {courseDurations &&
                  courseDurations.sectionDurations[section.id!] && (
                    <span className="section-duration">
                      •{" "}
                      {formatTimeWords(
                        courseDurations.sectionDurations[section.id!]
                      )}
                    </span>
                  )}
              </div>
            </div>

            {expandedSections[section.id!] && (
              <div className="lectures-list">
                {section.lectures!.map((lecture) => {
                  const progress = lectureProgress[lecture.id!] || {
                    watched: 0,
                    position: 0,
                  };
                  const watchStatus =
                    progress.watched === 1
                      ? "watched"
                      : progress.watched === 0.5
                      ? "partial"
                      : "unwatched";
                  const isLastPlayed = lecture.id === lastPlayedLectureId;

                  return (
                    <div
                      key={lecture.id}
                      className={`lecture ${watchStatus} ${
                        isLastPlayed ? "last-played" : ""
                      }`}
                    >
                      <div className="lecture-info">
                        <button
                          className={`watch-toggle ${watchStatus}`}
                          onClick={(e) => toggleWatchStatus(lecture.id!, e)}
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
                          title={lecture.title}
                        >
                          {lecture.title}
                          {isLastPlayed && (
                            <span className="last-played-badge">
                              Last Played
                            </span>
                          )}
                        </Link>
                      </div>

                      <div className="lecture-actions">
                        {lecture.duration > 0 && (
                          <span className="lecture-duration">
                            {formatDuration(lecture.duration)}
                          </span>
                        )}
                        <Link
                          to={`/watch/${lecture.id}`}
                          className={`play-button ${
                            progress.position > 0 && progress.watched !== 1
                              ? "resume"
                              : ""
                          }`}
                          title={
                            progress.position > 0 && progress.watched !== 1
                              ? `Resume at ${formatDuration(progress.position)}`
                              : "Play lecture"
                          }
                          state={{ startPosition: progress.position }}
                        >
                          {progress.position > 0 && progress.watched !== 1 ? (
                            <>
                              <FontAwesomeIcon
                                icon={faArrowRotateRight}
                                className="resume-icon"
                              />
                              <span className="resume-text">
                                {formatDuration(progress.position)}
                              </span>
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon
                                icon={faPlay}
                                className="play-icon"
                              />
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
    </div>
  );
};

// Helper component for course progress bar
const CourseProgressBar = ({ course, lectureProgress }: CourseProgressBarProps) => {
  // Calculate overall completion
  const totalLectures = course.sections!.reduce(
    (total, section) => total + section.lectures!.length,
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

export default CourseView;
