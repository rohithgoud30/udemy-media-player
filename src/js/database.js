import Dexie from "dexie";

// Database schema for courses, videos, and watch progress
class UdemyMediaPlayerDB extends Dexie {
  constructor() {
    super("UdemyMediaPlayerDB");

    // Define tables and indexes
    this.version(1).stores({
      courses: "++id, title, path, dateAdded",
      sections: "++id, courseId, title, index",
      lectures:
        "++id, sectionId, courseId, title, filePath, subtitlePath, duration, index",
      progress: "lectureId, watched, position, lastWatched",
    });
  }
}

// Create and export a singleton instance
const db = new UdemyMediaPlayerDB();

// Helper functions for database operations
export const CourseManager = {
  // Add a new course to the database
  async addCourse(course) {
    try {
      // Add the course
      const courseId = await db.courses.add({
        title: course.title,
        path: course.path,
        dateAdded: new Date(),
      });

      // Add all sections
      if (course.sections && course.sections.length) {
        for (let i = 0; i < course.sections.length; i++) {
          const section = course.sections[i];
          const sectionId = await db.sections.add({
            courseId,
            title: section.title,
            index: i,
          });

          // Add all lectures in this section
          if (section.lectures && section.lectures.length) {
            for (let j = 0; j < section.lectures.length; j++) {
              const lecture = section.lectures[j];
              await db.lectures.add({
                sectionId,
                courseId,
                title: lecture.title,
                filePath: lecture.filePath,
                subtitlePath: lecture.subtitlePath,
                duration: lecture.duration || 0,
                index: j,
              });
            }
          }
        }
      }

      return courseId;
    } catch (error) {
      console.error("Error adding course:", error);
      throw error;
    }
  },

  // Get all courses
  async getCourses() {
    return await db.courses.toArray();
  },

  // Get a specific course with its sections and lectures
  async getCourseDetails(courseId) {
    const course = await db.courses.get(courseId);
    if (!course) return null;

    const sections = await db.sections
      .where("courseId")
      .equals(courseId)
      .sortBy("index");

    for (const section of sections) {
      section.lectures = await db.lectures
        .where("sectionId")
        .equals(section.id)
        .sortBy("index");
    }

    course.sections = sections;
    return course;
  },

  // Delete a course and all related data
  async deleteCourse(courseId) {
    // Get all section IDs for this course
    const sectionIds = await db.sections
      .where("courseId")
      .equals(courseId)
      .toArray()
      .then((sections) => sections.map((s) => s.id));

    // Delete related lectures and their progress
    const lectureIds = await db.lectures
      .where("courseId")
      .equals(courseId)
      .toArray()
      .then((lectures) => lectures.map((l) => l.id));

    // Start deletion in proper order
    await db.progress.bulkDelete(lectureIds);
    await db.lectures.where("courseId").equals(courseId).delete();
    await db.sections.bulkDelete(sectionIds);
    await db.courses.delete(courseId);

    return true;
  },

  // Calculate course and section durations
  async getCourseDurations(courseId) {
    const course = await this.getCourseDetails(courseId);
    if (!course) return null;

    let totalDuration = 0;
    const sectionDurations = {};

    for (const section of course.sections) {
      let sectionDuration = 0;

      for (const lecture of section.lectures) {
        // Duration is stored in seconds
        const lectureDuration = lecture.duration || 0;
        console.log(
          `Lecture: ${lecture.title}, Duration: ${lectureDuration} seconds`
        );
        sectionDuration += lectureDuration;
        totalDuration += lectureDuration;
      }

      sectionDurations[section.id] = sectionDuration;
      console.log(
        `Section: ${section.title}, Total Duration: ${sectionDuration} seconds`
      );
    }

    console.log(`Course Total Duration: ${totalDuration} seconds`);

    return {
      totalDuration,
      sectionDurations,
    };
  },

  // Update video durations for a course
  async updateLectureDurations(courseId) {
    try {
      const course = await this.getCourseDetails(courseId);
      if (!course) return false;

      console.log("Updating durations for course:", course.title);

      // Create a function to get video duration
      const getVideoDuration = async (filePath) => {
        if (!filePath || !window.electronAPI) return 0;

        try {
          // Check if file exists
          const exists = await window.electronAPI.checkFileExists(filePath);
          if (!exists) {
            console.log(`File not found: ${filePath}`);
            return 0;
          }

          // Create a temporary video element to get duration
          return new Promise((resolve) => {
            const video = document.createElement("video");
            video.onloadedmetadata = () => {
              const duration = Math.round(video.duration);
              video.remove();
              resolve(duration);
            };

            video.onerror = () => {
              console.log(`Error loading video: ${filePath}`);
              video.remove();
              resolve(0);
            };

            // Set a timeout in case video doesn't load
            setTimeout(() => {
              console.log(`Timeout getting duration for: ${filePath}`);
              video.remove();
              resolve(0);
            }, 5000);

            // Use file URL
            const normalizedPath = filePath.replace(/\\/g, "/");
            const fileUrl = `file://${normalizedPath
              .split("/")
              .map((segment) => encodeURIComponent(segment))
              .join("/")}`;

            video.src = fileUrl;
          });
        } catch (error) {
          console.error("Error getting video duration:", error);
          return 0;
        }
      };

      // Update each lecture duration
      let updated = 0;
      for (const section of course.sections) {
        for (const lecture of section.lectures) {
          if (lecture.duration === 0 && lecture.filePath) {
            const duration = await getVideoDuration(lecture.filePath);
            if (duration > 0) {
              await db.lectures.update(lecture.id, { duration });
              console.log(
                `Updated duration for ${lecture.title}: ${duration} seconds`
              );
              updated++;
            }
          }
        }
      }

      console.log(
        `Updated ${updated} lecture durations for course ${course.title}`
      );
      return updated > 0;
    } catch (error) {
      console.error("Error updating lecture durations:", error);
      return false;
    }
  },
};

// Progress tracking functions
export const ProgressManager = {
  // Save watch progress for a lecture
  async saveProgress(lectureId, position, isCompleted = false) {
    const timestamp = new Date();
    const watched = isCompleted ? 1 : position > 0 ? 0.5 : 0;

    return await db.progress.put({
      lectureId,
      position,
      watched,
      lastWatched: timestamp,
    });
  },

  // Mark a lecture as watched/unwatched
  async markLectureWatched(lectureId, watched = true) {
    return await db.progress.put({
      lectureId,
      position: 0, // Reset position if marking unwatched
      watched: watched ? 1 : 0,
      lastWatched: new Date(),
    });
  },

  // Get watch progress for a lecture
  async getLectureProgress(lectureId) {
    return (
      (await db.progress.get(lectureId)) || {
        lectureId,
        position: 0,
        watched: 0,
        lastWatched: null,
      }
    );
  },

  // Get all watched lectures for a course
  async getCourseProgress(courseId) {
    // Get all lecture IDs for this course
    const lectures = await db.lectures
      .where("courseId")
      .equals(courseId)
      .toArray();

    const lectureIds = lectures.map((l) => l.id);

    // Get progress for all lectures
    const progress = await db.progress
      .where("lectureId")
      .anyOf(lectureIds)
      .toArray();

    // Calculate course completion percentage
    const totalLectures = lectures.length;
    const watchedLectures = progress.filter((p) => p.watched === 1).length;
    const partialLectures = progress.filter((p) => p.watched === 0.5).length;

    return {
      totalLectures,
      watchedLectures,
      partialLectures,
      completionPercentage: totalLectures
        ? Math.round(
            ((watchedLectures + partialLectures * 0.5) / totalLectures) * 100
          )
        : 0,
    };
  },

  // Save the last played lecture for a course
  async saveLastPlayedLecture(courseId, lectureId) {
    try {
      // Store in localStorage for quick access
      localStorage.setItem(`lastPlayed_${courseId}`, lectureId.toString());

      // Could also store in IndexedDB if needed for persistence
      return true;
    } catch (error) {
      console.error("Error saving last played lecture:", error);
      return false;
    }
  },

  // Get the last played lecture for a course
  async getLastPlayedLecture(courseId) {
    try {
      const lectureId = localStorage.getItem(`lastPlayed_${courseId}`);
      return lectureId ? parseInt(lectureId) : null;
    } catch (error) {
      console.error("Error getting last played lecture:", error);
      return null;
    }
  },
};

export default db;
