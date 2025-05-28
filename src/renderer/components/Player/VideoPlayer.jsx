import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import './VideoPlayer.css'
import { CourseManager, ProgressManager } from '../../../js/database'
import db from '../../../js/database'

// Check if running in Electron or browser environment
const isElectron = () => {
  return window.electronAPI !== undefined
}

// Helper for checking if a file exists
const checkFileExists = async (filePath) => {
  if (isElectron()) {
    return await window.electronAPI.checkFileExists(filePath)
  }
  return false // In browser mode, we can't check files
}

// Helper to find lecture by ID directly from database
const findLecture = async (lectureId) => {
  try {
    console.log('Finding lecture with ID:', lectureId)
    // Access database directly
    const lecture = await db.lectures.get(parseInt(lectureId))
    console.log('Found lecture:', lecture)
    return lecture
  } catch (error) {
    console.error('Error finding lecture:', error)
    return null
  }
}

// Helper to determine video MIME type based on file extension
const getVideoType = (filePath) => {
  if (!filePath) return 'video/mp4' // Default to MP4

  const extension = filePath.toLowerCase().split('.').pop()

  const mimeTypes = {
    mp4: 'video/mp4',
    mkv: 'video/x-matroska',
    webm: 'video/webm',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime',
    wmv: 'video/x-ms-wmv',
    flv: 'video/x-flv',
    m4v: 'video/mp4',
    ts: 'video/mp2t',
    '3gp': 'video/3gpp',
  }

  console.log('Video file extension:', extension)
  return mimeTypes[extension] || 'video/mp4'
}

// Helper to create a URL for local video files
const createVideoUrl = (filePath) => {
  if (!filePath) return null

  try {
    // When running in Electron's development mode, webSecurity is disabled
    // allowing us to use direct file:// URLs for video playback

    // First normalize path (for Windows compatibility)
    const normalizedPath = filePath.replace(/\\/g, '/')

    // For best cross-platform compatibility, create the URL with specific encoding:
    // 1. Convert to URI format for file protocol
    // 2. Make sure special characters are properly encoded
    // 3. Maintain proper structure for macOS/Windows paths

    // Create a URL object for proper encoding
    // This approach works better than simple encodeURI for paths with spaces and special characters
    const fileUrl = `file://${normalizedPath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')}`

    console.log('Original path:', filePath)
    console.log('File URL:', fileUrl)

    return fileUrl
  } catch (error) {
    console.error('Error creating video URL:', error)
    // Basic fallback - simple encoding for paths with special characters
    const normalizedPath = filePath.replace(/\\/g, '/')
    return `file://${encodeURI(normalizedPath)}`
  }
}

const VideoPlayer = () => {
  const { lectureId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state || {}

  const videoRef = useRef(null)
  const playerRef = useRef(null)

  const [lecture, setLecture] = useState(null)
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saveInterval, setSaveInterval] = useState(null)
  const [nearbyLectures, setNearbyLectures] = useState([])
  const [playerSettings, setPlayerSettings] = useState({
    defaultSpeed: 1.0,
    autoPlay: true,
    rememberPosition: true,
    autoMarkCompleted: true,
    autoPlayNext: true,
  })

  // Load player settings from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('udemyPlayerSettings')
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings)
        // Only update the player settings we need
        if (parsedSettings.playback) {
          setPlayerSettings({
            defaultSpeed: parsedSettings.playback.defaultSpeed || 1.0,
            autoPlay:
              parsedSettings.playback.autoPlay !== undefined
                ? parsedSettings.playback.autoPlay
                : true,
            rememberPosition:
              parsedSettings.playback.rememberPosition !== undefined
                ? parsedSettings.playback.rememberPosition
                : true,
            autoMarkCompleted:
              parsedSettings.playback.autoMarkCompleted !== undefined
                ? parsedSettings.playback.autoMarkCompleted
                : true,
            autoPlayNext:
              parsedSettings.playback.autoPlayNext !== undefined
                ? parsedSettings.playback.autoPlayNext
                : true,
          })
        }
      }
    } catch (error) {
      console.error('Error loading player settings:', error)
    }
  }, [])

  // Load lecture data when ID changes
  useEffect(() => {
    async function loadLectureData() {
      try {
        setLoading(true)
        setError('')

        // Clean up any existing player
        if (playerRef.current) {
          try {
            playerRef.current.dispose()
            playerRef.current = null
          } catch (e) {
            console.warn('Error disposing player during lecture change:', e)
          }
        }

        // Get lecture details
        console.log('Finding lecture with ID:', lectureId)
        const lectureData = await findLecture(parseInt(lectureId))

        // Override filePath and videoUrl if provided via route state
        if (routeState.filePath) {
          lectureData.filePath = routeState.filePath
        }
        if (routeState.videoUrl) {
          lectureData.videoUrl = routeState.videoUrl
        }

        if (!lectureData) {
          setError(`Lecture with ID ${lectureId} not found`)
          return
        }

        console.log('Found lecture:', lectureData)

        // Ensure filePath exists after overrides
        if (!lectureData.filePath) {
          setError(`No file path found for lecture ${lectureId}`)
          return
        }

        // Load previous progress
        const progress = await ProgressManager.getLectureProgress(
          lectureData.id
        )

        // Determine if we should start from beginning or resume
        let savedPos = 0

        // If lecture is completed and not coming from a specific timestamp, start from beginning
        if (progress.completed && routeState.startPosition === undefined) {
          console.log('Lecture was completed, starting from beginning')
          savedPos = 0
        } else if (routeState.startPosition !== undefined) {
          // If specific position provided via routing, use that
          savedPos = routeState.startPosition
        } else if (progress.position > 0) {
          // Otherwise use stored position
          savedPos = progress.position
        }

        console.log(`Loading saved progress for lecture ${lectureData.id}:`, {
          routeStatePosition: routeState.startPosition,
          dbPosition: progress.position,
          isCompleted: progress.completed,
          finalPosition: savedPos,
        })

        // Create lecture object with saved progress
        const lectureWithProgress = {
          ...lectureData,
          videoUrl: routeState.videoUrl || createVideoUrl(lectureData.filePath),
          savedProgress: savedPos,
          completed: progress.completed || false,
        }
        setLecture(lectureWithProgress)

        // Load course data
        const courseData = await CourseManager.getCourseDetails(
          lectureData.courseId
        )
        setCourse(courseData)

        // Load nearby lectures for mini course view
        if (courseData && courseData.sections) {
          const allLectures = []
          courseData.sections.forEach((section) => {
            if (section.lectures) {
              allLectures.push(
                ...section.lectures.map((lecture) => ({
                  ...lecture,
                  sectionTitle: section.title,
                }))
              )
            }
          })

          // Sort lectures by section index and lecture index
          allLectures.sort((a, b) => {
            const sectionA = courseData.sections.find(
              (s) => s.id === a.sectionId
            )
            const sectionB = courseData.sections.find(
              (s) => s.id === b.sectionId
            )

            if (!sectionA || !sectionB) return 0

            if (sectionA.index !== sectionB.index) {
              return sectionA.index - sectionB.index
            }

            return a.index - b.index
          })

          // Find current lecture index
          const currentIndex = allLectures.findIndex(
            (l) => l.id === parseInt(lectureId)
          )

          // Get 3 lectures before and 3 after the current one
          const startIndex = Math.max(0, currentIndex - 3)
          const endIndex = Math.min(allLectures.length - 1, currentIndex + 3)
          const nearby = allLectures.slice(startIndex, endIndex + 1)

          setNearbyLectures(nearby)
        }

        // Check if running in browser mode without Electron
        if (!isElectron()) {
          setError('This app requires Electron to play local videos')
          return
        }

        // Check if the video file exists before initializing the player
        let fileExists = false
        let filePath = lectureData.filePath
        if (filePath) {
          fileExists = await checkFileExists(filePath)
        }
        if (!fileExists) {
          setError(
            `Video file does not exist or cannot be accessed at path: ${filePath}\nFile existence check: ${fileExists}`
          )
          return
        }

        // First verify the file exists on disk
        try {
          const fsCheck = await window.electronAPI.checkFileExists(filePath)
          console.log('File system check:', fsCheck)
          if (!fsCheck) {
            setError(
              `Video file exists according to app but file system check failed: ${filePath}`
            )
            return
          }
        } catch (e) {
          console.error('Error checking file existence:', e)
        }

        // Use overridden videoUrl if provided, else create from filePath
        const videoUrl = routeState.videoUrl || createVideoUrl(filePath)
        console.log('Debug: Video URL created:', videoUrl)

        // Determine video type with override if provided
        const videoType = routeState.videoType || getVideoType(filePath)
        console.log('Video type:', videoType)

        // Update lecture object with videoUrl if not already set
        if (lecture && (!lecture.videoUrl || lecture.videoUrl !== videoUrl)) {
          // Use the previously created lectureWithProgress object and just update the videoUrl
          setLecture({
            ...lectureWithProgress,
            videoUrl,
          })
        }
      } catch (error) {
        console.error('Error loading lecture data:', error)
        setError('Failed to load lecture')
      } finally {
        setLoading(false)
      }
    }

    loadLectureData()

    // Cleanup function
    return () => {
      // Clear intervals to prevent memory leaks
      if (saveInterval) {
        clearInterval(saveInterval)
        setSaveInterval(null)
      }
    }
  }, [lectureId])

  // Initialize Video.js player
  const initializePlayer = (lectureData, startPosition = 0) => {
    if (!videoRef.current) {
      console.error('Video container ref is not available')
      return null
    }

    console.log('Initializing player with settings:', playerSettings)
    console.log(
      'Starting position for player:',
      startPosition,
      'lecture saved progress:',
      lectureData.savedProgress,
      'completed:',
      lectureData.completed
    )

    // Find the video element
    const videoElement = videoRef.current.querySelector('video#video-player')
    if (!videoElement) {
      console.error(
        'Video element not found in initializePlayer. DOM might not be ready yet.'
      )
      return null
    }

    // Check if player is already initialized
    if (playerRef.current) {
      console.log(
        'Player already exists, updating properties instead of recreating'
      )

      try {
        // Update player source if needed
        let videoUrl = lectureData.videoUrl
        if (!videoUrl && lectureData.filePath) {
          videoUrl = createVideoUrl(lectureData.filePath)
        }

        const videoType =
          routeState.videoType || getVideoType(lectureData.filePath)

        // Only update source if it's different
        const currentSrc = playerRef.current.src()
        if (currentSrc !== videoUrl) {
          playerRef.current.src({
            src: videoUrl,
            type: videoType,
          })
        }

        // Set current time if provided
        if (startPosition > 0 && effectiveSettings.rememberPosition) {
          console.log(`Seeking existing player to: ${startPosition}`)
          playerRef.current.currentTime(startPosition)
        }

        return playerRef.current
      } catch (error) {
        console.error('Error updating existing player, will recreate:', error)
        try {
          playerRef.current.dispose()
        } catch (e) {
          console.warn('Error disposing player during update:', e)
        }
        playerRef.current = null
      }
    }

    console.log('Video element found, proceeding with player initialization')

    // Set essential attributes
    videoElement.controls = true
    videoElement.preload = 'auto'
    videoElement.crossOrigin = 'anonymous' // Add crossOrigin for better media handling

    // Get the video URL - either from our loadLectureData function or create it here
    let videoUrl = lectureData.videoUrl
    if (!videoUrl && lectureData.filePath) {
      // Create the URL directly since we now have a synchronous function
      videoUrl = createVideoUrl(lectureData.filePath)
      console.log('Created video URL in initializePlayer:', videoUrl)
    } else if (!videoUrl) {
      console.error('No video URL or filePath available - playback may fail')
    }

    // Determine video type with override if provided
    const videoType = routeState.videoType || getVideoType(lectureData.filePath)

    console.log('Initializing player with URL:', videoUrl)
    console.log('Video type:', videoType)

    // Add debugging info to console
    console.log('Player configuration:', {
      videoUrl,
      videoType,
      filePath: lectureData.filePath,
      startPosition,
      playerSettings,
    })

    // Configure video.js player with optimal settings for local files
    const effectiveSettings = {
      ...playerSettings,
      ...(routeState.playerSettings || {}),
    }

    // Dispose any existing player first - extra safety check
    if (playerRef.current) {
      try {
        playerRef.current.dispose()
      } catch (e) {
        console.warn('Error disposing existing player:', e)
      }
      playerRef.current = null
    }

    // Create player with error handling
    let player
    try {
      player = videojs(
        videoElement,
        {
          controls: true,
          autoplay: effectiveSettings.autoPlay,
          preload: 'auto',
          fluid: true,
          playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
          techOrder: ['html5'], // Prefer HTML5 tech for better local file support
          html5: {
            nativeAudioTracks: true,
            nativeVideoTracks: true,
            nativeTextTracks: true,
          },
          sources: [
            {
              src: videoUrl,
              type: videoType,
            },
          ],
        },
        function () {
          console.log('Player initialization complete!')

          // Set initial playback speed from settings
          this.playbackRate(effectiveSettings.defaultSpeed)

          // We'll handle seeking after player is fully ready
          // in the 'ready' event instead for better reliability
        }
      )
    } catch (error) {
      console.error('Error creating video.js player:', error)
      return null
    }

    // Set up event handlers - store player reference first to avoid null errors
    playerRef.current = player

    // Add click-to-navigate feature for left/right sides of the player
    videoElement.addEventListener('click', (event) => {
      // Only handle clicks if we're not in fullscreen
      if (player.isFullscreen()) {
        return
      }

      // Don't handle click if player controls were clicked
      if (event.target !== videoElement) {
        return
      }

      // Get click position relative to player width
      const playerWidth = videoElement.offsetWidth
      const clickX = event.offsetX
      const clickPercentage = (clickX / playerWidth) * 100

      // If clicked on left 30% of screen, go to previous lecture
      if (clickPercentage < 30) {
        event.preventDefault() // Prevent default click behavior
        event.stopPropagation() // Stop event from bubbling
        navigateToLecture('prev')
      }
      // If clicked on right 30% of screen, go to next lecture
      else if (clickPercentage > 70) {
        event.preventDefault() // Prevent default click behavior
        event.stopPropagation() // Stop event from bubbling
        navigateToLecture('next')
      }
      // Middle area is for normal player interaction (play/pause)
    })

    // Add ready event to ensure player is fully initialized
    player.on('ready', function () {
      console.log('Player is fully initialized and ready')
      // Re-assign player reference to ensure it's available after initialization
      playerRef.current = player

      // Make sure to set the correct time after player is ready
      if (effectiveSettings.rememberPosition && startPosition > 0) {
        console.log(
          `Seeking to saved position: ${startPosition} for lecture ID: ${lectureData.id}`
        )
        // Use a small timeout to ensure the player is fully ready
        setTimeout(() => {
          const currentPos = player.currentTime() // Get current position before seeking
          console.log(`Current time before seeking: ${currentPos}`)
          player.currentTime(startPosition)

          // Add a verification check to ensure the seek was successful
          setTimeout(() => {
            const newPos = player.currentTime()
            console.log(`Position after seeking: ${newPos}`)
            if (Math.abs(newPos - startPosition) > 0.5) {
              console.warn(
                'Seeking may not have worked correctly. Trying again...'
              )
              player.currentTime(startPosition)
            }
          }, 200)
        }, 300)
      } else {
        console.log(
          'Starting video from beginning due to settings or completed state'
        )
      }

      // Set up keyboard shortcuts
      const keyboardCleanup = setupKeyboardShortcuts(player)

      // Request fullscreen if that setting is enabled
      // You can add a setting for this in your settings component
      const shouldEnterFullscreen = false // Change to read from settings
      if (shouldEnterFullscreen) {
        setTimeout(() => {
          try {
            const videoElement =
              videoRef.current.querySelector('video#video-player')
            if (videoElement && videoElement.requestFullscreen) {
              videoElement.requestFullscreen().catch((e) => {
                console.warn('Could not enter fullscreen:', e)
              })
            }
          } catch (error) {
            console.error('Error requesting fullscreen:', error)
          }
        }, 1000) // Give it a bit more time to be ready
      }
    })

    // Add a timeupdate listener for additional verification of position
    player.on('timeupdate', function () {
      // Only do this check on the first few timeupdate events
      if (
        player.positionVerified ||
        !effectiveSettings.rememberPosition ||
        startPosition <= 0
      ) {
        return
      }

      // Get current timestamp
      const now = Date.now()

      // Only check within the first 3 seconds of playback
      if (!player.playbackStartTime || now - player.playbackStartTime > 3000) {
        player.positionVerified = true
        return
      }

      // Verify position is correct
      const currentPos = player.currentTime()
      if (Math.abs(currentPos - startPosition) > 0.5) {
        console.log(
          'Position check failed in timeupdate, correcting to:',
          startPosition
        )
        player.currentTime(startPosition)
      } else {
        console.log('Position verified in timeupdate')
        player.positionVerified = true
      }
    })

    // Mark the start of playback time for verification window
    player.on('playing', function () {
      if (!player.playbackStartTime) {
        player.playbackStartTime = Date.now()
      }
    })

    // Set up the rest of the event handlers
    setupPlayerEventHandlers(player, lectureData, effectiveSettings)

    // Return the player instance
    return player
  }

  // Setup player event handlers
  const setupPlayerEventHandlers = (player, lectureData, effectiveSettings) => {
    player.on('error', function () {
      const error = player.error()
      console.error('Video.js Error:', error)

      const errorCode = error ? error.code : 'unknown'
      const errorMessage = error ? error.message : 'Unknown error'

      // Additional debugging for file access
      if (isElectron() && window.electronAPI) {
        window.electronAPI
          .checkFileExists(lectureData.filePath)
          .then((exists) => {
            console.log(`File existence check from error handler: ${exists}`)
          })
          .catch((err) => {
            console.error('Error checking file from error handler:', err)
          })
      }

      // Special error handling for MKV files
      if (
        lectureData.filePath &&
        lectureData.filePath.toLowerCase().endsWith('.mkv')
      ) {
        setError(
          `Error playing MKV file: ${errorMessage}. MKV files may require additional codecs. Try converting to MP4 format for better compatibility.`
        )
      } else {
        setError(
          `Failed to load video: ${errorMessage} (code: ${errorCode}). Make sure the file exists and is accessible.`
        )
      }
    })

    // Pause event handler with safety check
    player.on('pause', function () {
      try {
        if (player && typeof player.currentTime === 'function') {
          const currentTime = player.currentTime()
          console.log('Video paused at:', currentTime)

          // Save progress when paused
          ProgressManager.saveProgress(lectureData.id, currentTime)

          // Store the current position in a player attribute to ensure we resume from this exact position
          player.pausedAt = currentTime

          // Also store in sessionStorage as a backup
          try {
            sessionStorage.setItem(
              `video_pause_position_${lectureData.id}`,
              currentTime.toString()
            )
            console.log('Pause position saved to sessionStorage:', currentTime)
          } catch (storageError) {
            console.error(
              'Error saving pause position to sessionStorage:',
              storageError
            )
          }
        }
      } catch (error) {
        console.error('Error handling pause event:', error)
      }
    })

    // Add a specific play event handler to ensure resume from correct position
    player.on('play', function () {
      try {
        console.log('Video started playing')

        // Check for a saved position in various places, in order of preference:
        // 1. Direct player attribute (set by pause event)
        // 2. SessionStorage (backup)
        // 3. Last known position from progress tracker

        let savedPosition = undefined

        if (player.pausedAt !== undefined) {
          savedPosition = player.pausedAt
          console.log('Resuming from player.pausedAt:', savedPosition)
        } else {
          try {
            const storedPosition = sessionStorage.getItem(
              `video_pause_position_${lectureData.id}`
            )
            if (storedPosition) {
              savedPosition = parseFloat(storedPosition)
              console.log(
                'Resuming from sessionStorage position:',
                savedPosition
              )
            } else if (player.lastKnownPosition !== undefined) {
              savedPosition = player.lastKnownPosition
              console.log('Resuming from lastKnownPosition:', savedPosition)
            }
          } catch (storageError) {
            console.error(
              'Error retrieving pause position from sessionStorage:',
              storageError
            )
          }
        }

        // If we have a stored pause position, ensure we resume from it
        if (savedPosition !== undefined) {
          // Small timeout to ensure the play event completes first
          setTimeout(() => {
            // Only seek if the current position is different from where we paused
            if (Math.abs(player.currentTime() - savedPosition) > 0.5) {
              console.log(
                'Position drift detected, correcting to:',
                savedPosition
              )
              player.currentTime(savedPosition)
            }

            // Clear the pausedAt value and sessionStorage once we've resumed
            player.pausedAt = undefined
            try {
              sessionStorage.removeItem(
                `video_pause_position_${lectureData.id}`
              )
            } catch (e) {
              console.error('Error clearing sessionStorage:', e)
            }
          }, 50)
        }
      } catch (error) {
        console.error('Error in play event handler:', error)
      }
    })

    // Seeking event to track manual user seeking
    player.on('seeking', function () {
      // If user is manually seeking, clear the pausedAt position
      player.pausedAt = undefined
      try {
        sessionStorage.removeItem(`video_pause_position_${lectureData.id}`)
      } catch (e) {
        console.error('Error clearing sessionStorage in seeking handler:', e)
      }
      console.log('User seeking, cleared saved pause position')
    })

    // Ended event handler with safety check
    player.on('ended', function () {
      console.log('Video ended')

      try {
        // Mark as completed if setting is enabled
        if (
          effectiveSettings.autoMarkCompleted &&
          player &&
          typeof player.duration === 'function'
        ) {
          console.log('Auto-marking lecture as completed')
          ProgressManager.saveProgress(lectureData.id, 0, true) // Save position as 0 when completed

          // Update local state to reflect completion
          setLecture((prevLecture) => ({
            ...prevLecture,
            completed: true,
            savedProgress: 0, // Reset saved progress when completed
          }))

          // Auto-play next lecture if setting is enabled
          if (effectiveSettings.autoPlayNext) {
            console.log('Auto-playing next video based on settings...')
            setTimeout(() => navigateToLecture('next'), 1500) // Small delay before navigating
          }
        }
      } catch (error) {
        console.error('Error handling ended event:', error)
      }
    })

    // Setup progress tracker with safety checks
    const progressTracker = setInterval(() => {
      try {
        // Get the current player reference which might have been updated
        const currentPlayer = playerRef.current

        // Safety check to make sure player exists and is ready
        if (
          currentPlayer &&
          typeof currentPlayer.paused === 'function' &&
          typeof currentPlayer.currentTime === 'function'
        ) {
          const currentTime = currentPlayer.currentTime()

          // Always save the current position, even when paused
          // This provides an additional safety net for resuming playback
          ProgressManager.saveProgress(lectureData.id, currentTime)

          // If the player is not paused (actively playing)
          if (!currentPlayer.paused()) {
            // Check if we should update the pausedAt value for extra safety
            // This ensures we always have the latest position even if pause event fails
            currentPlayer.lastKnownPosition = currentTime

            // Mark as completed if watched 90% of video
            if (
              effectiveSettings.autoMarkCompleted &&
              typeof currentPlayer.duration === 'function' &&
              currentTime > currentPlayer.duration() * 0.9 &&
              !lectureData.completed
            ) {
              console.log('Auto-marking lecture as completed')
              ProgressManager.markLectureCompleted(lectureData.id)
              setLecture({ ...lectureData, completed: true })
            }
          }
          // If player is paused but we don't have a pausedAt value, set it
          else if (currentPlayer.pausedAt === undefined) {
            currentPlayer.pausedAt = currentTime
            console.log('Updating pausedAt in interval to:', currentTime)
          }
        }
      } catch (error) {
        console.error('Error in progress tracker:', error)
      }
    }, 5000) // Save progress every 5 seconds (increased frequency for better tracking)

    // Rate change event handler to sync playback speed
    player.on('ratechange', function () {
      const newRate = player.playbackRate()
      console.log('Playback rate changed:', newRate)
      // Update component state to apply to next videos immediately
      setPlayerSettings((prev) => ({
        ...prev,
        defaultSpeed: newRate,
      }))
      try {
        // Update localStorage settings
        const settings = JSON.parse(
          localStorage.getItem('udemyPlayerSettings') || '{}'
        )
        settings.playback = settings.playback || {}
        settings.playback.defaultSpeed = newRate
        localStorage.setItem('udemyPlayerSettings', JSON.stringify(settings))
        // Persist via Electron API if available
        if (isElectron() && window.electronAPI) {
          window.electronAPI.saveSettings(settings)
        }
      } catch (err) {
        console.error('Error saving playback speed:', err)
      }
    })

    // Store the interval ID for cleanup
    setSaveInterval(progressTracker)
  }

  // Separate effect for player initialization
  // This ensures proper cleanup between renders
  useEffect(() => {
    if (!lecture || !lecture.videoUrl || loading || error) {
      return // Don't initialize player until we have lecture data and are ready
    }

    console.log('Player initialization effect running for lecture:', lecture.id)

    // Clean up any existing player first
    if (playerRef.current) {
      try {
        console.log('Disposing existing player before creating new one')
        playerRef.current.dispose()
        playerRef.current = null
      } catch (e) {
        console.warn('Error disposing player:', e)
      }
    }

    let observer = null
    let initAttempts = 0
    const MAX_INIT_ATTEMPTS = 5
    let initTimer = null

    // Create a MutationObserver to detect when the video element is added to the DOM
    if (videoRef.current) {
      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // Check if our video element is now in the DOM
            const videoElement =
              videoRef.current.querySelector('video#video-player')
            if (videoElement) {
              console.log('Video element detected in DOM by observer')
              observer.disconnect()

              // Check if player is already initialized
              if (playerRef.current) {
                console.log(
                  'Player already initialized, skipping observer initialization'
                )
                return
              }

              // Initialize player now that we know the element exists
              const startPosition = lecture.savedProgress || 0
              console.log(
                'Starting player initialization from observer with position:',
                startPosition,
                'for lecture ID:',
                lecture.id
              )
              initializePlayer(lecture, startPosition)
              return
            }
          }
        }
      })

      // Start observing the container for DOM changes
      observer.observe(videoRef.current, { childList: true, subtree: true })
    }

    // Function to attempt player initialization with retry logic
    const attemptInitialization = () => {
      initAttempts++
      // Check if video element exists before trying to initialize
      if (
        videoRef.current &&
        videoRef.current.querySelector('video#video-player')
      ) {
        // Initialize the player with the lecture data
        const startPosition = lecture.savedProgress || 0
        console.log(
          'Starting player initialization with position:',
          startPosition
        )
        initializePlayer(lecture, startPosition)
      } else if (initAttempts < MAX_INIT_ATTEMPTS) {
        // Try again with exponential backoff
        const delay = Math.min(500 * Math.pow(1.5, initAttempts - 1), 3000)
        console.log(
          `Video element not found, retrying in ${delay}ms (attempt ${initAttempts}/${MAX_INIT_ATTEMPTS})`
        )
        initTimer = setTimeout(attemptInitialization, delay)
      } else {
        console.error(
          `Failed to find video element after ${MAX_INIT_ATTEMPTS} attempts`
        )
      }
    }

    // Add a small delay to ensure the DOM is fully rendered before initializing the player
    initTimer = setTimeout(attemptInitialization, 200)

    // Return cleanup function
    return () => {
      console.log('Player effect cleanup - disposing player')
      if (playerRef.current) {
        try {
          playerRef.current.dispose()
          playerRef.current = null
        } catch (e) {
          console.warn('Error disposing player in cleanup:', e)
        }
      }

      // Clean up observer if it exists
      if (observer) {
        observer.disconnect()
      }

      // Clear the initialization timer
      if (initTimer) {
        clearTimeout(initTimer)
      }

      // Clear any intervals
      if (saveInterval) {
        clearInterval(saveInterval)
        setSaveInterval(null)
      }
    }
  }, [lecture, loading, error])

  // Get all lectures for this course to enable next/prev navigation
  const navigateToLecture = async (direction) => {
    if (!lecture || !lecture.courseId) {
      console.error('No lecture or courseId available for navigation')
      return
    }

    try {
      // Load course data if needed
      const courseData =
        course || (await CourseManager.getCourseDetails(lecture.courseId))
      if (!courseData || !courseData.sections) {
        console.error('Could not load course data for navigation')
        return
      }

      // Flatten all lectures from all sections
      let allLectures = []
      courseData.sections.forEach((section) => {
        if (section.lectures) {
          allLectures.push(...section.lectures)
        }
      })

      // Sort lectures by section index and lecture index
      allLectures.sort((a, b) => {
        const sectionA = courseData.sections.find((s) => s.id === a.sectionId)
        const sectionB = courseData.sections.find((s) => s.id === b.sectionId)

        if (!sectionA || !sectionB) return 0

        if (sectionA.index !== sectionB.index) {
          return sectionA.index - sectionB.index
        }

        return a.index - b.index
      })

      console.log(
        'All sorted lectures:',
        allLectures.map((l) => l.title)
      )

      // Find current lecture index
      const currentIndex = allLectures.findIndex((l) => l.id === lecture.id)
      console.log('Current lecture index:', currentIndex, 'ID:', lecture.id)

      if (currentIndex === -1) {
        console.error('Current lecture not found in the course')
        return
      }

      // Determine target lecture
      let targetIndex = currentIndex
      if (direction === 'next') {
        targetIndex = Math.min(currentIndex + 1, allLectures.length - 1)
      } else if (direction === 'prev') {
        targetIndex = Math.max(currentIndex - 1, 0)
      }

      // Don't navigate if we're already at the start/end
      if (targetIndex === currentIndex) {
        console.log(
          `Already at the ${
            direction === 'next' ? 'end' : 'beginning'
          } of the course`
        )
        return
      }

      // Save progress before navigating
      if (
        playerRef.current &&
        typeof playerRef.current.currentTime === 'function'
      ) {
        try {
          // Save current progress
          await ProgressManager.saveProgress(
            lecture.id,
            playerRef.current.currentTime()
          )
        } catch (err) {
          console.error('Error saving progress:', err)
        }
      }

      // Clean up any intervals to prevent memory leaks
      if (saveInterval) {
        clearInterval(saveInterval)
        setSaveInterval(null)
      }

      const targetLecture = allLectures[targetIndex]
      console.log(`Navigating to ${direction} lecture:`, targetLecture.title)

      // Use state to force unmount of video player component
      setLoading(true) // Show loading state

      // Use a small timeout to ensure React has time to process state change
      setTimeout(() => {
        // Navigate to the target lecture
        navigate(`/watch/${targetLecture.id}`)
      }, 50)
    } catch (error) {
      console.error('Error navigating to lecture:', error)
    }
  }

  // Render mini lecture item
  const renderMiniLectureItem = (miniLecture) => {
    const isActive = miniLecture.id === parseInt(lectureId)
    const isCompleted = miniLecture.completed

    return (
      <div
        key={miniLecture.id}
        className={`mini-lecture-item ${isActive ? 'active' : ''} ${
          isCompleted ? 'completed' : ''
        }`}
        onClick={() => navigate(`/watch/${miniLecture.id}`)}
      >
        <div className='mini-lecture-status'>
          {isActive ? '▶' : isCompleted ? '✓' : '○'}
        </div>
        <div className='mini-lecture-info'>
          <div className='mini-lecture-title'>{miniLecture.title}</div>
          <div className='mini-lecture-section'>{miniLecture.sectionTitle}</div>
        </div>
      </div>
    )
  }

  // Add this function to handle keyboard shortcuts
  const setupKeyboardShortcuts = (player) => {
    const handleKeyDown = (event) => {
      // Only process if player exists and is ready
      if (!player || !document.activeElement) return

      // Skip if we're in an input field or textarea
      if (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA'
      ) {
        return
      }

      switch (event.key) {
        case ' ': // Spacebar - toggle play/pause
          event.preventDefault()
          if (player.paused()) {
            player.play()
          } else {
            player.pause()
          }
          break
        case 'ArrowLeft': // Left arrow - seek backward 5 seconds
          event.preventDefault()
          player.currentTime(Math.max(0, player.currentTime() - 5))
          break
        case 'ArrowRight': // Right arrow - seek forward 5 seconds
          event.preventDefault()
          player.currentTime(player.currentTime() + 5)
          break
        case 'f': // f - toggle fullscreen
          event.preventDefault()
          if (player.isFullscreen()) {
            player.exitFullscreen()
          } else {
            player.requestFullscreen()
          }
          break
        case '<':
        case ',': // < or , - previous lecture (standard video player convention)
          event.preventDefault()
          navigateToLecture('prev')
          break
        case '>':
        case '.': // > or . - next lecture (standard video player convention)
          event.preventDefault()
          navigateToLecture('next')
          break
        default:
          break
      }
    }

    // Add keyboard event listener
    document.addEventListener('keydown', handleKeyDown)

    // Return cleanup function
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }

  if (loading) {
    return <div className='loading'>Loading video...</div>
  }

  if (error) {
    return (
      <div className='error-container'>
        <h2>Error</h2>
        <p>{error}</p>
        {lecture && lecture.filePath && (
          <>
            <p>
              <b>Video file path:</b> {lecture.filePath}
            </p>
            {lecture.videoUrl && (
              <p>
                <b>Video URL:</b> {lecture.videoUrl}
              </p>
            )}
          </>
        )}
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    )
  }

  return (
    <div className='video-player-container'>
      {/* Video player always on top */}
      <div
        key={`video-${lecture?.id}`}
        className='video-container'
        ref={videoRef}
      >
        <video
          id='video-player'
          className='video-js vjs-big-play-centered'
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* All content below the video */}
      <div className='player-content'>
        {/* New compact header section */}
        <div className='player-header-collapsed'>
          {lecture && (
            <>
              <h1 className='lecture-title-top'>{lecture.title}</h1>
              {course && (
                <div className='course-header-row'>
                  <div className='course-title'>
                    <strong>Course:</strong> {course.title}
                  </div>
                  <button
                    className='back-to-course-btn'
                    onClick={() => navigate(`/course/${lecture.courseId}`)}
                    title='Back to Course'
                  >
                    ← Back to Course
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Player body with two-column layout for larger screens */}
        <div className='player-body'>
          {/* Video info column */}
          <div className='video-info'>
            <div className='video-info-section'>
              <h3>Lecture Status</h3>
              {lecture && (
                <>
                  <div className='video-progress-info'>
                    {lecture.completed ? (
                      <span className='completion-status completed'>
                        <span className='status-icon'>✓</span> Completed
                      </span>
                    ) : lecture.savedProgress && lecture.savedProgress > 0 ? (
                      <span className='completion-status in-progress'>
                        <span className='status-icon'>▶</span> In Progress
                      </span>
                    ) : (
                      <span className='completion-status not-started'>
                        <span className='status-icon'>○</span> Not Started
                      </span>
                    )}
                  </div>
                  <button
                    className={`mark-complete-button ${
                      lecture.completed ? 'completed' : ''
                    }`}
                    onClick={async () => {
                      if (lecture) {
                        await ProgressManager.markLectureWatched(
                          lecture.id,
                          !lecture.completed
                        )
                        setLecture({
                          ...lecture,
                          completed: !lecture.completed,
                        })

                        // If marking as complete, trigger navigation to next lecture
                        if (!lecture.completed) {
                          navigateToLecture('next')
                        }
                      }
                    }}
                  >
                    {lecture.completed
                      ? 'Mark as Incomplete'
                      : 'Mark as Completed'}
                  </button>

                  {lecture.savedProgress > 0 && (
                    <button
                      className='reset-position-button'
                      onClick={() => {
                        console.log('Reset to Beginning clicked')

                        if (playerRef.current) {
                          try {
                            // Simply set the current time to 0
                            playerRef.current.currentTime(0)

                            // Update the database
                            ProgressManager.saveProgress(
                              lecture.id,
                              0,
                              lecture.completed
                            )

                            // Play the video
                            playerRef.current.play()

                            console.log('Successfully reset video to beginning')
                          } catch (error) {
                            console.error('Error resetting video:', error)
                          }
                        } else {
                          console.warn('Player not available for reset')
                        }
                      }}
                    >
                      Reset to Beginning
                    </button>
                  )}
                </>
              )}
            </div>

            <div className='video-info-section'>
              <h3>Details</h3>
              {lecture && (
                <>
                  <p>
                    <strong>Lecture:</strong> {lecture.title}
                  </p>
                  {course && (
                    <p>
                      <strong>Course:</strong> {course.title}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Mini course view section - will be a sidebar on larger screens */}
          <div className='mini-course-view'>
            <h3 className='mini-course-title'>Course Contents</h3>
            <div className='mini-lectures-list'>
              {nearbyLectures.map(renderMiniLectureItem)}
            </div>
          </div>
        </div>

        {/* Keyboard shortcuts guide */}
        <div className='keyboard-shortcuts'>
          <h3>Navigation</h3>
          <div className='keyboard-shortcuts-grid'>
            <div>
              <strong>Space</strong> - Play/Pause
            </div>
            <div>
              <strong>←/→</strong> - Seek 5s
            </div>
            <div>
              <strong>f</strong> - Fullscreen
            </div>
            <div>
              <strong>,/.</strong> - Previous/Next
            </div>
            <div>
              <strong>Click L/R</strong> - Previous/Next
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoPlayer
