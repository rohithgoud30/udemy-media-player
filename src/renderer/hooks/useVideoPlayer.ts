import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { RefObject, SyntheticEvent } from "react";

export interface Options {
  defaultSpeed?: number;
}

export interface VideoEvents {
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onPlay: (e: SyntheticEvent<HTMLVideoElement>) => void;
  onPause: (e: SyntheticEvent<HTMLVideoElement>) => void;
  onVolumeChange: (e: SyntheticEvent<HTMLVideoElement>) => void;
  onRateChange: (e: SyntheticEvent<HTMLVideoElement>) => void;
}

export interface UseVideoPlayerReturn {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  togglePlay: () => void;
  seek: (time: number) => void;
  seekRelative: (seconds: number) => void;
  setVolume: (newVolume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  toggleFullscreen: (containerRef: RefObject<HTMLElement | null>) => void;
  videoEvents: VideoEvents;
}

export const useVideoPlayer = (
  videoRef: RefObject<HTMLVideoElement | null>,
  options: Options = {},
): UseVideoPlayerReturn => {
  // State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Previous volume for unmuting
  const previousVolume = useRef<number>(1);

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

  // Handle Seek
  const seek = useCallback(
    (time: number) => {
      if (videoRef.current) {
        const newTime = Math.max(0, Math.min(duration, time));
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    },
    [duration, videoRef],
  );

  const seekRelative = useCallback(
    (seconds: number) => {
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
    (newVolume: number) => {
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
    (rate: number) => {
      if (videoRef.current) {
        videoRef.current.playbackRate = rate;
        setPlaybackRate(rate);
      }
    },
    [videoRef],
  );

  // Handle Fullscreen
  const toggleFullscreen = useCallback(
    (containerRef: RefObject<HTMLElement | null>) => {
      if (!document.fullscreenElement) {
        if (containerRef?.current) {
          containerRef.current
            .requestFullscreen()
            .catch((e) => console.error("Fullscreen error:", e));
        } else if (videoRef.current) {
          videoRef.current
            .requestFullscreen()
            .catch((e) => console.error("Fullscreen error:", e));
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

  const onPlay = useCallback((_e: SyntheticEvent<HTMLVideoElement>) => setIsPlaying(true), []);
  const onPause = useCallback((_e: SyntheticEvent<HTMLVideoElement>) => setIsPlaying(false), []);
  const onVolumeChangeEvent = useCallback((e: SyntheticEvent<HTMLVideoElement>) => {
    const target = e.target as HTMLVideoElement;
    setVolume(target.volume);
    setIsMuted(target.muted);
  }, []);
  const onRateChangeEvent = useCallback((e: SyntheticEvent<HTMLVideoElement>) => {
    const target = e.target as HTMLVideoElement;
    setPlaybackRate(target.playbackRate);
  }, []);

  const videoEvents = useMemo<VideoEvents>(
    () => ({
      onTimeUpdate: handleTimeUpdate,
      onLoadedMetadata: handleLoadedMetadata,
      onPlay,
      onPause,
      onVolumeChange: onVolumeChangeEvent,
      onRateChange: onRateChangeEvent,
    }),
    [handleTimeUpdate, handleLoadedMetadata, onPlay, onPause, onVolumeChangeEvent, onRateChangeEvent],
  );

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
    seek,
    seekRelative,
    setVolume: handleVolumeChange,
    toggleMute,
    setPlaybackRate: handlePlaybackRateChange,
    toggleFullscreen,
    videoEvents,
  };
};
