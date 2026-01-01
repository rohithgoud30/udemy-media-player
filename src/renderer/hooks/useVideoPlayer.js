import { useState, useRef, useEffect, useCallback } from "react";

export const useVideoPlayer = (videoRef, options = {}) => {
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Previous volume for unmuting
  const previousVolume = useRef(1);

  // Initial setup
  useEffect(() => {
    if (options.defaultSpeed) {
      setPlaybackRate(options.defaultSpeed);
    }
  }, [options.defaultSpeed]);

  // Handle Play/Pause
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  }, [isPlaying, videoRef]);

  const setPlayState = useCallback(
    (playing) => {
      if (videoRef.current) {
        if (playing) {
          videoRef.current.play().catch((e) => console.warn("Play prevented:", e));
        } else {
          videoRef.current.pause();
        }
      }
    },
    [videoRef],
  );

  // Handle Seek
  const seek = useCallback(
    (time) => {
      if (videoRef.current) {
        const newTime = Math.max(0, Math.min(duration, time));
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    },
    [duration, videoRef],
  );

  const seekRelative = useCallback(
    (seconds) => {
      if (videoRef.current) {
        const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    },
    [currentTime, duration, videoRef],
  );

  // Handle Volume
  const handleVolumeChange = useCallback(
    (newVolume) => {
      if (videoRef.current) {
        const clampedVolume = Math.max(0, Math.min(1, newVolume));
        videoRef.current.volume = clampedVolume;
        setVolume(clampedVolume);

        if (clampedVolume > 0 && isMuted) {
          setIsMuted(false);
          videoRef.current.muted = false;
        } else if (clampedVolume === 0 && !isMuted) {
          setIsMuted(true);
          videoRef.current.muted = true;
        }
      }
    },
    [isMuted, videoRef],
  );

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      if (isMuted) {
        // Unmute
        const restoreVolume = previousVolume.current || 0.5;
        videoRef.current.volume = restoreVolume;
        videoRef.current.muted = false;
        setVolume(restoreVolume);
        setIsMuted(false);
      } else {
        // Mute
        previousVolume.current = volume;
        videoRef.current.volume = 0;
        videoRef.current.muted = true;
        setVolume(0);
        setIsMuted(true);
      }
    }
  }, [isMuted, volume, videoRef]);

  // Handle Playback Rate
  const handlePlaybackRateChange = useCallback(
    (rate) => {
      if (videoRef.current) {
        videoRef.current.playbackRate = rate;
        setPlaybackRate(rate);
      }
    },
    [videoRef],
  );

  // Handle Fullscreen
  const toggleFullscreen = useCallback(
    (containerRef) => {
      if (!document.fullscreenElement) {
        if (containerRef?.current) {
          containerRef.current
            .requestFullscreen()
            .catch((e) => console.error("Fullscreen error:", e));
        } else if (videoRef.current) {
          videoRef.current.requestFullscreen().catch((e) => console.error("Fullscreen error:", e));
        }
      } else {
        document.exitFullscreen();
      }
    },
    [videoRef],
  );

  // Event Listeners for Video Element
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, [videoRef]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      videoRef.current.playbackRate = playbackRate;
    }
  }, [videoRef, playbackRate]);

  const handleCreateEvents = useCallback(() => {
    return {
      onTimeUpdate: handleTimeUpdate,
      onLoadedMetadata: handleLoadedMetadata,
      onPlay: () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
      onVolumeChange: (e) => {
        setVolume(e.target.volume);
        setIsMuted(e.target.muted);
      },
      onRateChange: (e) => setPlaybackRate(e.target.playbackRate),
    };
  }, [handleTimeUpdate, handleLoadedMetadata]);

  // Sync fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackRate,
    isFullscreen,
    togglePlay,
    setPlayState,
    seek,
    seekRelative,
    setVolume: handleVolumeChange,
    toggleMute,
    setPlaybackRate: handlePlaybackRateChange,
    toggleFullscreen,
    videoEvents: handleCreateEvents(),
  };
};
