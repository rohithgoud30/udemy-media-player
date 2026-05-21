import { createFileRoute } from "@tanstack/react-router";
import CourseView from "../../components/Course/CourseView";

export const Route = createFileRoute("/_app/course/$courseId")({
  component: CourseView,
});
