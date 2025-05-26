import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FileScanner from '../../../js/fileScanner';
import { CourseManager } from '../../../js/database';

// Check if running in Electron or browser environment
const isElectron = () => {
  return window.electronAPI !== undefined;
};

// Browser-compatible path utilities
const pathUtils = {
  basename: (filePath) => {
    // Extract the filename from a path
    return filePath.split('/').pop().split('\\').pop();
  },
  dirname: (filePath) => {
    // Get the directory name from a path
    return filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));
  },
  join: (...parts) => {
    // Join path segments
    return parts.join('/');
  }
};

const ImportCourse = ({ onImportComplete }) => {
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ status: '', percent: 0 });
  const navigate = useNavigate();
  const fileScanner = useRef(new FileScanner());
  const fileInputRef = useRef(null);
  
  // Create hidden file input for directory selection
  useEffect(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true; // Allow directory selection
    input.directory = true;
    input.multiple = true;
    input.style.display = 'none';
    
    input.addEventListener('change', handleFileInputChange);
    
    fileInputRef.current = input;
    document.body.appendChild(input);
    
    return () => {
      input.removeEventListener('change', handleFileInputChange);
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    };
  }, []);
  
  // Handle files selected from the file input
  const handleFileInputChange = async (event) => {
    try {
      const files = Array.from(event.target.files);
      
      if (files.length === 0) {
        console.log('No files selected');
        return;
      }
      
      // Get the directory path from the first file
      // In web environment, we'll use the common parent directory
      const firstFilePath = files[0].path || files[0].webkitRelativePath;
      let dirPath;
      
      if (files[0].path) {
        // Electron environment - we have access to full path
        dirPath = pathUtils.dirname(files[0].path);
      } else {
        // Web environment - we only have webkitRelativePath like "folder/file.mp4"
        // Extract the top-level folder
        const relativePath = files[0].webkitRelativePath;
        dirPath = relativePath.split('/')[0];
      }
      
      console.log('Selected directory:', dirPath);
      console.log('Number of files:', files.length);
      
      // We can process the files directly instead of scanning the directory
      await importCourseFromFiles(files, dirPath);
    } catch (error) {
      console.error('Failed to process selected files:', error);
      setError(`Failed to process selected files: ${error.message}. Please try again.`);
    }
  };
  
  // Process course files directly without using Electron's directory scanning
  const importCourseFromFiles = async (files, dirPath) => {
    try {
      setImporting(true);
      setProgress({ status: 'Processing selected files...', percent: 10 });
      setError(null);
      
      console.log('Processing files for course import...');
      
      // Organize files by type and structure
      const videoFiles = files.filter(file => {
        const name = file.name.toLowerCase();
        return name.endsWith('.mp4') || name.endsWith('.mkv') || 
               name.endsWith('.webm') || name.endsWith('.avi');
      });
      
      const subtitleFiles = files.filter(file => {
        const name = file.name.toLowerCase();
        return name.endsWith('.srt') || name.endsWith('.vtt') || 
               name.endsWith('.ass') || name.endsWith('.ssa');
      });
      
      console.log(`Found ${videoFiles.length} video files and ${subtitleFiles.length} subtitle files`);
      
      if (videoFiles.length === 0) {
        throw new Error('No video files found in the selected directory.');
      }
      
      setProgress({ status: 'Organizing course structure...', percent: 30 });
      
      // Group videos by section (folder)
      const sections = {};
      
      for (const file of videoFiles) {
        const filePath = file.path || file.webkitRelativePath;
        const pathParts = filePath.split('/');
        
        // Get section name - assume it's one level below the course directory
        let sectionName = 'Default Section';
        if (pathParts.length > 2) {
          sectionName = pathParts[1]; // First folder inside the course directory
        }
        
        // Initialize section if it doesn't exist
        if (!sections[sectionName]) {
          sections[sectionName] = {
            title: cleanSectionName(sectionName),
            lectures: []
          };
        }
        
        // Add video to section
        sections[sectionName].lectures.push({
          title: extractLectureName(file.name),
          filePath: filePath,
          subtitlePath: null, // Will be matched later
          duration: 0, // Unknown at this point
          size: file.size
        });
      }
      
      // Match subtitles with videos
      for (const file of subtitleFiles) {
        const subtitlePath = file.path || file.webkitRelativePath;
        const subtitleName = file.name.replace(/\.[^.]+$/, ''); // Remove extension
        
        // Find matching video
        for (const sectionName in sections) {
          const section = sections[sectionName];
          
          for (const lecture of section.lectures) {
            const videoName = lecture.title.toLowerCase();
            const subtitleBaseName = subtitleName.toLowerCase();
            
            if (videoName.includes(subtitleBaseName) || subtitleBaseName.includes(videoName)) {
              lecture.subtitlePath = subtitlePath;
              break;
            }
          }
        }
      }
      
      setProgress({ status: 'Creating course in database...', percent: 60 });
      
      // Create course object
      const courseData = {
        title: pathUtils.basename(dirPath),
        path: dirPath,
        sections: Object.values(sections)
      };
      
      // Add course to database
      const courseId = await CourseManager.addCourse(courseData);
      console.log('Course added with ID:', courseId);
      
      // Get the full course details with the assigned ID
      const newCourse = await CourseManager.getCourseDetails(courseId);
      console.log('Retrieved course details:', newCourse);
      
      setProgress({ status: 'Course imported successfully!', percent: 100 });
      
      // Notify parent component
      if (onImportComplete) {
        onImportComplete(newCourse);
      }
      
      // Navigate to the course view
      setTimeout(() => {
        navigate(`/course/${courseId}`);
      }, 1500);
      
    } catch (error) {
      console.error('Error importing course from files:', error);
      setError(`Failed to import course: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };
  
  // Helper function to clean section names
  const cleanSectionName = (name) => {
    // Remove numbering prefixes like "01 - " or "1. "
    return name.replace(/^\d+\s*[-_.:]\s*/, '');
  };
  
  // Helper function to extract lecture names from filenames
  const extractLectureName = (filename) => {
    // Remove extension
    let name = filename.replace(/\.[^.]+$/, '');
    // Remove numbering prefix
    name = name.replace(/^\d+\s*[-_.:]\s*/, '');
    return name;
  };
  
  // Handle folder selection from file dialog
  const handleSelectFolder = async () => {
    try {
      // First try to use Electron API if available
      if (isElectron()) {
        console.log('Using Electron API for directory selection');
        const dirPath = await window.electronAPI.selectDirectory();
        if (dirPath) {
          await importCourse(dirPath);
          return;
        }
      }
      
      // Fall back to browser API
      console.log('Using browser API for directory selection');
      if (fileInputRef.current) {
        fileInputRef.current.click();
      } else {
        throw new Error('File input not initialized');
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error);
      setError(`Failed to open file selector: ${error.message}. Please try again.`);
    }
  };
  
  // Handle drag events
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  // Handle folder drop
  const handleDrop = async (e) => {
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
            const path = e.dataTransfer.items[i].getAsFile().path;
            await importCourse(path);
            break;
          } catch (error) {
            console.error('Failed to import dropped folder:', error);
            setError('Failed to import the dropped folder. Please try using the "Select Folder" button instead.');
          }
        }
      }
    }
  };
  
  // Import a course from a directory
  const importCourse = async (dirPath) => {
    try {
      setImporting(true);
      setProgress({ status: 'Scanning directory...', percent: 10 });
      setError(null);
      
      console.log('Starting directory scan for path:', dirPath);
      console.log('FileScanner instance:', fileScanner.current);
      
      // Scan the directory for course content
      console.log('Calling scanCourseDirectory...');
      const courseData = await fileScanner.current.scanCourseDirectory(dirPath);
      console.log('Scan complete, course data:', courseData);
      
      if (!courseData || !courseData.sections || courseData.sections.length === 0) {
        console.error('No valid course content found');
        throw new Error('No valid course content found in the selected directory.');
      }
      
      setProgress({ status: 'Processing course structure...', percent: 50 });
      console.log('Processing course structure with sections:', courseData.sections.length);
      
      // Add the course to the database
      console.log('Adding course to database...');
      const courseId = await CourseManager.addCourse(courseData);
      console.log('Course added with ID:', courseId);
      
      // Get the full course details with the assigned ID
      const newCourse = await CourseManager.getCourseDetails(courseId);
      console.log('Retrieved course details:', newCourse);
      
      setProgress({ status: 'Course imported successfully!', percent: 100 });
      
      // Notify parent component
      if (onImportComplete) {
        onImportComplete(newCourse);
      }
      
      // Navigate to the course view
      setTimeout(() => {
        navigate(`/course/${courseId}`);
      }, 1500);
      
    } catch (error) {
      console.error('Failed to import course:', error);
      setError(`Failed to import course: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };
  
  return (
    <div className="import-container">
      <h1>Import Udemy Course</h1>
      
      <p className="import-instructions">
        Select a Udemy course folder or drag and drop it below.
        The folder should contain video files organized in sections.
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
            className={`drop-zone ${dragging ? 'dragging' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="drop-icon">📁</div>
            <p>Drag and drop a course folder here</p>
            <p className="drop-subtitle">or</p>
            <button 
              className="select-folder-btn"
              onClick={handleSelectFolder}
            >
              Select Folder
            </button>
          </div>
          
          <div className="import-tips">
            <h3>Tips for best results:</h3>
            <ul>
              <li>Choose the main course folder that contains all sections</li>
              <li>Make sure video files have extensions like .mp4, .mkv, or .webm</li>
              <li>Subtitle files should be in the same folder as their videos</li>
              <li>Folders are typically organized by sections and lectures</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default ImportCourse;