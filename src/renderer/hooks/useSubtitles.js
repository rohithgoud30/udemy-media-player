import { useState, useEffect, useCallback } from "react";

// Helper to convert SRT to WebVTT format
const convertSRTtoVTT = (srtContent) => {
  let vttContent = "WEBVTT\n\n";
  const blocks = srtContent.split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length >= 3) {
      const timeLine = lines[1];
      const vttTimeLine = timeLine.replace(/,/g, ".");
      const subtitleText = lines.slice(2).join("\n");
      vttContent += `${vttTimeLine}\n${subtitleText}\n\n`;
    }
  }
  return vttContent;
};

const checkFileExists = async (filePath) => {
  if (window.electronAPI) {
    return await window.electronAPI.checkFileExists(filePath);
  }
  return false;
};

export const useSubtitles = (videoRef, filePath) => {
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [subtitleSettings, setSubtitleSettings] = useState({
    enabled: true,
    fontSize: "medium",
    fontColor: "white",
    backgroundColor: "black",
  });

  // Load settings
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem("udemyPlayerSettings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.subtitles) {
          setSubtitleSettings({
            enabled: parsed.subtitles.enabled ?? true,
            fontSize: parsed.subtitles.fontSize || "medium",
            fontColor: parsed.subtitles.fontColor || "white",
            backgroundColor: parsed.subtitles.backgroundColor || "black",
          });
        }
      }
    } catch (error) {
      console.error("Error loading subtitle settings:", error);
    }
  }, []);

  // Setup subtitles
  useEffect(() => {
    const setupSubtitles = async () => {
      if (!filePath || !videoRef.current || !window.electronAPI) return;

      try {
        const video = videoRef.current;
        const srtFilePath = await window.electronAPI.getSrtFilePath(filePath);
        const srtExists = await checkFileExists(srtFilePath);

        if (!srtExists) return;

        // Clear existing tracks
        const existingTracks = video.querySelectorAll("track");
        existingTracks.forEach((track) => track.remove());

        // Read and convert
        const srtContent = await window.electronAPI.readSrtFile(srtFilePath);
        if (!srtContent) return;

        const vttContent = convertSRTtoVTT(srtContent);
        const blob = new Blob([vttContent], { type: "text/vtt" });
        const subtitleUrl = URL.createObjectURL(blob);

        const track = document.createElement("track");
        track.kind = "subtitles";
        track.label = "English";
        track.srclang = "en";
        track.src = subtitleUrl;
        track.default = true;

        video.appendChild(track);

        track.addEventListener("load", () => {
          if (video.textTracks.length > 0) {
            const textTrack = video.textTracks[0];
            textTrack.mode = subtitleSettings.enabled ? "showing" : "hidden";
            setSubtitlesEnabled(subtitleSettings.enabled);
          }
        });
      } catch (error) {
        console.error("Error setting up subtitles:", error);
      }
    };

    setupSubtitles();
  }, [filePath, videoRef, subtitleSettings.enabled]);

  // Toggle function
  const toggleSubtitles = useCallback(() => {
    if (videoRef.current && videoRef.current.textTracks.length > 0) {
      const track = videoRef.current.textTracks[0];
      const newMode = track.mode === "showing" ? "hidden" : "showing";
      track.mode = newMode;
      const isEnabled = newMode === "showing";
      setSubtitlesEnabled(isEnabled);

      // Save setting
      try {
        const settings = JSON.parse(localStorage.getItem("udemyPlayerSettings") || "{}");
        settings.subtitles = { ...settings.subtitles, enabled: isEnabled };
        localStorage.setItem("udemyPlayerSettings", JSON.stringify(settings));
        setSubtitleSettings((prev) => ({ ...prev, enabled: isEnabled }));
      } catch (e) {
        console.error("Error saving subtitle settings:", e);
      }
    }
  }, [videoRef]);

  return {
    subtitlesEnabled,
    subtitleSettings,
    toggleSubtitles,
  };
};
