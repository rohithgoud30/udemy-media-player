import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Settings.css";
import SettingsManager, { DEFAULT_SETTINGS } from "../../utils/settingsManager";

const Settings: React.FC = () => {
  const navigate = useNavigate();

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    try {
      const loaded = SettingsManager.loadSettings();
      setSettings(loaded);
    } catch (error) {
      console.error("Error loading settings:", error);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save settings
  const saveSettings = async () => {
    try {
      SettingsManager.saveSettings(settings);
      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings.");
    }
  };

  // Handle input changes
  const handleInputChange = (section: keyof AppSettings, setting: string, value: unknown) => {
    setSettings((prevSettings) => {
      const updated = {
        ...prevSettings,
        [section]: {
          ...prevSettings[section],
          [setting]: value,
        },
      };

      // Auto-save for playback speed changes
      if (section === "playback" && setting === "defaultSpeed") {
        SettingsManager.saveSettings(updated);
      }

      return updated;
    });
  };

  // Reset to defaults
  const resetDefaults = () => {
    if (window.confirm("Are you sure you want to reset all settings to defaults?")) {
      SettingsManager.resetToDefaults();
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

      <div className="settings-credits">
        <p>
          Made with <span className="heart">❤️</span> by{" "}
          <a
            href="https://github.com/rohithgoud30"
            target="_blank"
            rel="noopener noreferrer"
            className="credits-link"
          >
            @rohithgoud30
          </a>
        </p>
      </div>
    </div>
  );
};

export default Settings;
