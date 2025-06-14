import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "./ModernVideoPlayer.css";
import { CourseManager, ProgressManager } from "../../../js/database";
import db from "../../../js/database";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faPause,
  faVolumeHigh,
  faVolumeLow,
  faVolumeOff,
  faVolumeXmark,
  faExpand,
  faCompress,
  faStepBackward,
  faStepForward,
  faBackward,
  faForward,
} from "@fortawesome/free-solid-svg-icons";
import { faClosedCaptioning } from "@fortawesome/free-regular-svg-icons";

// Check if running in Electron or browser environment
const isElectron = () => {
  return window.electronAPI !== undefined;
};

// Helper for checking if a file exists
const checkFileExists = async (filePath) => {
  if (isElectron()) {
    return await window.electronAPI.checkFileExists(filePath);
  }
  return false;
};

// Helper to find lecture by ID directly from database
const findLecture = async (lectureId) => {
  try {
    console.log("Finding lecture with ID:", lectureId);
    const lecture = await db.lectures.get(parseInt(lectureId));
    console.log("Found lecture:", lecture);
    return lecture;
  } catch (error) {
    console.error("Error finding lecture:", error);
    return null;
  }
};

// Helper to create a URL for local video files
const createVideoUrl = (filePath) => {
  if (!filePath) return null;
  try {
    const normalizedPath = filePath.replace(/\\/g, "/");
    const fileUrl = `file://${normalizedPath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")}`;
    console.log("Created video URL:", fileUrl);
    return fileUrl;
  } catch (error) {
    console.error("Error creating video URL:", error);
    const normalizedPath = filePath.replace(/\\/g, "/");
    return `file://${encodeURI(normalizedPath)}`;
  }
};

// Format duration helper
const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Format time for display
const formatTime = (seconds) => {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes} ${minutes === 1 ? "min" : "mins"}`;
  } else {
    return `${hours} ${hours === 1 ? "hr" : "hrs"} ${minutes} ${
      minutes === 1 ? "min" : "mins"
    }`;
  }
};

// Convert SRT to WebVTT format
const convertSRTtoVTT = (srtContent) => {
  let vttContent = "WEBVTT\n\n";

  // Split by double newlines to separate subtitle blocks
  const blocks = srtContent.split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length >= 3) {
      // Skip the subtitle number (first line)
      const timeLine = lines[1];

      // Convert SRT time format to WebVTT (replace comma with dot)
      const vttTimeLine = timeLine.replace(/,/g, ".");

      // Get the subtitle text (remaining lines)
      const subtitleText = lines.slice(2).join("\n");

      vttContent += `${vttTimeLine}\n${subtitleText}\n\n`;
    }
  }

  return vttContent;
};

const ModernVideoPlayer = () => {
  const { lectureId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state || {};

  // Only log when lectureId actually changes, not on every render
  const prevLectureId = useRef(lectureId);
  if (prevLectureId.current !== lectureId) {
    console.log(
      `📍 ModernVideoPlayer lectureId changed: ${prevLectureId.current} → ${lectureId}`
    );
    prevLectureId.current = lectureId;
  }

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressBarRef = useRef(null);
  const volumeBarRef = useRef(null);
  const saveIntervalRef = useRef(null);

  const [lecture, setLecture] = useState(null);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nearbyLectures, setNearbyLectures] = useState([]);

  // Video state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [previousVolume, setPreviousVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [notification, setNotification] = useState(null);

  // Settings - these are always true now
  const [playerSettings, setPlayerSettings] = useState({
    defaultSpeed: 1.0,
    autoPlay: true,
    rememberPosition: true, // Always true
    autoMarkCompleted: true, // Always true
    autoPlayNext: true, // Always true
  });

  // Subtitle settings from global settings
  const [subtitleSettings, setSubtitleSettings] = useState({
    enabled: true,
    fontSize: "medium",
    fontColor: "white",
    backgroundColor: "black",
  });

  // Available playback speeds
  const playbackRates = [
    0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4,
  ];

  // Helper to show notifications
  const showNotification = (message, type = "info", duration = 5000) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), duration);
  };

  // Load player settings and subtitle settings
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem("udemyPlayerSettings");
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);

        // Load playback settings
        if (parsedSettings.playback) {
          const newPlayerSettings = {
            defaultSpeed: parsedSettings.playback.defaultSpeed || 1.0,
            autoPlay:
              parsedSettings.playback.autoPlay !== undefined
                ? parsedSettings.playback.autoPlay
                : true,
            rememberPosition: true, // Always true
            autoMarkCompleted: true, // Always true
            autoPlayNext: true, // Always true
          };

          setPlayerSettings(newPlayerSettings);

          // Also update current playback rate if video is already loaded
          if (videoRef.current && videoRef.current.readyState >= 1) {
            setPlaybackRate(newPlayerSettings.defaultSpeed);
            videoRef.current.playbackRate = newPlayerSettings.defaultSpeed;
            console.log(
              `🔄 Updated playback rate to: ${newPlayerSettings.defaultSpeed}x`
            );
          }
        }

        // Load subtitle settings
        if (parsedSettings.subtitles) {
          setSubtitleSettings({
            enabled:
              parsedSettings.subtitles.enabled !== undefined
                ? parsedSettings.subtitles.enabled
                : true,
            fontSize: parsedSettings.subtitles.fontSize || "medium",
            fontColor: parsedSettings.subtitles.fontColor || "white",
            backgroundColor:
              parsedSettings.subtitles.backgroundColor || "black",
          });
        }
      }
    } catch (error) {
      console.error("Error loading player settings:", error);
    }
  }, []);

  // Apply subtitle styling to video element
  useEffect(() => {
    if (videoRef.current) {
      const video = videoRef.current;

      // Apply custom CSS variables for subtitle styling
      const fontSize =
        {
          small: "0.9rem",
          medium: "1.1rem",
          large: "1.4rem",
          "x-large": "1.7rem",
        }[subtitleSettings.fontSize] || "1.1rem";

      const fontColor =
        {
          white: "#ffffff",
          yellow: "#ffff00",
          green: "#00ff00",
          red: "#ff0000",
          blue: "#0066ff",
          cyan: "#00ffff",
        }[subtitleSettings.fontColor] || "#ffffff";

      const backgroundColor =
        {
          black: "rgba(0, 0, 0, 0.85)",
          transparent: "transparent",
          "semi-transparent": "rgba(0, 0, 0, 0.5)",
          "dark-blue": "rgba(0, 30, 60, 0.85)",
          "dark-green": "rgba(0, 40, 20, 0.85)",
        }[subtitleSettings.backgroundColor] || "rgba(0, 0, 0, 0.85)";

      // Set CSS custom properties on the video container
      const container = containerRef.current;
      if (container) {
        container.style.setProperty("--subtitle-font-size", fontSize);
        container.style.setProperty("--subtitle-font-color", fontColor);
        container.style.setProperty(
          "--subtitle-background-color",
          backgroundColor
        );
      }
    }
  }, [subtitleSettings]);

  // Navigate to lecture function
  const navigateToLecture = useCallback(
    async (direction) => {
      if (!lecture || !lecture.courseId) {
        console.error("No lecture or courseId available for navigation");
        return;
      }

      try {
        const courseData =
          course || (await CourseManager.getCourseDetails(lecture.courseId));
        if (!courseData || !courseData.sections) {
          console.error("Could not load course data for navigation");
          return;
        }

        // Flatten all lectures
        let allLectures = [];
        courseData.sections.forEach((section) => {
          if (section.lectures) {
            allLectures.push(...section.lectures);
          }
        });

        // Sort lectures
        allLectures.sort((a, b) => {
          const sectionA = courseData.sections.find(
            (s) => s.id === a.sectionId
          );
          const sectionB = courseData.sections.find(
            (s) => s.id === b.sectionId
          );
          if (!sectionA || !sectionB) return 0;
          if (sectionA.index !== sectionB.index) {
            return sectionA.index - sectionB.index;
          }
          return a.index - b.index;
        });

        // Find current and target lecture
        const currentIndex = allLectures.findIndex((l) => l.id === lecture.id);
        if (currentIndex === -1) return;

        let targetIndex = currentIndex;
        if (direction === "next") {
          targetIndex = Math.min(currentIndex + 1, allLectures.length - 1);
        } else if (direction === "prev") {
          targetIndex = Math.max(currentIndex - 1, 0);
        }

        if (targetIndex === currentIndex) return;

        // Save progress before navigating
        if (videoRef.current) {
          await ProgressManager.saveProgress(
            lecture.id,
            videoRef.current.currentTime
          );
        }

        const targetLecture = allLectures[targetIndex];
        console.log(`Navigating to ${direction} lecture:`, targetLecture.title);

        // Always maintain fullscreen if currently in fullscreen - no user action needed
        const wasInFullscreen = !!document.fullscreenElement;

        setLoading(true);

        // Navigate to new lecture - always maintain fullscreen if active
        navigate(`/watch/${targetLecture.id}`, {
          state: {
            ...routeState,
            maintainFullscreen: wasInFullscreen,
          },
        });
      } catch (error) {
        console.error("Error navigating to lecture:", error);
        setLoading(false);
      }
    },
    [lecture, course, navigate, routeState]
  );

  // Load lecture data
  useEffect(() => {
    console.log(`🔄 useEffect triggered for lectureId: ${lectureId}`);
    async function loadLectureData() {
      try {
        setLoading(true);
        setError("");

        console.log(`🎬 Loading lecture data for ID: ${lectureId}`);

        // Early fullscreen request to prevent interruption during video loading
        if (
          routeState.maintainFullscreen &&
          containerRef.current &&
          !document.fullscreenElement
        ) {
          console.log(
            "🔍 Pre-emptively entering fullscreen before video loads"
          );
          try {
            await containerRef.current.requestFullscreen();
            console.log("✅ Successfully entered fullscreen");
          } catch (error) {
            console.warn("⚠️ Could not enter fullscreen:", error);
            showNotification(
              "Could not maintain fullscreen mode. Use F or fullscreen button to re-enable.",
              "warning",
              8000
            );
            // Update route state to reflect we couldn't maintain fullscreen
            navigate(location.pathname, {
              state: {
                ...routeState,
                maintainFullscreen: false,
              },
              replace: true,
            });
          }
        }

        // Reset video state when switching lectures
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
        setSubtitlesEnabled(false);

        const lectureData = await findLecture(parseInt(lectureId));
        console.log(`📚 Found lecture data:`, lectureData);

        // Override filePath and videoUrl if provided via route state
        if (routeState.filePath) {
          lectureData.filePath = routeState.filePath;
        }
        if (routeState.videoUrl) {
          lectureData.videoUrl = routeState.videoUrl;
        }

        if (!lectureData) {
          setError(`Lecture with ID ${lectureId} not found`);
          return;
        }

        // Save as last played lecture
        if (lectureData.courseId) {
          await ProgressManager.saveLastPlayedLecture(
            lectureData.courseId,
            lectureData.id
          );
        }

        if (!lectureData.filePath) {
          setError(`No file path found for lecture ${lectureId}`);
          return;
        }

        // Load progress
        const progress = await ProgressManager.getLectureProgress(
          lectureData.id
        );
        let savedPos = 0;

        if (progress.watched === 1 && routeState.startPosition === undefined) {
          savedPos = 0;
        } else if (routeState.startPosition !== undefined) {
          savedPos = routeState.startPosition;
        } else if (progress.position > 0 && progress.watched !== 1) {
          savedPos = progress.position;
        }

        const videoUrl =
          routeState.videoUrl || createVideoUrl(lectureData.filePath);
        const lectureWithProgress = {
          ...lectureData,
          videoUrl: videoUrl,
          savedProgress: savedPos,
          completed: progress.watched === 1,
        };

        console.log(`🎥 Setting video URL: ${videoUrl}`);
        setLecture(lectureWithProgress);

        // Load course data
        const courseData = await CourseManager.getCourseDetails(
          lectureData.courseId
        );
        setCourse(courseData);

        // Load nearby lectures
        if (courseData && courseData.sections) {
          const allLectures = [];
          courseData.sections.forEach((section) => {
            if (section.lectures) {
              allLectures.push(
                ...section.lectures.map((lecture) => ({
                  ...lecture,
                  sectionTitle: section.title,
                }))
              );
            }
          });

          allLectures.sort((a, b) => {
            const sectionA = courseData.sections.find(
              (s) => s.id === a.sectionId
            );
            const sectionB = courseData.sections.find(
              (s) => s.id === b.sectionId
            );
            if (!sectionA || !sectionB) return 0;
            if (sectionA.index !== sectionB.index) {
              return sectionA.index - sectionB.index;
            }
            return a.index - b.index;
          });

          const currentIndex = allLectures.findIndex(
            (l) => l.id === parseInt(lectureId)
          );
          const startIndex = Math.max(0, currentIndex - 3);
          const endIndex = Math.min(allLectures.length - 1, currentIndex + 3);
          const nearby = allLectures.slice(startIndex, endIndex + 1);
          setNearbyLectures(nearby);
        }

        // Check if running in browser mode
        if (!isElectron()) {
          setError("This app requires Electron to play local videos");
          return;
        }

        // Check file exists
        const fileExists = await checkFileExists(lectureData.filePath);
        if (!fileExists) {
          setError(`Video file does not exist: ${lectureData.filePath}`);
          return;
        }
      } catch (error) {
        console.error("Error loading lecture data:", error);
        setError("Failed to load lecture");
      } finally {
        setLoading(false);
      }
    }

    loadLectureData();
  }, [lectureId]);

  // Handle video source changes
  useEffect(() => {
    console.log(`🔄 Video URL changed: ${lecture?.videoUrl}`);
    console.log(`📺 Video ref exists: ${!!videoRef.current}`);

    if (lecture?.videoUrl) {
      // Small delay to ensure video element is mounted
      setTimeout(() => {
        if (videoRef.current) {
          console.log("🎬 Loading new video source:", lecture.videoUrl);
          videoRef.current.src = lecture.videoUrl; // Explicitly set src
          videoRef.current.load(); // Force reload
          videoRef.current.currentTime = 0; // Reset position
        } else {
          console.log("❌ Video ref still null after timeout");
        }
      }, 100);
    }
  }, [lecture?.videoUrl]);

  // Video event handlers
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      console.log(`✅ Video loaded: ${videoRef.current.src}`);
      console.log(`⏱️ Duration: ${videoRef.current.duration}s`);

      setDuration(videoRef.current.duration);

      // Set playback rate from settings and update state
      const savedSpeed = playerSettings.defaultSpeed;
      setPlaybackRate(savedSpeed);
      videoRef.current.playbackRate = savedSpeed;
      console.log(`🎯 Set playback rate to: ${savedSpeed}x`);

      // Set saved position
      if (playerSettings.rememberPosition && lecture?.savedProgress > 0) {
        videoRef.current.currentTime = lecture.savedProgress;
      }

      // Auto-play if setting is enabled
      if (playerSettings.autoPlay) {
        console.log(`🎬 Auto-playing video based on setting`);
        videoRef.current.play().catch((error) => {
          console.warn("Auto-play was prevented by browser:", error);
        });
      }

      // Setup subtitles after video metadata is loaded
      setupSubtitlesForVideo();
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const dur = videoRef.current.duration;

      setCurrentTime(current);

      // Auto-mark as completed at 98%
      if (
        playerSettings.autoMarkCompleted &&
        dur > 0 &&
        current > dur * 0.98 &&
        !lecture?.completed
      ) {
        markAsCompleted();
      }
    }
  };

  const handleEnded = async () => {
    if (playerSettings.autoMarkCompleted && !lecture?.completed) {
      await markAsCompleted();
    }

    if (playerSettings.autoPlayNext) {
      navigateToLecture("next");
    }
  };

  const markAsCompleted = async () => {
    if (lecture) {
      await ProgressManager.saveProgress(lecture.id, 0, true);
      setLecture({ ...lecture, completed: true, savedProgress: 0 });
    }
  };

  // Control handlers
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  // Progress control helper function
  const updateProgress = (e) => {
    if (videoRef.current && progressBarRef.current && duration > 0) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const pos = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width)
      );
      const newTime = pos * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Progress bar click handler
  const handleProgressClick = (e) => {
    updateProgress(e);
  };

  // Progress bar mouse down (start dragging)
  const handleProgressMouseDown = (e) => {
    setIsDraggingProgress(true);
    updateProgress(e);
    e.preventDefault();
  };

  // Progress bar mouse move (dragging)
  const handleProgressMouseMove = (e) => {
    if (isDraggingProgress) {
      updateProgress(e);
    }
  };

  // Progress bar mouse up (stop dragging)
  const handleProgressMouseUp = () => {
    setIsDraggingProgress(false);
  };

  // Volume control helper function
  const updateVolume = (e) => {
    if (videoRef.current && volumeBarRef.current) {
      const rect = volumeBarRef.current.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const newVolume = Math.max(0, Math.min(1, pos));
      setVolume(newVolume);

      if (newVolume > 0) {
        setIsMuted(false);
        setPreviousVolume(newVolume);
        videoRef.current.muted = false;
      } else {
        setIsMuted(true);
        videoRef.current.muted = true;
      }

      videoRef.current.volume = newVolume;
    }
  };

  // Volume bar click handler
  const handleVolumeClick = (e) => {
    updateVolume(e);
  };

  // Volume bar mouse down (start dragging)
  const handleVolumeMouseDown = (e) => {
    setIsDraggingVolume(true);
    updateVolume(e);
    e.preventDefault();
  };

  // Volume bar mouse move (dragging)
  const handleVolumeMouseMove = (e) => {
    if (isDraggingVolume) {
      updateVolume(e);
    }
  };

  // Volume bar mouse up (stop dragging)
  const handleVolumeMouseUp = () => {
    setIsDraggingVolume(false);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        // Unmute: restore to previous volume
        const restoreVolume = previousVolume > 0 ? previousVolume : 0.5;
        setIsMuted(false);
        setVolume(restoreVolume);
        videoRef.current.muted = false;
        videoRef.current.volume = restoreVolume;
      } else {
        // Mute: remember current volume and mute
        setPreviousVolume(volume);
        setIsMuted(true);
        videoRef.current.muted = true;
        videoRef.current.volume = 0;
      }
    }
  };

  const changePlaybackRate = (rate) => {
    if (videoRef.current) {
      setPlaybackRate(rate);
      videoRef.current.playbackRate = rate;

      console.log(`⚡ Playback rate changed to: ${rate}x`);

      // Update player settings state immediately
      const newPlayerSettings = {
        ...playerSettings,
        defaultSpeed: rate,
        rememberPosition: true, // Always true
        autoMarkCompleted: true, // Always true
        autoPlayNext: true, // Always true
      };
      setPlayerSettings(newPlayerSettings);

      // Save to localStorage immediately
      try {
        const settings = JSON.parse(
          localStorage.getItem("udemyPlayerSettings") || "{}"
        );
        settings.playback = settings.playback || {};
        settings.playback.defaultSpeed = rate;
        // Force these to always be true
        settings.playback.rememberPosition = true;
        settings.playback.autoMarkCompleted = true;
        settings.playback.autoPlayNext = true;
        localStorage.setItem("udemyPlayerSettings", JSON.stringify(settings));
        console.log(`💾 Saved playback speed: ${rate}x to localStorage`);
      } catch (err) {
        console.error("Error saving playback speed:", err);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      // Use the container instead of just the video element
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const seek = (seconds) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const setupSubtitlesForVideo = async () => {
    if (!lecture?.filePath || !videoRef.current || !isElectron()) {
      return;
    }

    try {
      console.log("🎬 Setting up subtitles for:", lecture.filePath);
      const video = videoRef.current;

      // Check if video is ready
      if (video.readyState < 1) {
        console.log("⏳ Video not ready yet, waiting...");
        return;
      }

      const srtFilePath = await window.electronAPI.getSrtFilePath(
        lecture.filePath
      );
      const srtExists = await checkFileExists(srtFilePath);

      console.log("📁 SRT file path:", srtFilePath);
      console.log("✅ SRT file exists:", srtExists);

      if (!srtExists) {
        console.warn("❌ No subtitle file found");
        return;
      }

      // Clear existing tracks
      const existingTracks = video.querySelectorAll("track");
      existingTracks.forEach((track) => {
        console.log("🗑️ Removing existing track");
        track.remove();
      });

      // Read and convert SRT content
      const srtContent = await window.electronAPI.readSrtFile(srtFilePath);
      if (!srtContent) {
        console.error("❌ Failed to read SRT content");
        return;
      }

      console.log("📄 Read SRT content, length:", srtContent.length);

      // Convert SRT to WebVTT
      const vttContent = convertSRTtoVTT(srtContent);
      const blob = new Blob([vttContent], { type: "text/vtt" });
      const subtitleUrl = URL.createObjectURL(blob);

      console.log("🔗 Created subtitle blob URL:", subtitleUrl);

      // Create and add track element
      const track = document.createElement("track");
      track.kind = "subtitles";
      track.label = "English";
      track.srclang = "en";
      track.src = subtitleUrl;
      track.default = true;

      video.appendChild(track);
      console.log("➕ Track element added to video");

      // Set up event listeners
      track.addEventListener("load", () => {
        console.log("🎯 Subtitle track loaded successfully!");
        console.log("📊 Total text tracks:", video.textTracks.length);

        // Enable subtitles based on settings
        if (video.textTracks.length > 0) {
          const textTrack = video.textTracks[0];
          if (subtitleSettings.enabled) {
            textTrack.mode = "showing";
            setSubtitlesEnabled(true);
            console.log("👁️ Subtitles enabled and visible (from settings)");
          } else {
            textTrack.mode = "hidden";
            setSubtitlesEnabled(false);
            console.log("👁️‍🗨️ Subtitles disabled (from settings)");
          }
        }
      });

      track.addEventListener("error", (error) => {
        console.error("❌ Subtitle track error:", error);
      });
    } catch (error) {
      console.error("💥 Error setting up subtitles:", error);
    }
  };

  const toggleSubtitles = () => {
    if (videoRef.current) {
      const tracks = videoRef.current.textTracks;
      console.log("🔄 Toggle subtitles - found tracks:", tracks.length);

      let foundSubtitleTrack = false;

      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        console.log(`📝 Track ${i}:`, track.kind, track.mode);

        if (track.kind === "subtitles") {
          foundSubtitleTrack = true;
          if (track.mode === "showing") {
            track.mode = "hidden";
            setSubtitlesEnabled(false);

            // Update settings
            const settings = JSON.parse(
              localStorage.getItem("udemyPlayerSettings") || "{}"
            );
            settings.subtitles = settings.subtitles || {};
            settings.subtitles.enabled = false;
            localStorage.setItem(
              "udemyPlayerSettings",
              JSON.stringify(settings)
            );
            setSubtitleSettings((prev) => ({ ...prev, enabled: false }));

            console.log("👁️‍🗨️ Subtitles hidden");
          } else {
            track.mode = "showing";
            setSubtitlesEnabled(true);

            // Update settings
            const settings = JSON.parse(
              localStorage.getItem("udemyPlayerSettings") || "{}"
            );
            settings.subtitles = settings.subtitles || {};
            settings.subtitles.enabled = true;
            localStorage.setItem(
              "udemyPlayerSettings",
              JSON.stringify(settings)
            );
            setSubtitleSettings((prev) => ({ ...prev, enabled: true }));

            console.log("👁️ Subtitles shown");
          }
          break;
        }
      }

      if (!foundSubtitleTrack) {
        console.warn("⚠️ No subtitle tracks found to toggle");
        console.log(
          "🔍 Available tracks:",
          Array.from(tracks).map((t) => ({ kind: t.kind, mode: t.mode }))
        );
      }
    }
  };

  // Progress saving
  useEffect(() => {
    if (lecture && videoRef.current) {
      saveIntervalRef.current = setInterval(() => {
        if (videoRef.current && !isPlaying) return;

        const current = videoRef.current.currentTime;
        if (lecture.completed) {
          ProgressManager.saveProgress(lecture.id, 0, true);
        } else {
          ProgressManager.saveProgress(lecture.id, current);
        }
      }, 5000);

      return () => {
        if (saveIntervalRef.current) {
          clearInterval(saveIntervalRef.current);
        }
      };
    }
  }, [lecture, isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seek(-5);
          break;
        case "ArrowRight":
          e.preventDefault();
          seek(5);
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case ",":
          e.preventDefault();
          navigateToLecture("prev");
          break;
        case ".":
          e.preventDefault();
          navigateToLecture("next");
          break;
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "c":
          e.preventDefault();
          toggleSubtitles();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigateToLecture]);

  // Fullscreen change detection with improved persistence
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);

      // If fullscreen was unexpectedly exited while we want to maintain it,
      // log this but don't try to auto-restore (browser security prevents it)
      if (
        !isCurrentlyFullscreen &&
        routeState.maintainFullscreen &&
        containerRef.current
      ) {
        console.log("⚠️ Fullscreen unexpectedly exited during navigation");
        console.log(
          "💡 User will need to manually re-enable fullscreen if desired"
        );

        // Show notification to inform user
        showNotification(
          "Fullscreen exited. Press F or click fullscreen button to re-enable.",
          "info",
          6000
        );
        setShowControls(true);

        // Clear the maintainFullscreen flag since we can't auto-restore
        // The user can manually toggle fullscreen again if they want
        setTimeout(() => {
          navigate(location.pathname, {
            state: {
              ...routeState,
              maintainFullscreen: false,
            },
            replace: true,
          });
        }, 100);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange
      );
    };
  }, [routeState.maintainFullscreen, navigate, location.pathname]);

  // Auto-hide controls
  useEffect(() => {
    let hideTimeout;

    const showControlsTemp = () => {
      setShowControls(true);
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 30000); // Hide after 30 seconds of no mouse activity
    };

    const handleMouseMove = () => showControlsTemp();
    const handleMouseEnter = () => showControlsTemp();
    const handleMouseLeave = () => {
      // Don't auto-hide on mouse leave, only on timeout
      if (!isPlaying) {
        setShowControls(true); // Keep controls visible if video is paused
      }
    };

    if (containerRef.current) {
      const container = containerRef.current;
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseenter", handleMouseEnter);
      container.addEventListener("mouseleave", handleMouseLeave);
    }

    // Always show controls when video is paused
    if (!isPlaying) {
      setShowControls(true);
      clearTimeout(hideTimeout);
    }

    return () => {
      clearTimeout(hideTimeout);
      if (containerRef.current) {
        const container = containerRef.current;
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("mouseenter", handleMouseEnter);
        container.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, [isPlaying]);

  // Handle volume dragging globally
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isDraggingVolume) {
        handleVolumeMouseMove(e);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDraggingVolume) {
        handleVolumeMouseUp();
      }
    };

    if (isDraggingVolume) {
      document.addEventListener("mousemove", handleGlobalMouseMove);
      document.addEventListener("mouseup", handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDraggingVolume]);

  // Handle progress dragging globally
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isDraggingProgress) {
        handleProgressMouseMove(e);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDraggingProgress) {
        handleProgressMouseUp();
      }
    };

    if (isDraggingProgress) {
      document.addEventListener("mousemove", handleGlobalMouseMove);
      document.addEventListener("mouseup", handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDraggingProgress]);

  // Render mini lecture item
  const renderMiniLectureItem = (miniLecture) => {
    const isActive = miniLecture.id === parseInt(lectureId);
    const isCompleted = miniLecture.completed;

    const handleMiniLectureClick = () => {
      // Always maintain fullscreen if currently in fullscreen
      const wasInFullscreen = !!document.fullscreenElement;

      navigate(`/watch/${miniLecture.id}`, {
        state: {
          ...routeState,
          maintainFullscreen: wasInFullscreen,
        },
      });
    };

    return (
      <div
        key={miniLecture.id}
        className={`mini-lecture-item ${isActive ? "active" : ""} ${
          isCompleted ? "completed" : ""
        }`}
        onClick={handleMiniLectureClick}
      >
        <div className="mini-lecture-status">
          {isActive ? "▶" : isCompleted ? "✓" : "○"}
        </div>
        <div className="mini-lecture-info">
          <div className="mini-lecture-title" title={miniLecture.title}>
            {miniLecture.title}
          </div>
          <div className="mini-lecture-section">
            {miniLecture.sectionTitle}
            {miniLecture.duration > 0 && (
              <span className="mini-lecture-duration">
                {formatTime(miniLecture.duration)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    // If we're maintaining fullscreen, show a minimal loading state
    if (routeState.maintainFullscreen) {
      return (
        <div className="modern-video-player-container">
          <div className="modern-video-container" ref={containerRef}>
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                color: "white",
                fontSize: "18px",
                background: "rgba(0,0,0,0.8)",
                padding: "16px 32px",
                borderRadius: "12px",
                textAlign: "center",
                boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              }}
            >
              <div>Loading next video...</div>
              <div style={{ fontSize: "14px", marginTop: "8px", opacity: 0.8 }}>
                Staying in fullscreen
              </div>
            </div>
          </div>
        </div>
      );
    }
    return <div className="loading">Loading video...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        {lecture && lecture.filePath && (
          <>
            <p>
              <b>Video file path:</b> {lecture.filePath}
            </p>
            {lecture.videoUrl && (
              <p>
                <b>Video URL:</b> {lecture.videoUrl}
              </p>
            )}
          </>
        )}
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="modern-video-player-container">
      {/* Video Player */}
      <div className="modern-video-container" ref={containerRef}>
        <video
          ref={videoRef}
          key={lectureId} // Force reload when lectureId changes
          src={lecture?.videoUrl}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onClick={togglePlay}
          crossOrigin="anonymous"
          controls={false}
          playsInline
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
        />

        {/* Custom Controls */}
        <div className={`video-controls ${showControls ? "visible" : ""}`}>
          {/* Progress Bar */}
          <div className="progress-container">
            <div
              ref={progressBarRef}
              className={`progress-bar ${isDraggingProgress ? "dragging" : ""}`}
              onClick={handleProgressClick}
              onMouseDown={handleProgressMouseDown}
              style={{ cursor: isDraggingProgress ? "grabbing" : "pointer" }}
            >
              <div
                className="progress-filled"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              <div
                className="progress-thumb"
                style={{
                  left: `${(currentTime / duration) * 100}%`,
                  opacity: isDraggingProgress ? 1 : 0,
                }}
              />
            </div>
          </div>

          {/* Control Buttons */}
          <div className="controls-row">
            <div className="controls-left">
              <button onClick={togglePlay} className="control-btn">
                <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
              </button>

              <button
                onClick={() => navigateToLecture("prev")}
                className="control-btn navigation-btn"
                title="Previous Lecture"
              >
                <FontAwesomeIcon icon={faStepBackward} />
              </button>

              <button
                onClick={() => seek(-5)}
                className="control-btn seek-btn"
                title="Seek Back 5s (Left Arrow)"
              >
                <FontAwesomeIcon icon={faBackward} />
              </button>

              <button
                onClick={() => seek(5)}
                className="control-btn seek-btn"
                title="Seek Forward 5s (Right Arrow)"
              >
                <FontAwesomeIcon icon={faForward} />
              </button>

              <button
                onClick={() => navigateToLecture("next")}
                className="control-btn navigation-btn"
                title="Next Lecture"
              >
                <FontAwesomeIcon icon={faStepForward} />
              </button>

              <button
                onClick={toggleMute}
                className="control-btn"
                title={isMuted ? "Unmute (M)" : "Mute (M)"}
              >
                <FontAwesomeIcon
                  icon={
                    isMuted || volume === 0
                      ? faVolumeXmark
                      : volume < 0.3
                      ? faVolumeOff
                      : volume < 0.7
                      ? faVolumeLow
                      : faVolumeHigh
                  }
                />
              </button>

              <div className="volume-container">
                <div
                  ref={volumeBarRef}
                  className={`volume-bar ${isDraggingVolume ? "dragging" : ""}`}
                  onClick={handleVolumeClick}
                  onMouseDown={handleVolumeMouseDown}
                  style={{ cursor: isDraggingVolume ? "grabbing" : "pointer" }}
                >
                  <div
                    className="volume-filled"
                    style={{ width: `${volume * 100}%` }}
                  />
                  <div
                    className="volume-thumb"
                    style={{
                      left: `${volume * 100}%`,
                      opacity: isDraggingVolume ? 1 : 0,
                    }}
                  />
                </div>
              </div>

              <span className="time-display">
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </span>
            </div>

            <div className="controls-right">
              <button
                onClick={toggleSubtitles}
                className={`control-btn subtitle-btn ${
                  subtitlesEnabled ? "active" : ""
                }`}
                title={
                  subtitlesEnabled ? "Hide Subtitles (C)" : "Show Subtitles (C)"
                }
              >
                <FontAwesomeIcon icon={faClosedCaptioning} />
              </button>

              <select
                value={playbackRate}
                onChange={(e) => changePlaybackRate(parseFloat(e.target.value))}
                className="speed-select"
              >
                {playbackRates.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}x
                  </option>
                ))}
              </select>

              <button
                onClick={toggleFullscreen}
                className="control-btn"
                title="Fullscreen (F)"
              >
                <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Below Video */}
      <div className="player-content">
        <div className="player-header-collapsed">
          {lecture && (
            <>
              <h1 className="lecture-title-top" title={lecture.title}>
                {lecture.title}
              </h1>
              {course && (
                <div className="course-header-row">
                  <div className="course-title" title={course.title}>
                    <strong>Course:</strong> {course.title}
                  </div>
                  <button
                    className="back-to-course-btn"
                    onClick={() => navigate(`/course/${lecture.courseId}`)}
                  >
                    ← Back to Course
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="player-body">
          <div className="video-info">
            <div className="video-info-section">
              <h3>Lecture Status</h3>
              {lecture && (
                <>
                  <div className="video-progress-info">
                    {lecture.completed ? (
                      <span className="completion-status completed">
                        <span className="status-icon">✓</span> Completed
                      </span>
                    ) : lecture.savedProgress && lecture.savedProgress > 0 ? (
                      <span className="completion-status in-progress">
                        <span className="status-icon">▶</span> In Progress
                      </span>
                    ) : (
                      <span className="completion-status not-started">
                        <span className="status-icon">○</span> Not Started
                      </span>
                    )}
                  </div>

                  <div className="lecture-action-buttons">
                    <button
                      className={`mark-complete-button ${
                        lecture.completed ? "completed" : ""
                      }`}
                      onClick={async () => {
                        if (!lecture.completed) {
                          await ProgressManager.saveProgress(
                            lecture.id,
                            0,
                            true
                          );
                          if (videoRef.current) {
                            videoRef.current.currentTime = 0;
                          }
                          setLecture({
                            ...lecture,
                            completed: true,
                            savedProgress: 0,
                          });
                        } else {
                          const currentPos = videoRef.current?.currentTime || 0;
                          await ProgressManager.saveProgress(
                            lecture.id,
                            currentPos,
                            false
                          );
                          setLecture({
                            ...lecture,
                            completed: false,
                            savedProgress: currentPos,
                          });
                        }
                      }}
                    >
                      {lecture.completed
                        ? "Mark as Incomplete"
                        : "Mark as Completed"}
                    </button>

                    {(!lecture.completed || lecture.savedProgress > 0) && (
                      <button
                        className="reset-position-button"
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = 0;
                            ProgressManager.saveProgress(
                              lecture.id,
                              0,
                              lecture.completed
                            );
                            videoRef.current.play();
                          }
                        }}
                      >
                        Reset to Beginning
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="video-info-section">
              <h3>Details</h3>
              {lecture && (
                <>
                  <p title={lecture.title}>
                    <strong>Lecture:</strong> {lecture.title}
                  </p>
                  {course && (
                    <p title={course.title}>
                      <strong>Course:</strong> {course.title}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mini-course-view">
            <h3 className="mini-course-title">Course Contents</h3>
            <div className="mini-lectures-list">
              {nearbyLectures.map(renderMiniLectureItem)}
            </div>
          </div>
        </div>

        <div className="keyboard-shortcuts">
          <h3>Navigation</h3>
          <div className="keyboard-shortcuts-grid">
            <div>
              <strong>Space/K</strong> - Play/Pause
            </div>
            <div>
              <strong>←/→</strong> - Seek 5s
            </div>
            <div>
              <strong>F</strong> - Fullscreen
            </div>
            <div>
              <strong>,/.</strong> - Previous/Next
            </div>
            <div>
              <strong>M</strong> - Mute/Unmute
            </div>
            <div>
              <strong>C</strong> - Toggle Subtitles
            </div>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          <div className="notification-content">{notification.message}</div>
        </div>
      )}
    </div>
  );
};

export default ModernVideoPlayer;
