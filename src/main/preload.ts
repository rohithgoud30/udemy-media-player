// Preload script - runs in a privileged context
import { contextBridge, ipcRenderer } from 'electron'

// Defined type for our API to make it available in TypeScript
interface ElectronAPI {
  selectDirectory: () => Promise<string | null>
  scanDirectory: (
    dirPath: string
  ) => Promise<{ files: any[]; basePath: string }>
  checkFileExists: (filePath: string) => Promise<boolean>
  getVideoBlob: (filePath: string) => Promise<Blob>
  getVideoFileUrl: (filePath: string) => Promise<string | null>
  getSettings: () => Promise<any>
  saveSettings: (settings: any) => Promise<void>
  invoke: (channel: string, ...args: any[]) => Promise<any>
  getAppVersion: () => string
}

// Helper function exports that can be used elsewhere
export const checkFileExists = (filePath: string): Promise<boolean> => {
  console.log('Helper: Checking if file exists:', filePath)
  return ipcRenderer.invoke('check-file-exists', filePath)
}

export const getVideoFileUrl = (filePath: string): Promise<string | null> => {
  console.log('Helper: Getting secure video URL for:', filePath)
  return ipcRenderer.invoke('get-video-file-url', filePath)
}

// Log to show preload script is running
console.log('Preload script is running')

// Expose a limited API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations
  selectDirectory: () => {
    console.log('Calling select-directory IPC')
    return ipcRenderer.invoke('select-directory')
  },

  scanDirectory: (dirPath: string) => {
    console.log('Calling scan-directory IPC with path:', dirPath)
    return ipcRenderer.invoke('scan-directory', dirPath)
  },

  checkFileExists: (filePath: string) => {
    console.log('Checking if file exists:', filePath)
    return ipcRenderer.invoke('check-file-exists', filePath)
  },

  // Video file handling
  getVideoBlob: async (filePath: string) => {
    console.log('Getting video blob for:', filePath)
    return ipcRenderer.invoke('get-video-blob', filePath)
  },

  // Get a video file URL that can be used in the renderer
  getVideoFileUrl: (filePath: string) => {
    console.log('Getting secure video URL for:', filePath)
    return ipcRenderer.invoke('get-video-file-url', filePath)
  },

  // Settings operations
  getSettings: () => {
    return ipcRenderer.invoke('get-settings')
  },

  saveSettings: (settings: any) => {
    return ipcRenderer.invoke('save-settings', settings)
  },

  // Standard invoke method for any valid channel
  invoke: (channel: string, ...args: any[]) => {
    const validChannels = [
      'select-directory',
      'scan-directory',
      'check-file-exists',
      'get-video-blob',
      'get-video-file-url',
      'get-settings',
      'save-settings',
    ]
    if (validChannels.includes(channel)) {
      console.log(`Invoking ${channel} with args:`, args)
      return ipcRenderer.invoke(channel, ...args)
    } else {
      console.error(`Attempted to use invalid channel: ${channel}`)
      return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`))
    }
  },

  // Utility to get the app version
  getAppVersion: () => {
    try {
      // Try to get package.json version if available
      const pkg = require('../package.json')
      return pkg.version
    } catch (error) {
      console.error('Error getting app version:', error)
      return '1.0.0' // Fallback version
    }
  },
} as ElectronAPI)

// Log when preload script is complete
console.log('Preload script finished setting up API')

// For TypeScript support, declare the API in the global window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
