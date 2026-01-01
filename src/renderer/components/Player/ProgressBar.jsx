import React, { useRef, useState, useEffect } from "react";
import "./ModernVideoPlayer.css"; // We'll share the CSS for now

const ProgressBar = ({ currentTime, duration, onSeek, onSeekStart, onSeekEnd, buffered = 0 }) => {
  const progressBarRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverPosition, setHoverPosition] = useState(null);

  // Helper to calculate percentage and time from mouse event
  const calculatePosition = (e) => {
    if (!progressBarRef.current || !duration) return { percentage: 0, time: 0 };

    const rect = progressBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const time = percentage * duration;

    return { percentage, time };
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    const { time } = calculatePosition(e);
    if (onSeekStart) onSeekStart();
    onSeek(time);
  };

  const handleMouseMove = (e) => {
    const { percentage } = calculatePosition(e);
    setHoverPosition(percentage);

    if (isDragging) {
      const { time } = calculatePosition(e);
      onSeek(time);
    }
  };

  const handleMouseLeave = () => {
    setHoverPosition(null);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      if (onSeekEnd) onSeekEnd();
    }
  };

  // Global mouse up listeners to handle dragging outside component
  useEffect(() => {
    const handleGlobalMouseUp = (e) => {
      if (isDragging) {
        setIsDragging(false);
        const { time } = calculatePosition(e);
        // Ensure we commit the final seek position
        onSeek(time);
        if (onSeekEnd) onSeekEnd();
      }
    };

    const handleGlobalMouseMove = (e) => {
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
        {/* Buffered Bar (Optional feature for future) */}
        {/* <div className="progress-buffered" style={{ width: `${bufferPercentage}%` }} /> */}

        {/* Filled Progress */}
        <div className="progress-filled" style={{ width: `${progressPercentage}%` }} />

        {/* Thumb */}
        <div
          className="progress-thumb"
          style={{
            left: `${progressPercentage}%`,
            opacity: isDragging || hoverPosition !== null ? 1 : 0,
          }}
        />

        {/* Hover Effect - Ghost Thumb */}
        {hoverPosition !== null && !isDragging && (
          <div className="progress-hover-thumb" style={{ left: `${hoverPosition * 100}%` }} />
        )}
      </div>
    </div>
  );
};

export default ProgressBar;
