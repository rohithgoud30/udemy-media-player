import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import FileScanner from "../../../js/fileScanner";
import { CourseManager } from "../../../js/database";

interface ImportCourseProps {
  onImportComplete: (course: Course) => void;
}

// Check if running in Electron or browser environment
const isElectron = (): boolean => {
  return window.electronAPI !== undefined;
};

// Browser-compatible path utilities
const pathUtils = {
  basename: (filePath: string): string => {
    // Extract the filename from a path
    return filePath.split("/").pop()!.split("\\").pop()!;
  },
  dirname: (filePath: string): string => {
    // Get the directory name from a path
    return filePath.substring(
      0,
      Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"))
    );
  },
  join: (...parts: string[]): string => {
    // Join path segments
    return parts.join("/");
  },
};

const ImportCourse = ({ onImportComplete }: ImportCourseProps) => {
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ status: string; percent: number }>({
    status: "",
    percent: 0,
  });
  const navigate = useNavigate();
  const fileScanner = useRef(new FileScanner());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Create hidden file input for directory selection
  useEffect(() => {
    const input = document.createElement("input");
    input.type = "file";
    (input as any).webkitdirectory = true; // Allow directory selection
    (input as any).directory = true;
    input.multiple = true;
    input.style.display = "none";

    input.addEventListener("change", handleFileInputChange);

    fileInputRef.current = input;
    document.body.appendChild(input);

    return () => {
      input.removeEventListener("change", handleFileInputChange);
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    };
  }, []);

  // Handle files selected from the file input
  const handleFileInputChange = async (event: Event) => {
    try {
      const files = Array.from((event.target as HTMLInputElement).files ?? []);

      if (files.length === 0) return;

      // Get the directory path from the first file
      // In web environment, we'll use the common parent directory
      const firstFile = files[0] as File & { path?: string };
      let dirPath: string;

      if (firstFile.path) {
        // Electron environment - we have access to full path
        dirPath = pathUtils.dirname(firstFile.path);
      } else {
        // Web environment - we only have webkitRelativePath like "folder/file.mp4"
        // Extract the top-level folder
        const relativePath = firstFile.webkitRelativePath;
        dirPath = relativePath.split("/")[0];
      }

      await importCourseFromFiles(files as Array<File & { path?: string }>, dirPath);
    } catch (err: any) {
      console.error("Failed to process selected files:", err);
      setError(
        `Failed to process selected files: ${err.message}. Please try again.`
      );
    }
  };

  // Process course files directly without using Electron's directory scanning
  const importCourseFromFiles = async (
    files: Array<File & { path?: string }>,
    dirPath: string
  ) => {
    try {
      setImporting(true);
      setProgress({ status: "Processing selected files...", percent: 10 });
      setError(null);

      // Organize files by type and structure
      const videoFiles = files.filter((file) => {
        const name = file.name.toLowerCase();
        return (
          name.endsWith(".mp4") ||
          name.endsWith(".mkv") ||
          name.endsWith(".webm") ||
          name.endsWith(".avi")
        );
      });

      const subtitleFiles = files.filter((file) => {
        const name = file.name.toLowerCase();
        return (
          name.endsWith(".srt") ||
          name.endsWith(".vtt") ||
          name.endsWith(".ass") ||
          name.endsWith(".ssa")
        );
      });

      if (videoFiles.length === 0) {
        throw new Error("No video files found in the selected directory.");
      }

      setProgress({ status: "Organizing course structure...", percent: 30 });

      // Group videos by section (folder)
      const sections: Record<
        string,
        { title: string; lectures: Array<{ title: string; filePath: string; subtitlePath: string | null; duration: number; size: number }> }
      > = {};

      for (const file of videoFiles) {
        const filePath = file.path || file.webkitRelativePath;
        const pathParts = filePath.split("/");

        // Get section name - assume it's one level below the course directory
        let sectionName = "Default Section";
        if (pathParts.length > 2) {
          sectionName = pathParts[1]; // First folder inside the course directory
        }

        // Initialize section if it doesn't exist
        if (!sections[sectionName]) {
          sections[sectionName] = {
            title: cleanSectionName(sectionName),
            lectures: [],
          };
        }

        // Add video to section
        sections[sectionName].lectures.push({
          title: extractLectureName(file.name),
          filePath: filePath,
          subtitlePath: null, // Will be matched later
          duration: 0, // Unknown at this point
          size: file.size,
        });
      }

      // Match subtitles with videos
      for (const file of subtitleFiles) {
        const subtitlePath = file.path || file.webkitRelativePath;
        const subtitleName = file.name.replace(/\.[^.]+$/, ""); // Remove extension

        // Find matching video
        for (const sectionName in sections) {
          const section = sections[sectionName];

          for (const lecture of section.lectures) {
            const videoName = lecture.title.toLowerCase();
            const subtitleBaseName = subtitleName.toLowerCase();

            if (
              videoName.includes(subtitleBaseName) ||
              subtitleBaseName.includes(videoName)
            ) {
              lecture.subtitlePath = subtitlePath;
              break;
            }
          }
        }
      }

      setProgress({ status: "Creating course in database...", percent: 60 });

      // Create course object
      const courseData = {
        title: pathUtils.basename(dirPath),
        path: dirPath,
        sections: Object.values(sections),
      };

      const courseId = await CourseManager.addCourse(courseData);
      const newCourse = await CourseManager.getCourseDetails(courseId);

      setProgress({ status: "Course imported successfully!", percent: 100 });

      // Notify parent component
      if (onImportComplete && newCourse) {
        onImportComplete(newCourse);
      }

      // Navigate to the course view
      setTimeout(() => {
        navigate(`/course/${courseId}`);
      }, 1500);
    } catch (err: any) {
      console.error("Error importing course from files:", err);
      setError(`Failed to import course: ${err.message}`);
      setImporting(false);
    }
  };

  // Helper function to clean section names
  const cleanSectionName = (name: string): string => {
    // Remove numbering prefixes like "01 - " or "1. "
    return name.replace(/^\d+\s*[-_.:]\s*/, "");
  };

  // Helper function to extract lecture names from filenames
  const extractLectureName = (filename: string): string => {
    // Remove extension
    let name = filename.replace(/\.[^.]+$/, "");
    // Remove numbering prefix
    name = name.replace(/^\d+\s*[-_.:]\s*/, "");
    return name;
  };

  // Handle folder selection from file dialog
  const handleSelectFolder = async () => {
    try {
      if (isElectron()) {
        const dirPath = await window.electronAPI.selectDirectory();
        if (dirPath) {
          await importCourse(dirPath);
          return;
        }
      }

      if (fileInputRef.current) {
        fileInputRef.current.click();
      } else {
        throw new Error("File input not initialized");
      }
    } catch (err: any) {
      console.error("Failed to open file dialog:", err);
      setError(
        `Failed to open file selector: ${err.message}. Please try again.`
      );
    }
  };

  // Handle drag events
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Handle folder drop
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);

    // Check if items are available in the dataTransfer
    if (e.dataTransfer.items) {
      // Look for a directory
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];

        // webkitGetAsEntry is used to check if it's a directory
        const entry = item.webkitGetAsEntry();

        if (entry && entry.isDirectory) {
          try {
            // Get the path from Electron (this requires custom handling)
            const path = (e.dataTransfer.items[i].getAsFile() as any).path;
            await importCourse(path);
            break;
          } catch (err) {
            console.error("Failed to import dropped folder:", err);
            setError(
              'Failed to import the dropped folder. Please try using the "Select Folder" button instead.'
            );
          }
        }
      }
    }
  };

  // Import a course from a directory
  const importCourse = async (dirPath: string) => {
    try {
      setImporting(true);
      setProgress({ status: "Scanning directory...", percent: 10 });
      setError(null);

      const courseData = await fileScanner.current.scanCourseDirectory(dirPath);

      if (
        !courseData ||
        !courseData.sections ||
        courseData.sections.length === 0
      ) {
        console.error("No valid course content found");
        throw new Error(
          "No valid course content found in the selected directory."
        );
      }

      setProgress({ status: "Processing course structure...", percent: 50 });

      const courseId = await CourseManager.addCourse(courseData);
      const newCourse = await CourseManager.getCourseDetails(courseId);

      setProgress({ status: "Course imported successfully!", percent: 100 });

      // Notify parent component
      if (onImportComplete && newCourse) {
        onImportComplete(newCourse);
      }

      // Navigate to the course view
      setTimeout(() => {
        navigate(`/course/${courseId}`);
      }, 1500);
    } catch (err: any) {
      console.error("Failed to import course:", err);
      setError(`Failed to import course: ${err.message}`);
      setImporting(false);
    }
  };

  // If importing, show a fullscreen loading overlay instead of the import UI
  if (importing) {
    return (
      <div className="import-loading-screen">
        <div className="import-loading-content">
          <h2>Importing Course</h2>
          <div className="progress-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress.percent}%` }}
              ></div>
            </div>
            <div className="progress-text">
              {progress.status} ({progress.percent}%)
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="import-container">
      <h1>Import Udemy Course</h1>

      <p className="import-instructions">
        Select a Udemy course folder or drag and drop it below. The folder
        should contain video files organized in sections.
      </p>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {importing ? (
        <div className="import-progress">
          <h3>{progress.status}</h3>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress.percent}%` }}
            ></div>
          </div>
        </div>
      ) : (
        <>
          <div
            className={`drop-zone ${dragging ? "dragging" : ""}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="drop-icon">📁</div>
            <p>Drag and drop a course folder here</p>
            <p className="drop-subtitle">or</p>
            <button className="select-folder-btn" onClick={handleSelectFolder}>
              Select Folder
            </button>
          </div>

          <div className="import-tips">
            <h3>Tips for best results:</h3>
            <ul>
              <li>Choose the main course folder that contains all sections</li>
              <li>
                Make sure video files have extensions like .mp4, .mkv, or .webm
              </li>
              <li>
                Subtitle files should be in the same folder as their videos
              </li>
              <li>Folders are typically organized by sections and lectures</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default ImportCourse;
