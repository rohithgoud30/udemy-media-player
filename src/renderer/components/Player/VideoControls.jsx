import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faPause,
  faExpand,
  faCompress,
  faStepBackward,
  faStepForward,
  faBackward,
  faForward,
} from "@fortawesome/free-solid-svg-icons";
import { faClosedCaptioning } from "@fortawesome/free-regular-svg-icons";
import ProgressBar from "./ProgressBar";
import VolumeControl from "./VolumeControl";
import { formatDuration } from "../../utils/formatters";

const VideoControls = ({
  // Playback State
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playbackRate,
  isFullscreen,
  subtitlesEnabled,

  // Handlers
  onPlayPause,
  onSeek,
  onSeekStart,
  onSeekEnd,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  onToggleSubtitles,
  onPlaybackRateChange,
  onNextLecture,
  onPrevLecture,
  onSeekRelative,

  // Visibility
  visible = true,
}) => {
  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4];

  return (
    <div className={`video-controls ${visible ? "visible" : ""}`}>
      {/* Progress Bar */}
      <ProgressBar
        currentTime={currentTime}
        duration={duration}
        onSeek={onSeek}
        onSeekStart={onSeekStart}
        onSeekEnd={onSeekEnd}
      />

      {/* Control Buttons Row */}
      <div className="controls-row">
        <div className="controls-left">
          {/* Play/Pause */}
          <button onClick={onPlayPause} className="control-btn" title="Play/Pause (Space)">
            <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
          </button>

          {/* Navigation */}
          <button
            onClick={onPrevLecture}
            className="control-btn navigation-btn"
            title="Previous Lecture (,)"
          >
            <FontAwesomeIcon icon={faStepBackward} />
          </button>

          {/* Seek Buttons */}
          <button
            onClick={() => onSeekRelative(-5)}
            className="control-btn seek-btn"
            title="Seek Back 5s (Left Arrow)"
          >
            <FontAwesomeIcon icon={faBackward} />
          </button>

          <button
            onClick={() => onSeekRelative(5)}
            className="control-btn seek-btn"
            title="Seek Forward 5s (Right Arrow)"
          >
            <FontAwesomeIcon icon={faForward} />
          </button>

          <button
            onClick={onNextLecture}
            className="control-btn navigation-btn"
            title="Next Lecture (.)"
          >
            <FontAwesomeIcon icon={faStepForward} />
          </button>

          {/* Volume */}
          <VolumeControl
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={onVolumeChange}
            onToggleMute={onToggleMute}
          />

          {/* Time Display */}
          <span className="time-display">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>
        </div>

        <div className="controls-right">
          {/* Subtitles */}
          <button
            onClick={onToggleSubtitles}
            className={`control-btn subtitle-btn ${subtitlesEnabled ? "active" : ""}`}
            title={subtitlesEnabled ? "Hide Subtitles (C)" : "Show Subtitles (C)"}
          >
            <FontAwesomeIcon icon={faClosedCaptioning} />
          </button>

          {/* Speed Selector */}
          <select
            value={playbackRate}
            onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
            className="speed-select"
            title="Playback Speed"
          >
            {playbackRates.map((rate) => (
              <option key={rate} value={rate}>
                {rate}x
              </option>
            ))}
          </select>

          {/* Fullscreen */}
          <button onClick={onToggleFullscreen} className="control-btn" title="Fullscreen (F)">
            <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoControls;
