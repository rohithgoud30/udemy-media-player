import React, { useEffect, useRef, useState, useCallback } from 'react'
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
  const [initialLoad, setInitialLoad] = useState(true)
  const [playerSettings, setPlayerSettings] = useState({
    defaultSpeed: 1.0,
    autoPlay: true,
    rememberPosition: true,
    autoMarkCompleted: true,
    autoPlayNext: true,
  })

  // Define navigateToLecture early using useCallback
  const navigateToLecture = useCallback(
    async (direction) => {
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

        // Save progress before navigating - with safety check
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

        // Clear session storage for the current lecture before navigation
        try {
          sessionStorage.removeItem(`video_pause_position_${lecture.id}`)
        } catch (e) {
          console.error('Error clearing sessionStorage during navigation:', e)
        }

        // Show loading state
        setLoading(true)

        // Thorough cleanup of player before navigation
        if (playerRef.current) {
          try {
            // Ensure player is paused first
            playerRef.current.pause()

            // Remove any video source to prevent old video from showing
            if (typeof playerRef.current.src === 'function') {
              playerRef.current.src({ src: '', type: '' })
            }

            // Dispose the player completely
            playerRef.current.dispose()
            playerRef.current = null

            console.log('Player successfully disposed before navigation')
          } catch (e) {
            console.warn('Error cleaning up player:', e)
          }
        }

        // Reset video element reference
        if (videoRef.current) {
          try {
            // Reset HTML to create a fresh video element container
            videoRef.current.innerHTML =
              '<video id="video-player" class="video-js vjs-big-play-centered"></video>'
          } catch (e) {
            console.warn('Error resetting video container:', e)
          }
        }

        // Direct navigation to the new lecture
        navigate(`/watch/${targetLecture.id}`)
      } catch (error) {
        console.error('Error navigating to lecture:', error)
        setLoading(false) // Reset loading state on error
      }
    },
    [lecture, course, playerRef, saveInterval, navigate]
  )

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

        // Always start from beginning if lecture is completed
        if (progress.watched === 1 && routeState.startPosition === undefined) {
          console.log('Lecture was completed, starting from beginning')
          savedPos = 0
        } else if (routeState.startPosition !== undefined) {
          // If specific position provided via routing, use that
          savedPos = routeState.startPosition
        } else if (progress.position > 0 && progress.watched !== 1) {
          // Only use stored position if not completed
          savedPos = progress.position
        }

        console.log(`Loading saved progress for lecture ${lectureData.id}:`, {
          routeStatePosition: routeState.startPosition,
          dbPosition: progress.position,
          isCompleted: progress.watched === 1,
          finalPosition: savedPos,
        })

        // Create lecture object with saved progress
        const lectureWithProgress = {
          ...lectureData,
          videoUrl: routeState.videoUrl || createVideoUrl(lectureData.filePath),
          savedProgress: savedPos,
          completed: progress.watched === 1,
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

  // Reset initialLoad flag when lecture ID changes
  useEffect(() => {
    setInitialLoad(true)

    return () => {
      // When unmounting, reset the initialLoad flag
      setInitialLoad(false)
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
    // Add playsinline attribute for mobile browsers (especially Safari)
    videoElement.setAttribute('playsinline', '')
    videoElement.setAttribute('webkit-playsinline', '') // For older iOS versions

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

    // Ensure audio is on by default
    videoElement.muted = false

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

    // Add ready event to ensure player is fully initialized
    player.on('ready', function () {
      console.log('Player is fully initialized and ready')
      // Re-assign player reference to ensure it's available after initialization
      playerRef.current = player

      // Safety check to ensure we're not trying to seek on a disposed player
      if (
        !playerRef.current ||
        typeof playerRef.current.currentTime !== 'function'
      ) {
        console.warn('Player was disposed before ready event could complete')
        return
      }

      // Make sure to set the correct time after player is ready
      if (effectiveSettings.rememberPosition && startPosition > 0) {
        console.log(
          `Seeking to saved position: ${startPosition} for lecture ID: ${lectureData.id}`
        )
        // Use a small timeout to ensure the player is fully ready
        setTimeout(() => {
          // Check if player still exists after timeout
          if (
            !playerRef.current ||
            typeof playerRef.current.currentTime !== 'function'
          ) {
            console.warn('Player was disposed during seek timeout')
            return
          }

          try {
            const currentPos = playerRef.current.currentTime() // Get current position before seeking
            console.log(`Current time before seeking: ${currentPos}`)
            playerRef.current.currentTime(startPosition)

            // Add a verification check to ensure the seek was successful
            setTimeout(() => {
              // Double-check player still exists
              if (
                !playerRef.current ||
                typeof playerRef.current.currentTime !== 'function'
              ) {
                console.warn('Player was disposed during verification timeout')
                return
              }

              try {
                const newPos = playerRef.current.currentTime()
                console.log(`Position after seeking: ${newPos}`)
                if (Math.abs(newPos - startPosition) > 0.5) {
                  console.warn(
                    'Seeking may not have worked correctly. Trying again...'
                  )
                  playerRef.current.currentTime(startPosition)
                }
              } catch (e) {
                console.warn('Error during position verification:', e)
              }
            }, 200)
          } catch (e) {
            console.warn('Error during initial seeking:', e)
          }
        }, 300)
      } else {
        // This case handles:
        // 1. Not completed, AND rememberPosition is false
        // 2. Not completed, AND startPosition is 0 (new video or reset)
        console.log(
          'Starting video from beginning (not completed, and either no saved position, startPosition is 0, or rememberPosition is disabled).'
        )
        player.currentTime(0) // Explicitly start at 0 for these cases too.
      }

      // Explicitly try to play the video and handle any autoplay restrictions
      if (effectiveSettings.autoPlay) {
        const playPromise = player.play()

        // Handle the play promise to catch any autoplay restrictions
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Auto-play successful')
            })
            .catch((error) => {
              console.warn('Auto-play prevented by browser:', error)
              // Autoplay with audio blocked; user must click to play audio
              player.play().catch((e) => {
                console.error('Play failed after autoplay block:', e)
              })
            })
        }
      }

      // Mark as not initial load anymore
      setInitialLoad(false)

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

    // Auto-navigation decision via timeupdate handling
    player.on('timeupdate', function () {
      try {
        const currentTime = player.currentTime()
        const duration = player.duration() || 0

        // Save the current position regularly as a backup
        if (!lectureData.completed) {
          player.lastKnownPosition = currentTime
        }

        // First check if we need to verify position during initial playback
        if (!player.positionVerified) {
          // Only verify position within first 3 seconds of playback
          const now = Date.now()
          if (
            player.playbackStartTime &&
            now - player.playbackStartTime <= 3000
          ) {
            // Verify position is correct
            if (Math.abs(currentTime - startPosition) > 0.5) {
              console.log(
                'Position check failed in timeupdate, correcting to:',
                startPosition
              )
              player.currentTime(startPosition)
            } else {
              console.log('Position verified in timeupdate')
              player.positionVerified = true
            }
          } else {
            // Time window for verification has passed
            player.positionVerified = true
          }
        }

        // Next handle end detection
        if (
          !player.endDetected &&
          duration > 0 &&
          duration - currentTime <= 0.5
        ) {
          console.log(
            'End detected via timeupdate, duration:',
            duration,
            'current:',
            currentTime
          )
          player.endDetected = true // Flag to prevent multiple triggers

          // Trigger our own ended logic
          if (effectiveSettings.autoMarkCompleted) {
            console.log('Auto-marking lecture as completed (via timeupdate)')
            // Always save position as 0 when completed
            ProgressManager.saveProgress(lectureData.id, 0, true)

            setLecture((prevLecture) => ({
              ...prevLecture,
              completed: true,
              savedProgress: 0,
            }))

            // Check if we should auto-navigate to next lecture
            const wasCompletedBefore = lectureData.completed
            const hadProgressBefore = lectureData.savedProgress > 0
            const settingEnabled = effectiveSettings.autoPlayNext

            console.log('Auto-navigation decision via timeupdate:', {
              wasCompletedBefore,
              hadProgressBefore,
              settingEnabled,
            })

            // Only auto-navigate if setting is enabled AND either:
            // 1. Lecture wasn't already completed, OR
            // 2. User explicitly started a completed lecture (meaning they want to see next)
            if (settingEnabled && (!wasCompletedBefore || !hadProgressBefore)) {
              console.log(
                'Auto-navigating to next lecture (timeupdate trigger)'
              )
              try {
                player.pause() // Ensure playback is paused

                // Use a separate flag to track if navigation is already in progress
                if (!player.navigationInProgress) {
                  player.navigationInProgress = true

                  // Simply navigate directly to the next lecture like the click handler does
                  navigateToLecture('next')
                }
              } catch (e) {
                console.error('Error during auto-navigation:', e)
              }
            } else {
              console.log(
                'Not auto-navigating: video was already completed, had progress, or setting is disabled'
              )
            }
          }
        }
      } catch (error) {
        console.error('Error in timeupdate handler:', error)
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
      // If lecture is completed, preserve completion and reset position to 0
      if (lectureData.completed) {
        console.log(
          'Lecture completed, ignoring pause event and ensuring it remains completed'
        )
        try {
          // Save progress as completed at position 0
          ProgressManager.saveProgress(lectureData.id, 0, true)
        } catch (e) {
          console.error('Error saving completed progress on pause:', e)
        }
        return
      }
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

        // If user has manually sought to a position, don't try to override it
        if (player.recentlySought) {
          console.log(
            'Respecting user seek position, not forcing resume position'
          )
          return
        }

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

    // Reset the endDetected flag when seeking
    player.on('seeking', function () {
      // Clear end detection flag when user seeks
      player.endDetected = false
      // If user is manually seeking, clear the pausedAt position
      player.pausedAt = undefined
      player.lastKnownPosition = undefined

      // Set a flag that user manually sought, which will prevent
      // play handler from forcing position
      player.recentlySought = true

      // Clear the flag after a short delay so that future play events
      // will work normally
      clearTimeout(player.seekTimeout)
      player.seekTimeout = setTimeout(() => {
        player.recentlySought = false
      }, 1000)

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
        if (effectiveSettings.autoMarkCompleted) {
          console.log('Auto-marking lecture as completed')
          // Always save position as 0 when completed, and force this in the database
          ProgressManager.saveProgress(lectureData.id, 0, true)

          // Update local state to reflect completion
          setLecture((prevLecture) => ({
            ...prevLecture,
            completed: true,
            savedProgress: 0, // Reset saved progress when completed
          }))

          // Rewind video to beginning after completion
          try {
            if (
              playerRef.current &&
              typeof playerRef.current.currentTime === 'function'
            ) {
              playerRef.current.currentTime(0)
            }
          } catch (e) {
            console.warn('Error rewinding video on ended:', e)
          }
        }

        // Auto-play next lecture if setting is enabled - removed initialLoad check
        if (effectiveSettings.autoPlayNext) {
          console.log('Auto-playing next video based on settings...')

          try {
            // Ensure playback is paused
            if (
              playerRef.current &&
              typeof playerRef.current.pause === 'function'
            ) {
              playerRef.current.pause()
            }

            // Use a separate flag to track if navigation is already in progress
            if (!player.navigationInProgress) {
              player.navigationInProgress = true

              // Simply navigate directly to the next lecture like click handler
              console.log('Directly navigating to next lecture (ended event)')
              navigateToLecture('next')
            }
          } catch (error) {
            console.error('Error during ended auto-navigation:', error)
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

          // For completed lectures, always ensure position is 0
          if (lectureData.completed) {
            // If the database shows completed but player is not at 0, update
            if (currentTime > 0.5) {
              console.log(
                'Completed lecture playing - ensuring position 0 is saved'
              )
              ProgressManager.saveProgress(lectureData.id, 0, true)
            }
          } else {
            // Always save the current position, even when paused
            // This provides an additional safety net for resuming playback
            ProgressManager.saveProgress(lectureData.id, currentTime)
          }

          // If the player is not paused (actively playing)
          if (!currentPlayer.paused()) {
            // Check if we should update the pausedAt value for extra safety
            // This ensures we always have the latest position even if pause event fails
            currentPlayer.lastKnownPosition = currentTime

            // Mark as completed if watched 98% of video
            if (
              effectiveSettings.autoMarkCompleted &&
              typeof currentPlayer.duration === 'function' &&
              currentTime > currentPlayer.duration() * 0.98 &&
              !lectureData.completed
            ) {
              console.log('Auto-marking lecture as completed (98% watched)')
              // Always save position as 0 when completed
              ProgressManager.saveProgress(lectureData.id, 0, true)
              setLecture({ ...lectureData, completed: true, savedProgress: 0 })

              // Don't navigate to next video during 98% completion
              // This prevents automatic skipping to next video when almost done
              // Let the user finish watching the video naturally
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

      // If component is unmounting, don't try to initialize
      if (!videoRef.current) {
        console.log('Video container no longer exists, aborting initialization')
        return
      }

      // Check if video element exists before trying to initialize
      // Try multiple different selector strategies to find the video element
      const videoElement =
        videoRef.current.querySelector('video#video-player') ||
        videoRef.current.querySelector('video') ||
        document.getElementById('video-player')

      if (videoElement) {
        console.log('Video element found, proceeding with initialization')
        // Initialize the player with the lecture data
        const startPosition = lecture.completed ? 0 : lecture.savedProgress || 0
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

  // Effect for handling click-to-navigate on the video player
  useEffect(() => {
    const videoContainer = videoRef.current
    const player = playerRef.current

    const handleClickToNavigate = (event) => {
      if (!player || player.isFullscreen()) {
        return
      }

      // Ensure the click is directly on the video container or the video element itself,
      // and not on the control bar elements.
      let targetElement = event.target
      let isControlBarClick = false
      while (targetElement && targetElement !== videoContainer) {
        if (targetElement.classList.contains('vjs-control-bar')) {
          isControlBarClick = true
          break
        }
        targetElement = targetElement.parentElement
      }

      if (isControlBarClick) {
        return // Do nothing if a control bar element was clicked
      }

      // Only proceed if the click was within the video container itself
      // and not on a control element that might be an overlay
      if (
        event.target !== videoContainer &&
        !event.target.classList.contains('vjs-tech') &&
        !event.target.classList.contains('video-js')
      ) {
        // Allow play/pause if clicking in the middle, even if not directly on vjs-tech
        const playerWidth = videoContainer.offsetWidth
        const clickX = event.offsetX
        const clickPercentage = (clickX / playerWidth) * 100
        if (clickPercentage >= 30 && clickPercentage <= 70) {
          // This is a click in the middle, let video.js handle it (play/pause)
        } else {
          return // Click was on some other UI element within the player, not the video content area
        }
      }

      const playerWidth = videoContainer.offsetWidth
      const clickX = event.offsetX
      const clickPercentage = (clickX / playerWidth) * 100

      if (clickPercentage < 30) {
        event.preventDefault()
        event.stopPropagation()
        navigateToLecture('prev')
      } else if (clickPercentage > 70) {
        event.preventDefault()
        event.stopPropagation()
        navigateToLecture('next')
      }
      // Middle 40% click is handled by video.js for play/pause
    }

    if (videoContainer && player) {
      videoContainer.addEventListener('click', handleClickToNavigate)
    }

    return () => {
      if (videoContainer) {
        videoContainer.removeEventListener('click', handleClickToNavigate)
      }
    }
  }, [playerRef.current, videoRef.current, navigateToLecture]) // Dependencies

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

  // Add effect to clean up navigation flags when unmounting
  useEffect(() => {
    return () => {
      // When component unmounts, clean up any navigation in progress
      if (playerRef.current) {
        try {
          playerRef.current.navigationInProgress = false

          if (typeof playerRef.current.dispose === 'function') {
            playerRef.current.dispose()
          }

          playerRef.current = null
        } catch (e) {
          console.warn('Error during cleanup:', e)
        }
      }
    }
  }, [])

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
                        // When marking as complete, always reset position to 0
                        if (!lecture.completed) {
                          await ProgressManager.saveProgress(
                            lecture.id,
                            0,
                            true
                          )

                          // Also update player position to 0 if available
                          if (
                            playerRef.current &&
                            typeof playerRef.current.currentTime === 'function'
                          ) {
                            playerRef.current.currentTime(0)
                          }

                          setLecture({
                            ...lecture,
                            completed: true,
                            savedProgress: 0,
                          })

                          // This is an explicit user action, so disable initialLoad protection
                          setInitialLoad(false)
                        } else {
                          // When marking as incomplete, save current position
                          let currentPos = 0
                          if (
                            playerRef.current &&
                            typeof playerRef.current.currentTime === 'function'
                          ) {
                            currentPos = playerRef.current.currentTime()
                          }
                          await ProgressManager.saveProgress(
                            lecture.id,
                            currentPos,
                            false
                          )

                          setLecture({
                            ...lecture,
                            completed: false,
                            savedProgress: currentPos,
                          })
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

                            // This is an explicit user action, so disable initialLoad protection
                            setInitialLoad(false)

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
