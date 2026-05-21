import { useState, useEffect, useCallback } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { CourseManager } from "../js/database";
import "./styles/global.css";

function App() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const onImportComplete = useCallback((newCourse: Course) => {
    setCourses((prev) => [...prev, newCourse]);
  }, []);

  const onDeleteCourse = useCallback(async (courseId: number) => {
    try {
      await CourseManager.deleteCourse(courseId);
      setCourses((prev) => prev.filter((course) => course.id !== courseId));
    } catch (err) {
      console.error("Failed to delete course:", err);
      setError("Failed to delete the course. Please try again.");
    }
  }, []);

  const onClearError = useCallback(() => setError(null), []);

  return (
    <RouterProvider
      router={router}
      context={{
        courses,
        loading,
        error,
        onClearError,
        onImportComplete,
        onDeleteCourse,
      }}
    />
  );
}

export default App;
