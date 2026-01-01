// File system scanner for importing Udemy courses
// This uses the Electron main process via preload API

/**
 * Scans a directory for Udemy course content
 * Identifies videos and subtitles, organizes them by section/lecture
 */
export default class FileScanner {
  constructor() {
    // Make sure we're in Electron with the proper API
    this.electronAPI = window.electronAPI;
    if (!this.electronAPI) {
      console.error("Electron API not available - file scanning will not work");
      console.log(
        "Available window properties:",
        Object.keys(window).filter((key) => key.includes("electron")),
      );
    }
  }

  /**
   * Scan a course directory
   * @param {string} dirPath Path to the course directory
   * @returns {Promise<Object>} Course object with sections and lectures
   */
  async scanCourseDirectory(dirPath) {
    if (!this.electronAPI) {
      throw new Error("Electron API not available");
    }

    try {
      // Invoke the main process to scan the directory
      // This is implemented in the preload.js/main.js
      const result = await this.electronAPI.invoke("scan-directory", dirPath);
      return this.processScanResults(result, dirPath);
    } catch (error) {
      console.error("Error scanning directory:", error);
      throw error;
    }
  }

  /**
   * Process scan results into a course structure
   * @param {Object} scanResults Raw scan results from main process
   * @param {string} coursePath Original course path
   */
  processScanResults(scanResults, coursePath) {
    // Extract course name from the path
    const pathParts = coursePath.split("/");
    const courseName = pathParts[pathParts.length - 1];

    // Create course object
    const course = {
      title: courseName,
      path: coursePath,
      sections: [],
    };

    // Group files by section
    const sectionMap = new Map();

    // Track if we have a flat structure (videos directly in root)
    let hasFlatStructure = false;
    const DEFAULT_SECTION = "__flat_root__";

    for (const file of scanResults.files) {
      // Skip non-video and non-subtitle files
      if (!this.isVideoFile(file.path) && !this.isSubtitleFile(file.path)) {
        continue;
      }

      // Extract section from path
      const relativePath = file.path.replace(coursePath, "");
      const pathSegments = relativePath.split("/").filter(Boolean);

      // Case 1: Files are organized in section folders (nested structure)
      if (pathSegments.length > 1) {
        const sectionName = pathSegments[0];

        if (!sectionMap.has(sectionName)) {
          sectionMap.set(sectionName, {
            title: this.cleanSectionName(sectionName),
            lectures: [],
          });
        }

        const section = sectionMap.get(sectionName);

        if (this.isVideoFile(file.path)) {
          // Add as a lecture
          const lecture = {
            title: this.extractLectureName(file.name),
            filePath: file.path,
            subtitlePath: null, // Will try to find matching subtitle later
            duration: 0, // Will be determined when playing
          };

          section.lectures.push(lecture);
        }
      }
      // Case 2: Files are directly in root folder (flat structure)
      else if (pathSegments.length === 1 && this.isVideoFile(file.path)) {
        hasFlatStructure = true;

        if (!sectionMap.has(DEFAULT_SECTION)) {
          sectionMap.set(DEFAULT_SECTION, {
            title: "All Lectures",
            lectures: [],
          });
        }

        const section = sectionMap.get(DEFAULT_SECTION);
        const lecture = {
          title: this.extractLectureName(file.name),
          filePath: file.path,
          subtitlePath: null,
          duration: 0,
        };

        section.lectures.push(lecture);
      }
    }

    // Match subtitles with videos
    for (const file of scanResults.files) {
      if (!this.isSubtitleFile(file.path)) continue;

      // Find matching video file
      const baseName = file.name.replace(/\.[^.]+$/, "");

      for (const section of sectionMap.values()) {
        for (const lecture of section.lectures) {
          const lectureBaseName = lecture.filePath
            .split("/")
            .pop()
            .replace(/\.[^.]+$/, "");

          if (lectureBaseName === baseName || lecture.title.includes(baseName)) {
            lecture.subtitlePath = file.path;
            break;
          }
        }
      }
    }

    // Convert map to array and sort sections
    course.sections = Array.from(sectionMap.values()).sort(
      (a, b) => this.getSectionOrder(a.title) - this.getSectionOrder(b.title),
    );

    // Sort lectures within each section
    for (const section of course.sections) {
      section.lectures = section.lectures.sort(
        (a, b) => this.getLectureOrder(a.title) - this.getLectureOrder(b.title),
      );
    }

    return course;
  }

  /**
   * Extract section order from section name (e.g., "01 - Introduction" -> 1)
   */
  getSectionOrder(sectionName) {
    const match = sectionName.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 999;
  }

  /**
   * Extract lecture order from lecture name (e.g., "01 - Welcome" -> 1)
   */
  getLectureOrder(lectureName) {
    const match = lectureName.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 999;
  }

  /**
   * Clean section name (remove numbering prefixes)
   */
  cleanSectionName(name) {
    return name.replace(/^\d+\s*[-_.]\s*/, "");
  }

  /**
   * Extract lecture name from filename
   */
  extractLectureName(filename) {
    // Remove extension
    let name = filename.replace(/\.[^.]+$/, "");
    // Remove numbering prefix
    name = name.replace(/^\d+\s*[-_.]\s*/, "");
    return name;
  }

  /**
   * Check if a file is a video
   */
  isVideoFile(path) {
    const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".webm"];
    return videoExtensions.some((ext) => path.toLowerCase().endsWith(ext));
  }

  /**
   * Check if a file is a subtitle
   */
  isSubtitleFile(path) {
    const subtitleExtensions = [".srt", ".vtt", ".ass", ".ssa"];
    return subtitleExtensions.some((ext) => path.toLowerCase().endsWith(ext));
  }
}
