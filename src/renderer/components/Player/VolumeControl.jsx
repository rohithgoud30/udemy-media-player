import React, { useRef, useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faVolumeHigh,
  faVolumeLow,
  faVolumeOff,
  faVolumeXmark,
} from "@fortawesome/free-solid-svg-icons";

const VolumeControl = ({ volume, isMuted, onVolumeChange, onToggleMute }) => {
  const volumeBarRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateVolume = (e) => {
    if (!volumeBarRef.current) return 0;
    const rect = volumeBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return percentage;
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    const newVolume = calculateVolume(e);
    onVolumeChange(newVolume);
  };

  // Global listeners for dragging
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const newVolume = calculateVolume(e);
        onVolumeChange(newVolume);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, onVolumeChange]);

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return faVolumeXmark;
    if (volume < 0.3) return faVolumeOff;
    if (volume < 0.7) return faVolumeLow;
    return faVolumeHigh;
  };

  return (
    <>
      <button
        onClick={onToggleMute}
        className="control-btn"
        title={isMuted ? "Unmute (M)" : "Mute (M)"}
      >
        <FontAwesomeIcon icon={getVolumeIcon()} />
      </button>

      <div className="volume-container">
        <div
          ref={volumeBarRef}
          className={`volume-bar ${isDragging ? "dragging" : ""}`}
          onMouseDown={handleMouseDown}
        >
          <div className="volume-filled" style={{ width: `${(isMuted ? 0 : volume) * 100}%` }} />
          <div
            className="volume-thumb"
            style={{
              left: `${(isMuted ? 0 : volume) * 100}%`,
              opacity: isDragging ? 1 : undefined, // Let CSS handle hover opacity
            }}
          />
        </div>
      </div>
    </>
  );
};

export default VolumeControl;
