#!/usr/bin/env node

/**
 * Udemy Media Player - Electron Main Process
 * This file is the entry point for the Electron application.
 */

// Import required modules
const { app, BrowserWindow, dialog, ipcMain, protocol } = require("electron");
const path = require("path");
const fs = require("fs");
const url = require("url");
const { createReadStream } = require("fs");
const { stat } = require("fs/promises");
const mime = require("mime-types"); // Add this package: npm install mime-types

// Environment variables
const isDev = process.env.NODE_ENV === "development";

// Suppress Electron security warnings in development
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true;

// Need to register protocol privileges early - must be called before app is ready
// This must be outside any app.whenReady() call
protocol.registerSchemesAsPrivileged([
  {
    scheme: "localvideo",
    privileges: {
      standard: true,
      supportFetchAPI: true,
      secure: true,
      stream: true, // Allow streaming
      bypassCSP: true,
      allowServiceWorkers: true,
      corsEnabled: true,
    },
  },
  {
    scheme: "media",
    privileges: {
      standard: true,
      supportFetchAPI: true,
      secure: true,
      stream: true, // Allow streaming
      bypassCSP: true,
      allowServiceWorkers: true,
      corsEnabled: true,
    },
  },
]);

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

/**
 * Create the main application window
 */
function createWindow() {
  console.log("Creating window...");

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, "../../build/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, isDev ? "preload.js" : "preload.js"), // We'll use the JS version that gets compiled from TS
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      // Disable web security in development mode only
      // This is needed for local video playback to work
      webSecurity: process.env.NODE_ENV !== "development",
      allowRunningInsecureContent: process.env.NODE_ENV === "development",
      // Enable these features for better media handling
      webviewTag: true,
      plugins: true,
    },
  });

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    const serverUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
    console.log(`Loading from dev server: ${serverUrl}`);
    mainWindow.loadURL(serverUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    const indexPath = path.join(__dirname, "../../dist/index.html");
    console.log(`Loading from: ${indexPath}`);
    mainWindow.loadFile(indexPath);
  }

  // Log when window is ready
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Window content loaded successfully");
  });

  // Handle window being closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * Set up IPC handlers for communication with renderer
 */
function setupIpcHandlers() {
  console.log("Setting up IPC handlers...");

  // Handle directory selection
  ipcMain.handle("select-directory", async () => {
    console.log("Select directory handler called");
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
      });

      console.log("Dialog result:", result);
      return result.canceled ? null : result.filePaths[0];
    } catch (error) {
      console.error("Error in directory selection:", error);
      return null;
    }
  });

  // Handle directory scanning
  ipcMain.handle("scan-directory", async (event, dirPath) => {
    console.log("Scanning directory:", dirPath);

    try {
      const files = [];
      const scanDir = (dir) => {
        const entries = fs.readdirSync(dir);

        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          try {
            const stats = fs.statSync(fullPath);

            if (stats.isDirectory()) {
              scanDir(fullPath);
            } else {
              files.push({
                name: entry,
                path: fullPath,
                size: stats.size,
                mtime: stats.mtime,
              });
            }
          } catch (err) {
            console.error(`Error accessing ${fullPath}:`, err);
          }
        }
      };

      scanDir(dirPath);
      console.log(`Found ${files.length} files in ${dirPath}`);

      return { files, basePath: dirPath };
    } catch (error) {
      console.error("Error scanning directory:", error);
      return { files: [], basePath: dirPath };
    }
  });

  // Handle file existence check
  ipcMain.handle("check-file-exists", (event, filePath) => {
    console.log("Checking if file exists:", filePath);
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      console.error("Error checking file existence:", error);
      return false;
    }
  });

  // Get a video file URL that works with Electron's security model
  ipcMain.handle("get-video-file-url", (event, filePath) => {
    console.log("Creating video file URL for:", filePath);
    try {
      if (!fs.existsSync(filePath)) {
        console.error("Video file does not exist:", filePath);
        return null;
      }

      // Create a properly formatted file URL
      // This is a crucial step for macOS compatibility
      const fileUrl = url.format({
        pathname: path.normalize(filePath),
        protocol: "file:",
        slashes: true,
      });

      console.log("Generated file URL:", fileUrl);
      return fileUrl;
    } catch (error) {
      console.error("Error creating video file URL:", error);
      return null;
    }
  });

  // Settings storage
  const settingsPath = path.join(app.getPath("userData"), "settings.json");

  // Get user settings
  ipcMain.handle("get-settings", () => {
    try {
      if (fs.existsSync(settingsPath)) {
        const settingsData = fs.readFileSync(settingsPath, "utf8");
        return JSON.parse(settingsData);
      }
      return {}; // Default empty settings
    } catch (error) {
      console.error("Error reading settings:", error);
      return {};
    }
  });

  // Save user settings
  ipcMain.handle("save-settings", (event, settings) => {
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      return true;
    } catch (error) {
      console.error("Error saving settings:", error);
      return false;
    }
  });

  console.log("IPC handlers set up successfully");
}

// Register a custom protocol for video streaming
function registerVideoProtocol() {
  console.log("Registering custom video protocol handler...");

  // Register the protocol handler using registerStreamProtocol (compatible with older Electron versions)
  protocol.registerStreamProtocol("localvideo", async (request, callback) => {
    try {
      // Extract the file path from the URL
      const filePath = decodeURIComponent(request.url.replace("localvideo://", ""));
      console.log("Custom protocol request for:", filePath);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error("File not found:", filePath);
        callback({
          statusCode: 404,
          headers: { "Content-Type": "text/plain" },
          data: Buffer.from("File not found"),
        });
        return;
      }

      // Get file stats
      const stats = await stat(filePath);

      // Determine MIME type
      const mimeType = mime.lookup(filePath) || "video/mp4";
      console.log("Serving file with MIME type:", mimeType);

      // Create a readable stream from the file
      const fileStream = fs.createReadStream(filePath);

      // Setup response headers
      const headers = {
        "Content-Type": mimeType,
        "Content-Length": stats.size.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      };

      // Send the stream
      callback({
        statusCode: 200,
        headers: headers,
        data: fileStream,
      });
    } catch (error) {
      console.error("Error handling video protocol request:", error);
      callback({
        statusCode: 500,
        headers: { "Content-Type": "text/plain" },
        data: Buffer.from(`Error: ${error.message}`),
      });
    }
  });

  console.log("Custom video protocol registered successfully");
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  console.log("Electron app is ready");
  setupIpcHandlers();
  registerVideoProtocol();

  // Register a dedicated media protocol that works better with HTML5 video
  protocol.registerStreamProtocol("media", async (request, callback) => {
    console.log(">>> MEDIA PROTOCOL REQUEST RECEIVED:", request.url);
    console.log(">>> Request headers:", request.headers);
    try {
      // Extract the file path from the URL
      // media://video/?path=/path/to/file.mp4
      const urlObj = new URL(request.url);
      const urlParams = new URLSearchParams(urlObj.search);
      const filePath = decodeURIComponent(urlParams.get("path"));

      console.log("Media protocol handling file:", filePath);

      if (!fs.existsSync(filePath)) {
        console.error("Media file not found:", filePath);
        callback({
          statusCode: 404,
          headers: { "Content-Type": "text/plain" },
          data: Buffer.from("File not found"),
        });
        return;
      }

      // Get file stats for content length
      const stats = await stat(filePath);
      const fileSize = stats.size;

      // Determine content type based on file extension
      // Force correct video MIME types (mime-types package sometimes returns application/*)
      const ext = path.extname(filePath).toLowerCase();
      const videoMimeTypes = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mkv": "video/x-matroska",
        ".avi": "video/x-msvideo",
        ".mov": "video/quicktime",
        ".m4v": "video/mp4",
      };
      const mimeType = videoMimeTypes[ext] || mime.lookup(filePath) || "video/mp4";
      console.log("Serving file with MIME type:", mimeType, "Size:", fileSize);

      // Handle Range requests (for seeking and partial content)
      const rangeHeader = request.headers.Range || request.headers.range;

      if (rangeHeader) {
        // Parse the range header
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        console.log(`Range request: ${start}-${end}/${fileSize} (chunk: ${chunkSize})`);

        const fileStream = fs.createReadStream(filePath, { start, end });

        callback({
          statusCode: 206,
          headers: {
            "Content-Type": mimeType,
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize.toString(),
            "Cache-Control": "no-cache",
          },
          data: fileStream,
        });
      } else {
        // Regular request - send the whole file
        console.log("Full file request, size:", fileSize);
        const fileStream = fs.createReadStream(filePath);

        callback({
          statusCode: 200,
          headers: {
            "Content-Type": mimeType,
            "Content-Length": fileSize.toString(),
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
          },
          data: fileStream,
        });
      }
    } catch (error) {
      console.error("Error handling media protocol request:", error);
      callback({
        statusCode: 500,
        headers: { "Content-Type": "text/plain" },
        data: Buffer.from(`Error: ${error.message}`),
      });
    }
  });

  console.log("Media protocol handler registered");
  createWindow();
});

// Quit when all windows are closed (except on macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// On macOS, recreate window when dock icon is clicked
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Log any unhandled exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});
