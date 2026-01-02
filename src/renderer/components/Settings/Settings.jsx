import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Settings.css";
import ElectronTest from "../ElectronTest";

// Define default settings object outside the component for reuse
const DEFAULT_SETTINGS = {
  // Playback settings
  playback: {
    defaultSpeed: 1.0,
    autoPlay: true,
    preferredQuality: "auto",
    rememberPosition: true, // Always true by default
    autoMarkCompleted: true, // Always true by default
    autoPlayNext: true, // Always true by default
    showCompletionOverlay: true, // Show modal on lecture complete
  },

  // Keyboard shortcuts
  shortcuts: {
    playPause: "Space",
    seekForward: "ArrowRight",
    seekBackward: "ArrowLeft",
    volumeUp: "ArrowUp",
    volumeDown: "ArrowDown",
    toggleFullscreen: "f",
  },
};

const Settings = () => {
  const navigate = useNavigate();

  // Default settings state
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from local storage on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        // Try to load from localStorage first
        const savedSettings = localStorage.getItem("udemyPlayerSettings");

        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          // Ensure we have all required properties by merging with defaults
          setSettings({
            ...DEFAULT_SETTINGS,
            ...parsed,
            // Ensure nested objects are properly merged
            playback: {
              ...parsed.playbackck,
              ...(parsed.playback || {}),
            },
            shortcuts: {
              ...parsed.shortcutsts,
              ...(parsed.shortcuts || {}),
            },
          });

          // If using Electron, we can also try to load from a settings file
          // This is just a placeholder - implement based on your IPC methods
          if (window.electronAPI?.getSettings) {
            const electronSettings = await window.electronAPI.getSettings();
            if (electronSettings) {
              setSettings({
                ...DEFAULT_SETTINGS,
                ...electronSettings,
                // Ensure nested objects are properly merged (same as above)
                playback: {
                  ...DEFAULT_SETTINGS.playback,
                  ...(electronSettings.playback || {}),
                },
                shortcuts: {
                  ...DEFAULT_SETTINGS.shortcuts,
                  ...(electronSettings.shortcuts || {}),
                },
              });
            }
          }
        }
      } catch (error) {
        console.error("Error loading settings:", error);
        // On error, use default settings
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Save settings
  const saveSettings = async () => {
    try {
      // Force critical settings to always be true
      const settingsToSave = {
        ...settings,
        playback: {
          ...settings.playback,
          rememberPosition: true, // Always true
          autoMarkCompleted: true, // Always true
          autoPlayNext: true, // Always true
        },
      };

      // Save to localStorage
      localStorage.setItem("udemyPlayerSettings", JSON.stringify(settingsToSave));

      // If using Electron, also save to a file
      if (window.electronAPI) {
        await window.electronAPI.saveSettings(settingsToSave);
      }

      // Show success message (could be implemented with a toast notification)
      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings.");
    }
  };

  // Handle input changes
  const handleInputChange = (section, setting, value) => {
    setSettings((prevSettings) => ({
      ...prevSettings,
      [section]: {
        ...(prevSettings[section] || {}),
        [setting]: value,
      },
    }));

    // Auto-save for playback speed changes
    if (section === "playback" && setting === "defaultSpeed") {
      setTimeout(() => {
        try {
          const updatedSettings = {
            ...settings,
            playback: {
              ...settings.playback,
              [setting]: value,
              rememberPosition: true, // Always true
              autoMarkCompleted: true, // Always true
              autoPlayNext: true, // Always true
            },
          };

          localStorage.setItem("udemyPlayerSettings", JSON.stringify(updatedSettings));
          console.log(`💾 Auto-saved playback speed: ${value}x`);
        } catch (error) {
          console.error("Error auto-saving playback speed:", error);
        }
      }, 100); // Small delay to ensure state is updated
    }
  };

  // Reset to defaults
  const resetDefaults = () => {
    if (window.confirm("Are you sure you want to reset all settings to defaults?")) {
      localStorage.removeItem("udemyPlayerSettings");
      setSettings(DEFAULT_SETTINGS);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading settings...</div>;
  }

  return (
    <div className="settings-container">
      <h1>Settings</h1>

      <div className="settings-section">
        <h2>Playback Settings</h2>

        <div className="setting-item">
          <label htmlFor="defaultSpeed">Default Playback Speed:</label>
          <select
            id="defaultSpeed"
            value={settings.playback?.defaultSpeed || 1.0}
            onChange={(e) =>
              handleInputChange("playback", "defaultSpeed", parseFloat(e.target.value))
            }
          >
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1.0}>1.0x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={1.75}>1.75x</option>
            <option value={2.0}>2.0x</option>
            <option value={2.25}>2.25x</option>
            <option value={2.5}>2.5x</option>
            <option value={2.75}>2.75x</option>
            <option value={3.0}>3.0x</option>
            <option value={3.25}>3.25x</option>
            <option value={3.5}>3.5x</option>
            <option value={3.75}>3.75x</option>
            <option value={4.0}>4.0x</option>
          </select>
        </div>

        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.playback?.autoPlay || false}
              onChange={(e) => handleInputChange("playback", "autoPlay", e.target.checked)}
            />
            Auto-play videos when opening
          </label>
        </div>

        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.playback?.showCompletionOverlay !== false}
              onChange={(e) =>
                handleInputChange("playback", "showCompletionOverlay", e.target.checked)
              }
            />
            Show completion overlay when lecture ends
          </label>
          <p className="setting-description">
            When enabled, a modal with replay and next lecture options will appear when a video
            completes.
          </p>
        </div>
      </div>

      <div className="settings-section">
        <h2>Keyboard Shortcuts</h2>

        <div className="keyboard-shortcuts-table">
          <div className="shortcut-row">
            <div className="shortcut-label">Play/Pause:</div>
            <div className="shortcut-key">Space/K</div>
          </div>

          <div className="shortcut-row">
            <div className="shortcut-label">Seek 5s:</div>
            <div className="shortcut-key">←/→</div>
          </div>

          <div className="shortcut-row">
            <div className="shortcut-label">Fullscreen:</div>
            <div className="shortcut-key">F</div>
          </div>

          <div className="shortcut-row">
            <div className="shortcut-label">Previous/Next:</div>
            <div className="shortcut-key">,/.</div>
          </div>

          <div className="shortcut-row">
            <div className="shortcut-label">Mute/Unmute:</div>
            <div className="shortcut-key">M</div>
          </div>

          <div className="shortcut-row">
            <div className="shortcut-label">Toggle Subtitles:</div>
            <div className="shortcut-key">C</div>
          </div>
        </div>

        <p className="shortcut-info">Note: Keyboard shortcuts cannot be customized at this time.</p>
      </div>

      <div className="settings-section">
        <div className="settings-section-content">
          <ElectronTest />
        </div>
      </div>

      <div className="settings-actions">
        <button className="save-button" onClick={saveSettings}>
          Save Settings
        </button>
        <button className="reset-button" onClick={resetDefaults}>
          Reset to Defaults
        </button>
        <button className="cancel-button" onClick={() => navigate(-1)}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default Settings;
