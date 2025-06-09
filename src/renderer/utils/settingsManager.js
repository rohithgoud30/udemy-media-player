// Settings Manager Utility
// Ensures consistent settings across the app and forces critical settings to always be true

const DEFAULT_SETTINGS = {
  playback: {
    defaultSpeed: 1.0,
    autoPlay: true,
    preferredQuality: "auto",
    rememberPosition: true, // Always forced to true
    autoMarkCompleted: true, // Always forced to true
    autoPlayNext: true, // Always forced to true
  },
  subtitles: {
    enabled: true,
    fontSize: "medium",
    fontColor: "white",
    backgroundColor: "black",
  },
  shortcuts: {
    playPause: "Space",
    seekForward: "ArrowRight",
    seekBackward: "ArrowLeft",
    volumeUp: "ArrowUp",
    volumeDown: "ArrowDown",
    toggleFullscreen: "f",
  },
};

class SettingsManager {
  static STORAGE_KEY = "udemyPlayerSettings";

  /**
   * Force critical settings to always be true
   */
  static enforceCriticalSettings(settings) {
    return {
      ...settings,
      playback: {
        ...settings.playback,
        rememberPosition: true, // Always true
        autoMarkCompleted: true, // Always true
        autoPlayNext: true, // Always true
      },
    };
  }

  /**
   * Load settings from localStorage with proper defaults and enforcement
   */
  static loadSettings() {
    try {
      const savedSettings = localStorage.getItem(this.STORAGE_KEY);

      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);

        // Merge with defaults to ensure all properties exist
        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          playback: {
            ...DEFAULT_SETTINGS.playback,
            ...(parsed.playback || {}),
          },
          subtitles: {
            ...DEFAULT_SETTINGS.subtitles,
            ...(parsed.subtitles || {}),
          },
          shortcuts: {
            ...DEFAULT_SETTINGS.shortcuts,
            ...(parsed.shortcuts || {}),
          },
        };

        // Force critical settings
        return this.enforceCriticalSettings(mergedSettings);
      }

      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error("Error loading settings:", error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Save settings to localStorage with critical settings enforcement
   */
  static saveSettings(settings) {
    try {
      const enforcedSettings = this.enforceCriticalSettings(settings);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(enforcedSettings));

      // If using Electron, also save to file
      if (window.electronAPI) {
        window.electronAPI.saveSettings(enforcedSettings);
      }

      return enforcedSettings;
    } catch (error) {
      console.error("Error saving settings:", error);
      throw error;
    }
  }

  /**
   * Get only player-specific settings
   */
  static getPlayerSettings() {
    const settings = this.loadSettings();
    return {
      defaultSpeed: settings.playback.defaultSpeed,
      autoPlay: settings.playback.autoPlay,
      rememberPosition: true, // Always true
      autoMarkCompleted: true, // Always true
      autoPlayNext: true, // Always true
    };
  }

  /**
   * Update specific setting and save
   */
  static updateSetting(section, key, value) {
    const settings = this.loadSettings();

    settings[section] = {
      ...settings[section],
      [key]: value,
    };

    return this.saveSettings(settings);
  }

  /**
   * Reset to defaults
   */
  static resetToDefaults() {
    localStorage.removeItem(this.STORAGE_KEY);
    return DEFAULT_SETTINGS;
  }
}

export default SettingsManager;
