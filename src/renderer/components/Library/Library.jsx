import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ProgressManager } from "../../../js/database";

const Library = ({ courses, loading, onDeleteCourse }) => {
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState("dateAdded");
  const [courseProgress, setCourseProgress] = useState({});

  // Load progress information for all courses
  React.useEffect(() => {
    async function loadAllProgress() {
      const progressData = {};

      for (const course of courses) {
        try {
          const progress = await ProgressManager.getCourseProgress(course.id);
          progressData[course.id] = progress;
        } catch (error) {
          console.error(`Failed to load progress for course ${course.id}:`, error);
        }
      }

      setCourseProgress(progressData);
    }

    if (courses.length > 0) {
      loadAllProgress();
    }
  }, [courses]);

  // Filter and sort courses
  const filteredCourses = courses
    .filter((course) => course.title.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      } else if (sortBy === "dateAdded") {
        return new Date(b.dateAdded) - new Date(a.dateAdded);
      }
      return 0;
    });

  if (loading) {
    return <div className="loading">Loading your course library...</div>;
  }

  return (
    <div className="library-container">
      <div className="library-header">
        <h1>Your Course Library</h1>
        <div className="library-controls">
          <input
            type="text"
            placeholder="Search courses..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="search-input"
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="dateAdded">Sort by Date Added</option>
            <option value="title">Sort by Title</option>
          </select>
        </div>
      </div>

      {filteredCourses.length === 0 ? (
        <div className="empty-library">
          <p>Your library is empty. Import a course to get started.</p>
          <Link to="/import" className="import-button">
            Import Course
          </Link>
        </div>
      ) : (
        <div className="courses-grid">
          {filteredCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              progress={courseProgress[course.id]}
              onDelete={() => onDeleteCourse(course.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CourseCard = ({ course, progress, onDelete }) => {
  const progressPercentage = progress ? progress.completionPercentage : 0;

  // Generate deterministic gradient based on course title
  const getGradient = (name) => {
    // 1. Generate a strong hash from the name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash; // Convert to 32bit integer
    }

    // 2. Generate two distinct colors using HSL
    // Use the hash to pick a starting hue
    const c1 = Math.abs(hash % 360);
    // Be complementary or analogous - let's try a distinct shift
    const c2 = (c1 + 40 + Math.abs((hash >> 8) % 60)) % 360;

    // Keep saturation high (60-80%) and lightness balanced (50-65%) for vibrant look
    // Using distinct values for the second color to ensure gradient visibility
    const s1 = 70 + Math.abs((hash >> 4) % 20); // 70-90%
    const l1 = 50 + Math.abs((hash >> 16) % 15); // 50-65%

    const s2 = 80 + Math.abs((hash >> 12) % 20); // 80-100%
    const l2 = 55 + Math.abs((hash >> 20) % 15); // 55-70%

    return `linear-gradient(135deg, hsl(${c1}, ${s1}%, ${l1}%) 0%, hsl(${c2}, ${s2}%, ${l2}%) 100%)`;
  };

  return (
    <div className="course-card">
      <div className="course-thumbnail">
        {/* We'll use the first letter of the course as a placeholder */}
        <div className="thumbnail-placeholder" style={{ background: getGradient(course.title) }}>
          {course.title.charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="course-info">
        <h3 className="course-title" title={course.title}>
          {course.title}
        </h3>

        <div className="course-meta">
          <span>Added: {new Date(course.dateAdded).toLocaleDateString()}</span>
        </div>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressPercentage}%` }}></div>
        </div>
        <div className="progress-text">{progressPercentage}% Complete</div>

        <div className="course-actions">
          <Link to={`/course/${course.id}`} className="view-button">
            View Course
          </Link>
          <button onClick={onDelete} className="delete-button">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default Library;
