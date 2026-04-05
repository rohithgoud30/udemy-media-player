import React, { useRef, useState, useEffect } from "react";
import "./ModernVideoPlayer.css";

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  currentTime,
  duration,
  onSeek,
  onSeekStart,
  onSeekEnd,
}) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);

  const calculatePosition = (e: MouseEvent | React.MouseEvent): { percentage: number; time: number } => {
    if (!progressBarRef.current || !duration) return { percentage: 0, time: 0 };

    const rect = progressBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const time = percentage * duration;

    return { percentage, time };
  };

  const handleMouseDown = (e: React.MouseEvent): void => {
    setIsDragging(true);
    const { time } = calculatePosition(e);
    if (onSeekStart) onSeekStart();
    onSeek(time);
  };

  const handleMouseMove = (e: React.MouseEvent): void => {
    const { percentage } = calculatePosition(e);
    setHoverPosition(percentage);

    if (isDragging) {
      const { time } = calculatePosition(e);
      onSeek(time);
    }
  };

  const handleMouseLeave = (): void => {
    setHoverPosition(null);
  };

  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent): void => {
      if (isDragging) {
        setIsDragging(false);
        const { time } = calculatePosition(e);
        onSeek(time);
        if (onSeekEnd) onSeekEnd();
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent): void => {
      if (isDragging) {
        const { time } = calculatePosition(e);
        onSeek(time);
      }
    };

    if (isDragging) {
      document.addEventListener("mouseup", handleGlobalMouseUp);
      document.addEventListener("mousemove", handleGlobalMouseMove);
    }

    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp);
      document.removeEventListener("mousemove", handleGlobalMouseMove);
    };
  }, [isDragging, onSeek, onSeekEnd, duration]);

  const progressPercentage = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="progress-container">
      <div
        ref={progressBarRef}
        className={`video-progress-bar ${isDragging ? "dragging" : ""}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="progress-filled" style={{ width: `${progressPercentage}%` }} />

        <div
          className="progress-thumb"
          style={{
            left: `${progressPercentage}%`,
            opacity: isDragging || hoverPosition !== null ? 1 : 0,
          }}
        />

        {hoverPosition !== null && !isDragging && (
          <div className="progress-hover-thumb" style={{ left: `${hoverPosition * 100}%` }} />
        )}
      </div>
    </div>
  );
};

export default ProgressBar;
