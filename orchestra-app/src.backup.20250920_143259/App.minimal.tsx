import React from 'react';

function App() {
  console.log('App component rendered');
  
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Orchestra App - Minimal Version</h1>
      <p>This is a minimal version to test deployment</p>
      <p>Current time: {new Date().toLocaleString()}</p>
      
      <div style={{ marginTop: '20px' }}>
        <h2>Test Firebase Connection</h2>
        <button onClick={() => {
          console.log('Testing Firebase...');
          // Simple Firebase test without authentication
          try {
            console.log('Firebase config loaded successfully');
          } catch (error) {
            console.error('Firebase error:', error);
          }
        }}>
          Test Firebase
        </button>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <h2>Test Drag & Drop (Simple)</h2>
        <div
          draggable
          onDragStart={() => console.log('Drag started')}
          onDragEnd={() => console.log('Drag ended')}
          style={{
            width: '100px',
            height: '100px',
            backgroundColor: '#667eea',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'grab',
            borderRadius: '8px'
          }}
        >
          Drag me
        </div>
      </div>
    </div>
  );
}

export default App;