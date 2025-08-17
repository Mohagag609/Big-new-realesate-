// Required modules from Electron
const { app, BrowserWindow } = require('electron');
// Required Node.js modules
const path = require('path');
// Local backend server functions
const { startServer, stopServer } = require('./server.js');

// --- Database Configuration ---
// Define the path for the database.
// app.getPath('userData') is the recommended, cross-platform location
// for storing user-specific application data.
// On Windows, this will be something like: C:\Users\<user>\AppData\Roaming\my-app\app.db
const dbPath = path.join(app.getPath('userData'), 'app.db');


// Keep a global reference to the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

/**
 * Creates the main application window.
 */
function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // Security Best Practices:
      // - contextIsolation: true -> Ensures that your preload script and Electron's internal logic
      //   run in a separate context from the web content. This prevents the web content
      //   from accessing Electron's APIs directly.
      // - nodeIntegration: false -> Disables Node.js integration in the renderer process (your web page).
      //   This is crucial for security, as it prevents malicious scripts on a web page
      //   from having access to the user's file system and other OS resources.
      contextIsolation: true,
      nodeIntegration: false,
      // Note: A preload script is not needed here because the frontend will communicate
      // with the backend via standard HTTP requests (fetch), not Electron's IPC.
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile('index.html');

  // Open the DevTools (optional, useful for debugging)
  // mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object
    mainWindow = null;
  });
}

// --- Application Lifecycle ---

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  console.log('App is ready.');
  console.log(`Database will be stored at: ${dbPath}`);

  // Start the backend server before creating the window
  startServer(dbPath)
    .then(() => {
      console.log('Backend server started successfully.');
      // Once the server is running, create the application window
      createWindow();
    })
    .catch((err) => {
      // If the server fails to start, log the error and quit the app
      console.error('Failed to start backend server:', err);
      app.quit();
    });

  // On macOS, it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  console.log('All windows closed.');
  // Stop the server gracefully
  stopServer().then(() => {
    console.log('Backend server stopped.');
    // On macOS, applications and their menu bar stay active until the user quits
    // explicitly with Cmd + Q. On other platforms, we quit.
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }).catch(err => {
    console.error('Failed to stop server:', err);
    // Still quit the app even if server shutdown fails
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
});
