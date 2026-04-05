import React, { useState, useEffect, useCallback } from "react";
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./styles/global.css";

// Components
import Navbar from "./components/Navbar";
import Library from "./components/Library/Library";
import CourseView from "./components/Course/CourseView";
import ModernVideoPlayer from "./components/Player/ModernVideoPlayer";
import ImportCourse from "./components/Library/ImportCourse";
import Settings from "./components/Settings/Settings";

// Database
import { CourseManager } from "../js/database";

function App() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load courses from database on app start
  useEffect(() => {
    async function loadCourses() {
      try {
        setLoading(true);
        const courseData = await CourseManager.getCourses();
        setCourses(courseData);
      } catch (err) {
        console.error("Failed to load courses:", err);
        setError("Failed to load your course library. Please try restarting the app.");
      } finally {
        setLoading(false);
      }
    }

    loadCourses();
  }, []);

  // Handle course import completion
  const handleImportComplete = useCallback((newCourse: Course) => {
    setCourses((prev) => [...prev, newCourse]);
  }, []);

  // Handle course deletion
  const handleCourseDelete = useCallback(async (courseId: number) => {
    try {
      await CourseManager.deleteCourse(courseId);
      setCourses((prev) => prev.filter((course) => course.id !== courseId));
    } catch (error) {
      console.error("Failed to delete course:", error);
      setError("Failed to delete the course. Please try again.");
    }
  }, []);

  return (
    <Router>
      <AppShell
        courses={courses}
        loading={loading}
        error={error}
        onClearError={() => setError(null)}
        onImportComplete={handleImportComplete}
        onDeleteCourse={handleCourseDelete}
      />
    </Router>
  );
}

function AppShell({
  courses,
  loading,
  error,
  onClearError,
  onImportComplete,
  onDeleteCourse,
}: {
  courses: Course[];
  loading: boolean;
  error: string | null;
  onClearError: () => void;
  onImportComplete: (course: Course) => void;
  onDeleteCourse: (id: number) => void;
}) {
  const location = useLocation();
  const isPlayerRoute = location.pathname.startsWith("/watch/");

  return (
    <div className="app-container">
      {!isPlayerRoute && <Navbar />}

      <div className={isPlayerRoute ? "content-area-player" : "content-area"}>
        {error && (
          <div className="error-message">
            {error}
            <button onClick={onClearError}>Dismiss</button>
          </div>
        )}

        <Routes>
          <Route
            path="/"
            element={
              <Library courses={courses} loading={loading} onDeleteCourse={onDeleteCourse} />
            }
          />

          <Route
            path="/import"
            element={<ImportCourse onImportComplete={onImportComplete} />}
          />

          <Route path="/course/:courseId" element={<CourseView />} />

          <Route path="/watch/:lectureId" element={<ModernVideoPlayer />} />

          <Route path="/settings" element={<Settings />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
