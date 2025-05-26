import React, { useState, useEffect } from 'react';

const ElectronTest = () => {
  const [electronStatus, setElectronStatus] = useState('Checking...');
  const [apiDetails, setApiDetails] = useState({});

  useEffect(() => {
    // Check if Electron API is available
    if (window.electronAPI) {
      setElectronStatus('Available');
      
      // Get list of available methods
      const methods = {};
      for (const key in window.electronAPI) {
        methods[key] = typeof window.electronAPI[key];
      }
      setApiDetails(methods);
      
      // Test a simple IPC call if possible
      if (typeof window.electronAPI.invoke === 'function') {
        window.electronAPI.invoke('check-file-exists', '/tmp')
          .then(result => console.log('IPC test result:', result))
          .catch(err => console.error('IPC test error:', err));
      }
    } else {
      setElectronStatus('Not Available');
      
      // Log available window properties for debugging
      console.log('Window properties:', Object.keys(window));
    }
  }, []);

  console.log('ElectronTest component rendering, status:', electronStatus);
  console.log('Window API check:', window.electronAPI ? 'Available' : 'Not Available');
  
  return (
    <div className="electron-test">
      <h2>Electron API Test</h2>
      <p>Status: <strong>{electronStatus}</strong></p>
      
      {electronStatus === 'Available' ? (
        <div>
          <h3>Available Methods:</h3>
          <pre>{JSON.stringify(apiDetails, null, 2)}</pre>
        </div>
      ) : (
        <p>The Electron API is not available in this context. Make sure:</p>
      )}
      
      <ul>
        <li>The preload script is correctly configured</li>
        <li>You're running in Electron, not in a browser</li>
        <li>The contextBridge is exposing 'electronAPI' to the window</li>
      </ul>
      
      <button 
        onClick={() => {
          if (window.electronAPI?.invoke) {
            window.electronAPI.invoke('select-directory')
              .then(dir => alert(`Selected directory: ${dir || 'None'}`))
              .catch(err => alert(`Error: ${err.message}`));
          } else {
            alert('Electron API not available');
          }
        }}
      >
        Test Directory Selection
      </button>
    </div>
  );
};

export default ElectronTest;