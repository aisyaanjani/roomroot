import './App.css'

function App() {
  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: '#F7F5EF',
      padding: '80px 24px',
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#46634B', fontSize: '52px' }}>
        RoomRoot 🌱
      </h1>

      <h2 style={{ color: '#333' }}>
        A home starts with connection.
      </h2>

      <p style={{ color: '#666', fontSize: '18px' }}>
        Making affordable shared housing more accessible
        through AI-powered lifestyle compatibility.
      </p>

      <button style={{
        backgroundColor: '#46634B',
        color: 'white',
        padding: '14px 28px',
        border: 'none',
        borderRadius: '12px',
        marginTop: '24px',
        cursor: 'pointer'
      }}>
        Find Your Room
      </button>
    </main>
  )
}

export default App