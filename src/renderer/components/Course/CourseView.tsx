import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { CourseManager, ProgressManager } from "../../../js/database";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faArrowRotateRight,
  faChevronDown,
  faChevronRight,
  faCheck,
  faClock,
  faArrowLeft,
} from "@fortawesome/free-solid-svg-icons";
import { formatDuration, formatTimeWords } from "../../utils/formatters";
import "./CourseView.css";

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

        const needsDurationUpdate = courseData.sections!.some((section) =>
          section.lectures!.some((lecture) => lecture.duration === 0)
        );

        if (needsDurationUpdate) {
          await CourseManager.updateLectureDurations(parseInt(courseId!));
        }

        const durations = await CourseManager.getCourseDurations(
          parseInt(courseId!)
        );
        setCourseDurations(durations);

        const lastPlayedId = await ProgressManager.getLastPlayedLecture(
          parseInt(courseId!)
        );
        setLastPlayedLectureId(lastPlayedId);

        const expanded: Record<number, boolean> = {};
        if (lastPlayedId) {
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

          if (!sectionFound && courseData.sections!.length > 0) {
            const firstSection =
              courseData.sections!.find((s) => s.index === 0) ||
              courseData.sections![0];
            if (firstSection) {
              expanded[firstSection.id!] = true;
            }
          }
        } else if (courseData.sections && courseData.sections.length > 0) {
          const firstSection =
            courseData.sections.find((s) => s.index === 0) ||
            courseData.sections[0];
          if (firstSection) {
            expanded[firstSection.id!] = true;
          }
        }

        setExpandedSections(expanded);

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

  const toggleSection = (sectionId: number) => {
    setExpandedSections((prev) => {
      if (prev[sectionId]) {
        return { ...prev, [sectionId]: false };
      }
      const newState: Record<number, boolean> = {};
      newState[sectionId] = true;
      return newState;
    });
  };

  const toggleWatchStatus = async (lectureId: number, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const currentProgress = lectureProgress[lectureId];
      const newWatchedStatus = currentProgress.watched !== 1;

      await ProgressManager.markLectureWatched(lectureId, newWatchedStatus);

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
      <div className="cv-top-bar">
        <Link to="/" className="cv-back-link">
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Library</span>
        </Link>
      </div>

      <div className="cv-hero">
        <h1 className="cv-title" title={course.title}>{course.title}</h1>
        <CourseProgressBar course={course} lectureProgress={lectureProgress} />
        {courseDurations && (
          <div className="cv-meta-row">
            <span className="cv-meta-item">
              <FontAwesomeIcon icon={faClock} />
              {formatTimeWords(courseDurations.totalDuration)}
            </span>
            <span className="cv-meta-item">
              {course.sections!.reduce((t, s) => t + s.lectures!.length, 0)} lectures
            </span>
            <span className="cv-meta-item">
              {course.sections!.length} sections
            </span>
          </div>
        )}
      </div>

      <div className="cv-sections">
        {course.sections!.map((section, sIdx) => {
          const isExpanded = expandedSections[section.id!];
          const sectionWatched = section.lectures!.filter(
            (l) => lectureProgress[l.id!]?.watched === 1
          ).length;
          const sectionTotal = section.lectures!.length;

          return (
            <div key={section.id} className={`cv-section ${isExpanded ? "expanded" : ""}`}>
              <div
                className="cv-section-header"
                onClick={() => toggleSection(section.id!)}
              >
                <div className="cv-section-left">
                  <span className="cv-section-chevron">
                    <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} />
                  </span>
                  <div className="cv-section-info">
                    <span className="cv-section-label">Section {sIdx + 1}</span>
                    <h3 className="cv-section-name">{section.title}</h3>
                  </div>
                </div>
                <div className="cv-section-right">
                  <span className="cv-section-count">
                    {sectionWatched}/{sectionTotal}
                  </span>
                  {courseDurations &&
                    courseDurations.sectionDurations[section.id!] && (
                      <span className="cv-section-duration">
                        {formatTimeWords(courseDurations.sectionDurations[section.id!])}
                      </span>
                    )}
                </div>
              </div>

              {isExpanded && (
                <div className="cv-lectures">
                  {section.lectures!.map((lecture, lIdx) => {
                    const progress = lectureProgress[lecture.id!] || {
                      watched: 0,
                      position: 0,
                    };
                    const isWatched = progress.watched === 1;
                    const isPartial = progress.watched === 0.5;
                    const isLastPlayed = lecture.id === lastPlayedLectureId;
                    const hasResume = progress.position > 0 && !isWatched;

                    return (
                      <div
                        key={lecture.id}
                        className={`cv-lecture ${isWatched ? "watched" : ""} ${isPartial ? "partial" : ""} ${isLastPlayed ? "last-played" : ""}`}
                      >
                        <button
                          className={`cv-check ${isWatched ? "checked" : ""} ${isPartial ? "partial" : ""}`}
                          onClick={(e) => toggleWatchStatus(lecture.id!, e)}
                          title={isWatched ? "Mark as unwatched" : "Mark as watched"}
                        >
                          {isWatched && <FontAwesomeIcon icon={faCheck} />}
                        </button>

                        <div className="cv-lecture-body">
                          <Link
                            to={`/watch/${lecture.id}`}
                            className="cv-lecture-title"
                            title={lecture.title}
                          >
                            <span className="cv-lecture-num">{lIdx + 1}.</span>
                            {lecture.title}
                          </Link>
                          {isLastPlayed && (
                            <span className="cv-now-badge">Continue</span>
                          )}
                        </div>

                        <div className="cv-lecture-right">
                          {lecture.duration > 0 && (
                            <span className="cv-lecture-dur">
                              {formatDuration(lecture.duration)}
                            </span>
                          )}
                          <Link
                            to={`/watch/${lecture.id}`}
                            className={`cv-play ${hasResume ? "resume" : ""}`}
                            title={
                              hasResume
                                ? `Resume at ${formatDuration(progress.position)}`
                                : "Play lecture"
                            }
                            state={{ startPosition: progress.position }}
                          >
                            {hasResume ? (
                              <>
                                <FontAwesomeIcon icon={faArrowRotateRight} />
                                <span>{formatDuration(progress.position)}</span>
                              </>
                            ) : (
                              <>
                                <FontAwesomeIcon icon={faPlay} />
                                <span>Play</span>
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
          );
        })}
      </div>
    </div>
  );
};

const CourseProgressBar = ({ course, lectureProgress }: CourseProgressBarProps) => {
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
    <div className="cv-progress">
      <div className="cv-progress-bar">
        <div
          className="cv-progress-fill"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>
      <div className="cv-progress-label">
        <span className="cv-progress-pct">{completionPercentage}%</span>
        <span className="cv-progress-detail">
          {watchedLectures} of {totalLectures} completed
        </span>
      </div>
    </div>
  );
};

export default CourseView;
