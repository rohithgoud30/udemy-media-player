import { useState, useEffect, useCallback } from "react";
import { checkFileExists } from "../utils/formatters";

// Helper to convert SRT to WebVTT format
const convertSRTtoVTT = (srtContent: string): string => {
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

export const useSubtitles = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
  filePath: string | undefined
): {
  subtitlesEnabled: boolean;
  subtitleSettings: SubtitleSettings;
  toggleSubtitles: () => void;
} => {
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(false);
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>({
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
    let blobUrl: string | null = null;

    const setupSubtitles = async (): Promise<void> => {
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
        blobUrl = URL.createObjectURL(blob);

        const track = document.createElement("track");
        track.kind = "subtitles";
        track.label = "English";
        track.srclang = "en";
        track.src = blobUrl;
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

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [filePath, videoRef]);

  // Toggle function
  const toggleSubtitles = useCallback((): void => {
    if (videoRef.current && videoRef.current.textTracks.length > 0) {
      const track = videoRef.current.textTracks[0];
      const newMode: TextTrackMode = track.mode === "showing" ? "hidden" : "showing";
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
