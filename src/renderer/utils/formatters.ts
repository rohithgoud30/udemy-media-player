export const checkFileExists = async (filePath: string): Promise<boolean> => {
  if (window.electronAPI) {
    return await window.electronAPI.checkFileExists(filePath);
  }
  return false;
};

/**
 * Formats a duration in seconds to a string (e.g. "1:05:30" or "05:30")
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export const formatDuration = (seconds: number): string => {
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

/**
 * Formats a duration in seconds to a human-readable string (e.g. "1 hr 5 mins")
 * @param seconds - Duration in seconds
 * @returns Human-readable duration string
 */
export const formatTimeWords = (seconds: number): string => {
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
