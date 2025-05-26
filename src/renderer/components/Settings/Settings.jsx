import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Settings.css'

// Define default settings object outside the component for reuse
const DEFAULT_SETTINGS = {
  // Playback settings
  playback: {
    defaultSpeed: 1.0,
    autoPlay: false,
    preferredQuality: 'auto',
    rememberPosition: true,
    autoMarkCompleted: true,
    autoPlayNext: true,
  },

  // Subtitle settings
  subtitles: {
    enabled: true,
    fontSize: 'medium',
    fontColor: 'white',
    backgroundColor: 'black',
  },

  // Interface settings
  interface: {
    theme: 'dark', // 'dark' or 'light'
    sidebarExpanded: true,
    showCourseThumbnails: true,
    courseSortOrder: 'newest',
  },

  // Storage settings
  storage: {
    downloadLocation: '',
    maxConcurrentDownloads: 2,
    deleteCompletedCourses: false,
  },

  // Keyboard shortcuts
  shortcuts: {
    playPause: 'Space',
    seekForward: 'ArrowRight',
    seekBackward: 'ArrowLeft',
    volumeUp: 'ArrowUp',
    volumeDown: 'ArrowDown',
    toggleFullscreen: 'f',
  },
}

const Settings = () => {
  const navigate = useNavigate()

  // Default settings state
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)

  // Load settings from local storage on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true)
        // Try to load from localStorage first
        const savedSettings = localStorage.getItem('udemyPlayerSettings')

        if (savedSettings) {
          const parsed = JSON.parse(savedSettings)
          // Ensure we have all required properties by merging with defaults
          setSettings({
            ...DEFAULT_SETTINGS,
            ...parsed,
            // Ensure nested objects are properly merged
            playback: {
              ...DEFAULT_SETTINGS.playback,
              ...(parsed.playback || {}),
            },
            subtitles: {
              ...DEFAULT_SETTINGS.subtitles,
              ...(parsed.subtitles || {}),
            },
            interface: {
              ...DEFAULT_SETTINGS.interface,
              ...(parsed.interface || {}),
            },
            storage: {
              ...DEFAULT_SETTINGS.storage,
              ...(parsed.storage || {}),
            },
            shortcuts: {
              ...DEFAULT_SETTINGS.shortcuts,
              ...(parsed.shortcuts || {}),
            },
          })
        } else if (window.electronAPI) {
          // If using Electron, we can also try to load from a settings file
          // This is just a placeholder - implement based on your IPC methods
          const electronSettings = await window.electronAPI.getSettings()
          if (electronSettings) {
            setSettings({
              ...DEFAULT_SETTINGS,
              ...electronSettings,
              // Ensure nested objects are properly merged (same as above)
              playback: {
                ...DEFAULT_SETTINGS.playback,
                ...(electronSettings.playback || {}),
              },
              subtitles: {
                ...DEFAULT_SETTINGS.subtitles,
                ...(electronSettings.subtitles || {}),
              },
              interface: {
                ...DEFAULT_SETTINGS.interface,
                ...(electronSettings.interface || {}),
              },
              storage: {
                ...DEFAULT_SETTINGS.storage,
                ...(electronSettings.storage || {}),
              },
              shortcuts: {
                ...DEFAULT_SETTINGS.shortcuts,
                ...(electronSettings.shortcuts || {}),
              },
            })
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error)
        // On error, use default settings
        setSettings(DEFAULT_SETTINGS)
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [])

  // Save settings
  const saveSettings = async () => {
    try {
      // Save to localStorage
      localStorage.setItem('udemyPlayerSettings', JSON.stringify(settings))

      // If using Electron, also save to a file
      if (window.electronAPI) {
        await window.electronAPI.saveSettings(settings)
      }

      // Show success message (could be implemented with a toast notification)
      alert('Settings saved successfully!')
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings.')
    }
  }

  // Handle input changes
  const handleInputChange = (section, setting, value) => {
    setSettings((prevSettings) => ({
      ...prevSettings,
      [section]: {
        ...(prevSettings[section] || {}),
        [setting]: value,
      },
    }))
  }

  // Reset to defaults
  const resetDefaults = () => {
    if (
      window.confirm('Are you sure you want to reset all settings to defaults?')
    ) {
      localStorage.removeItem('udemyPlayerSettings')
      setSettings(DEFAULT_SETTINGS)
    }
  }

  // Choose download location (Electron only)
  const chooseDownloadLocation = async () => {
    if (!window.electronAPI) {
      alert('This feature is only available in the desktop app.')
      return
    }

    try {
      console.log('Calling selectDirectory from Settings...')
      const dirPath = await window.electronAPI.selectDirectory()
      console.log('Selected directory:', dirPath)
      if (dirPath) {
        handleInputChange('storage', 'downloadLocation', dirPath)
      }
    } catch (error) {
      console.error('Error selecting directory:', error)
      alert('Error selecting directory: ' + error.message)
    }
  }

  if (isLoading) {
    return <div className='loading'>Loading settings...</div>
  }

  return (
    <div className='settings-container'>
      <h1>Settings</h1>

      <div className='settings-section'>
        <h2>Playback Settings</h2>

        <div className='setting-item'>
          <label htmlFor='defaultSpeed'>Default Playback Speed:</label>
          <select
            id='defaultSpeed'
            value={settings.playback?.defaultSpeed || 1.0}
            onChange={(e) =>
              handleInputChange(
                'playback',
                'defaultSpeed',
                parseFloat(e.target.value)
              )
            }
          >
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1.0}>1.0x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={1.75}>1.75x</option>
            <option value={2.0}>2.0x</option>
          </select>
        </div>

        <div className='setting-item'>
          <label>
            <input
              type='checkbox'
              checked={settings.playback?.autoPlay || false}
              onChange={(e) =>
                handleInputChange('playback', 'autoPlay', e.target.checked)
              }
            />
            Auto-play videos when opening
          </label>
        </div>

        <div className='setting-item'>
          <label>
            <input
              type='checkbox'
              checked={settings.playback?.rememberPosition || true}
              onChange={(e) =>
                handleInputChange(
                  'playback',
                  'rememberPosition',
                  e.target.checked
                )
              }
            />
            Remember playback position
          </label>
        </div>

        <div className='setting-item'>
          <label>
            <input
              type='checkbox'
              checked={settings.playback?.autoMarkCompleted || true}
              onChange={(e) =>
                handleInputChange(
                  'playback',
                  'autoMarkCompleted',
                  e.target.checked
                )
              }
            />
            Mark videos as completed when finished
          </label>
        </div>

        <div className='setting-item'>
          <label>
            <input
              type='checkbox'
              checked={settings.playback?.autoPlayNext || true}
              onChange={(e) =>
                handleInputChange('playback', 'autoPlayNext', e.target.checked)
              }
            />
            Auto-play next lecture when finished
          </label>
        </div>
      </div>

      <div className='settings-section'>
        <h2>Subtitle Settings</h2>

        <div className='setting-item'>
          <label>
            <input
              type='checkbox'
              checked={settings.subtitles?.enabled || true}
              onChange={(e) =>
                handleInputChange('subtitles', 'enabled', e.target.checked)
              }
            />
            Enable subtitles when available
          </label>
        </div>

        <div className='setting-item'>
          <label htmlFor='subtitleFontSize'>Font Size:</label>
          <select
            id='subtitleFontSize'
            value={settings.subtitles?.fontSize || 'medium'}
            onChange={(e) =>
              handleInputChange('subtitles', 'fontSize', e.target.value)
            }
          >
            <option value='small'>Small</option>
            <option value='medium'>Medium</option>
            <option value='large'>Large</option>
          </select>
        </div>

        <div className='setting-item'>
          <label htmlFor='subtitleFontColor'>Font Color:</label>
          <select
            id='subtitleFontColor'
            value={settings.subtitles?.fontColor || 'white'}
            onChange={(e) =>
              handleInputChange('subtitles', 'fontColor', e.target.value)
            }
          >
            <option value='white'>White</option>
            <option value='yellow'>Yellow</option>
            <option value='green'>Green</option>
          </select>
        </div>

        <div className='setting-item'>
          <label htmlFor='subtitleBackgroundColor'>Background Color:</label>
          <select
            id='subtitleBackgroundColor'
            value={settings.subtitles?.backgroundColor || 'black'}
            onChange={(e) =>
              handleInputChange('subtitles', 'backgroundColor', e.target.value)
            }
          >
            <option value='black'>Black</option>
            <option value='transparent'>Transparent</option>
            <option value='blue'>Blue</option>
          </select>
        </div>
      </div>

      <div className='settings-section'>
        <h2>Interface Settings</h2>

        <div className='setting-item'>
          <label htmlFor='theme'>Theme:</label>
          <select
            id='theme'
            value={settings.interface?.theme || 'dark'}
            onChange={(e) =>
              handleInputChange('interface', 'theme', e.target.value)
            }
          >
            <option value='dark'>Dark</option>
            <option value='light'>Light</option>
          </select>
        </div>

        <div className='setting-item'>
          <label>
            <input
              type='checkbox'
              checked={settings.interface?.sidebarExpanded || true}
              onChange={(e) =>
                handleInputChange(
                  'interface',
                  'sidebarExpanded',
                  e.target.checked
                )
              }
            />
            Expand sidebar by default
          </label>
        </div>

        <div className='setting-item'>
          <label>
            <input
              type='checkbox'
              checked={settings.interface?.showCourseThumbnails || true}
              onChange={(e) =>
                handleInputChange(
                  'interface',
                  'showCourseThumbnails',
                  e.target.checked
                )
              }
            />
            Show course thumbnails
          </label>
        </div>

        <div className='setting-item'>
          <label htmlFor='courseSortOrder'>Course Sort Order:</label>
          <select
            id='courseSortOrder'
            value={settings.interface?.courseSortOrder || 'newest'}
            onChange={(e) =>
              handleInputChange('interface', 'courseSortOrder', e.target.value)
            }
          >
            <option value='newest'>Newest First</option>
            <option value='oldest'>Oldest First</option>
            <option value='alphabetical'>Alphabetical</option>
            <option value='lastWatched'>Last Watched</option>
          </select>
        </div>
      </div>

      <div className='settings-section'>
        <h2>Storage Settings</h2>

        <div className='setting-item download-location'>
          <label htmlFor='downloadLocation'>Download Location:</label>
          <div className='download-path-input'>
            <input
              type='text'
              id='downloadLocation'
              value={settings.storage?.downloadLocation || ''}
              onChange={(e) =>
                handleInputChange('storage', 'downloadLocation', e.target.value)
              }
              readOnly
            />
            <button onClick={chooseDownloadLocation}>Browse...</button>
          </div>
        </div>

        <div className='setting-item'>
          <label htmlFor='maxConcurrentDownloads'>
            Max Concurrent Downloads:
          </label>
          <select
            id='maxConcurrentDownloads'
            value={settings.storage?.maxConcurrentDownloads || 2}
            onChange={(e) =>
              handleInputChange(
                'storage',
                'maxConcurrentDownloads',
                parseInt(e.target.value)
              )
            }
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
          </select>
        </div>
      </div>

      <div className='settings-section'>
        <h2>Keyboard Shortcuts</h2>

        <div className='keyboard-shortcuts-table'>
          <div className='shortcut-row'>
            <div className='shortcut-label'>Play/Pause:</div>
            <div className='shortcut-key'>
              {settings.shortcuts?.playPause || 'Space'}
            </div>
          </div>

          <div className='shortcut-row'>
            <div className='shortcut-label'>Seek Forward:</div>
            <div className='shortcut-key'>
              {settings.shortcuts?.seekForward || 'ArrowRight'}
            </div>
          </div>

          <div className='shortcut-row'>
            <div className='shortcut-label'>Seek Backward:</div>
            <div className='shortcut-key'>
              {settings.shortcuts?.seekBackward || 'ArrowLeft'}
            </div>
          </div>

          <div className='shortcut-row'>
            <div className='shortcut-label'>Volume Up:</div>
            <div className='shortcut-key'>
              {settings.shortcuts?.volumeUp || 'ArrowUp'}
            </div>
          </div>

          <div className='shortcut-row'>
            <div className='shortcut-label'>Volume Down:</div>
            <div className='shortcut-key'>
              {settings.shortcuts?.volumeDown || 'ArrowDown'}
            </div>
          </div>

          <div className='shortcut-row'>
            <div className='shortcut-label'>Toggle Fullscreen:</div>
            <div className='shortcut-key'>
              {settings.shortcuts?.toggleFullscreen || 'f'}
            </div>
          </div>
        </div>

        <p className='shortcut-info'>
          Note: Keyboard shortcuts cannot be customized at this time.
        </p>
      </div>

      <div className='settings-actions'>
        <button className='save-button' onClick={saveSettings}>
          Save Settings
        </button>
        <button className='reset-button' onClick={resetDefaults}>
          Reset to Defaults
        </button>
        <button className='cancel-button' onClick={() => navigate(-1)}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default Settings
