"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVideoFileUrl = exports.checkFileExists = void 0;
// Preload script - runs in a privileged context
const electron_1 = require("electron");
// Helper function exports that can be used elsewhere
const checkFileExists = (filePath) => {
    console.log('Helper: Checking if file exists:', filePath);
    return electron_1.ipcRenderer.invoke('check-file-exists', filePath);
};
exports.checkFileExists = checkFileExists;
const getVideoFileUrl = (filePath) => {
    console.log('Helper: Getting secure video URL for:', filePath);
    return electron_1.ipcRenderer.invoke('get-video-file-url', filePath);
};
exports.getVideoFileUrl = getVideoFileUrl;
// Log to show preload script is running
console.log('Preload script is running');
// Expose a limited API to the renderer process
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // File system operations
    selectDirectory: () => {
        console.log('Calling select-directory IPC');
        return electron_1.ipcRenderer.invoke('select-directory');
    },
    scanDirectory: (dirPath) => {
        console.log('Calling scan-directory IPC with path:', dirPath);
        return electron_1.ipcRenderer.invoke('scan-directory', dirPath);
    },
    checkFileExists: (filePath) => {
        console.log('Checking if file exists:', filePath);
        return electron_1.ipcRenderer.invoke('check-file-exists', filePath);
    },
    // Video file handling
    getVideoBlob: async (filePath) => {
        console.log('Getting video blob for:', filePath);
        return electron_1.ipcRenderer.invoke('get-video-blob', filePath);
    },
    // Get a video file URL that can be used in the renderer
    getVideoFileUrl: (filePath) => {
        console.log('Getting secure video URL for:', filePath);
        return electron_1.ipcRenderer.invoke('get-video-file-url', filePath);
    },
    // Settings operations
    getSettings: () => {
        return electron_1.ipcRenderer.invoke('get-settings');
    },
    saveSettings: (settings) => {
        return electron_1.ipcRenderer.invoke('save-settings', settings);
    },
    // Standard invoke method for any valid channel
    invoke: (channel, ...args) => {
        const validChannels = [
            'select-directory',
            'scan-directory',
            'check-file-exists',
            'get-video-blob',
            'get-video-file-url',
            'get-settings',
            'save-settings',
        ];
        if (validChannels.includes(channel)) {
            console.log(`Invoking ${channel} with args:`, args);
            return electron_1.ipcRenderer.invoke(channel, ...args);
        }
        else {
            console.error(`Attempted to use invalid channel: ${channel}`);
            return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
        }
    },
    // Utility to get the app version
    getAppVersion: () => {
        try {
            // Try to get package.json version if available
            const pkg = require('../package.json');
            return pkg.version;
        }
        catch (error) {
            console.error('Error getting app version:', error);
            return '1.0.0'; // Fallback version
        }
    },
});
// Log when preload script is complete
console.log('Preload script finished setting up API');
