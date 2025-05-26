#!/usr/bin/env node

// Diagnostic electron app - create a minimal electron app to help diagnose the issue
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');

// Create a small window when the app is ready
app.whenReady().then(() => {
  console.log('Electron app is ready');
  
  // Create a window
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'main/preload.js'),
      contextIsolation: true
    }
  });
  
  // Set up a simple IPC handler for directory selection
  ipcMain.handle('select-directory', async () => {
    console.log('Select directory handler called');
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    console.log('Dialog result:', result);
    return result.canceled ? null : result.filePaths[0];
  });
  
  // Load a simple HTML page
  win.loadFile(path.join(__dirname, 'test-page.html'));
  win.webContents.openDevTools();
});

// Standard window handling for macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
