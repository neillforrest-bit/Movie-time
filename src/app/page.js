'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [room, setRoom] = useState(null);
  const [role, setRole] = useState(null);
  const [inputCode, setInputCode] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Poll room state every 2 seconds safely
  useEffect(() => {
    if (!room?.code) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/room?code=${room.code}`);
        if (res.ok) {
          const text = await res.text();
          if (text) {
            const data = JSON.parse(text);
            setRoom(data);
            if (data.phase !== room.phase) {
              setSelectedIds([]);
              setSubmitted(false);
            }
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [room?.code, room?.phase]);

  const createRoom = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE' })
      });
      
      const text = await res.text(); 
      
      if (!res.ok) {
        let errorMessage = text;
        try {
           const parsedErr = JSON.parse(text);
           errorMessage = parsedErr.error || text;
        } catch(e) {} 
        
        alert(`Failed (${res.status}): ${errorMessage || 'Empty response from server. Check your terminal.'}`);
        setLoading(false);
        return;
      }

      const data = text ? JSON.parse(text) : null;
      if (!data) throw new Error("Server returned an empty success response.");

      setRoom(data);
      setRole('host');
    } catch (err) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!inputCode) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/room?code=${inputCode}`);
      const text = await res.text();
      
      if (!res.ok) {
        let errorMessage = text;
        try {
           const parsedErr = JSON.parse(text);
           errorMessage = parsedErr.error || text;
        } catch(e) {} 
        alert(`Failed to join (${res.status}): ${errorMessage || 'Room not found.'}`);
        setLoading(false);
        return;
      }

      const data = text ? JSON.parse(text) : null;
      setRoom(data);
      setRole('guest');
    } catch (err) {
      console.error(err);
      alert(`Error joining room: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id, max) => {
    if (submitted) return;
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else if (selectedIds.length < max) {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const submitAction = async (actionType) => {
    setSubmitted(true);
    try {
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          code: room.code,
          role: role,
          selections: selectedIds
        })
      });
    } catch (err) {
      console.error(err);
      setSubmitted(false);
      alert('Failed to submit choices.');
    }
  };

  // 1. Lobby View
  if (!room) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-3xl font-extrabold mb-8 tracking-tight">FlickSync 🎬</h1>
        <div className="w-full max-w-xs space-y-4">
          <button 
            onClick={createRoom} 
            disabled={loading}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-bold transition text-black"
          >
            {loading ? 'Starting...' : 'Create Room'}
          </button>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Room Code" 
              value={inputCode} 
              onChange={e => setInputCode(e.target.value.toUpperCase())}
              className="w-2/3 p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-center font-mono uppercase text-white"
            />
            <button 
              onClick={joinRoom}
              disabled={loading}
              className="w-1/3 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-bold transition text-white"
            >
              Join
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 2. Phase 0: The Purge (Veto 3)
  if (room.phase === 0) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white p-4 max-w-md mx-auto pb-24">
        <header className="text-center mb-6 pt-4">
          <span className="text-xs uppercase tracking-widest text-neutral-400 font-mono">Room: {room.code}</span>
          <h2 className="text-2xl font-bold mt-1">Phase 1: The Purge</h2>
          <p className="text-sm text-neutral-400 mt-1">Secretly tap 3 movies you refuse to watch.</p>
        </header>

        <div className="grid grid-cols-2 gap-3">
          {room.movies.map(m => {
            const isSelected = selectedIds.includes(m.id);
            return (
              <div 
                key={m.id} 
                onClick={() => toggleSelect(m.id, 3)}
                className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition ${isSelected ? 'border-red-500 ring-2 ring-red-500/50' : 'border-neutral-800'}`}
              >
                <img src={m.poster_path} alt={m.title} className="w-full h-56 object-cover" />
                {isSelected && (
                  <div className="absolute inset-0 bg-red-950/70 flex items-center justify-center font-extrabold text-red-400 text-lg">
                    VETOED
                  </div>
                )}
                <div className="p-2 bg-neutral-900 text-xs truncate font-medium">{m.title}</div>
              </div>
            );
          })}
        </div>

        <footer className="fixed bottom-0 left-0 right-0 p-4 bg-neutral-950/90 backdrop-blur border-t border-neutral-800 max-w-md mx-auto">
          <button 
            disabled={selectedIds.length !== 3 || submitted}
            onClick={() => submitAction('SUBMIT_VETO')}
            className={`w-full py-3 rounded-xl font-bold transition ${submitted ? 'bg-neutral-800 text-neutral-500' : selectedIds.length === 3 ? 'bg-red-500 text-white' : 'bg-neutral-800 text-neutral-500'}`}
          >
            {submitted ? 'Waiting for partner...' : `Lock in 3 Vetoes (${selectedIds.length}/3)`}
          </button>
        </footer>
      </main>
    );
  }

  // 3. Phase 1: The Shortlist (Pick 2)
  if (room.phase === 1) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white p-4 max-w-md mx-auto pb-24">
        <header className="text-center mb-6 pt-4">
          <span className="text-xs uppercase tracking-widest text-emerald-400 font-mono">Shortlist</span>
          <h2 className="text-2xl font-bold mt-1">Phase 2: Pick Two</h2>
          <p className="text-sm text-neutral-400 mt-1">Secretly pick your top 2 favorites from the survivors.</p>
        </header>

        <div className="grid grid-cols-2 gap-3">
          {room.survivingMovies.map(m => {
            const isSelected = selectedIds.includes(m.id);
            return (
              <div 
                key={m.id} 
                onClick={() => toggleSelect(m.id, 2)}
                className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition ${isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/50' : 'border-neutral-800'}`}
              >
                <img src={m.poster_path} alt={m.title} className="w-full h-56 object-cover" />
                {isSelected && (
                  <div className="absolute inset-0 bg-emerald-950/70 flex items-center justify-center font-extrabold text-emerald-400 text-lg">
                    PICKED ⭐
                  </div>
                )}
                <div className="p-2 bg-neutral-900 text-xs truncate font-medium">{m.title}</div>
              </div>
            );
          })}
        </div>

        <footer className="fixed bottom-0 left-0 right-0 p-4 bg-neutral-950/90 backdrop-blur border-t border-neutral-800 max-w-md mx-auto">
          <button 
            disabled={selectedIds.length !== 2 || submitted}
            onClick={() => submitAction('SUBMIT_SHORTLIST')}
            className={`w-full py-3 rounded-xl font-bold transition ${submitted ? 'bg-neutral-800 text-neutral-500' : selectedIds.length === 2 ? 'bg-emerald-500 text-black' : 'bg-neutral-800 text-neutral-500'}`}
          >
            {submitted ? 'Waiting for partner...' : `Lock in 2 Picks (${selectedIds.length}/2)`}
          </button>
        </footer>
      </main>
    );
  }

  // 4. Phase 2: The Final Reveal
  if (room.phase === 2 && room.winner) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-2">Tonight's Match</div>
        <div className="w-full max-w-xs rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-2xl bg-neutral-900">
          <img src={room.winner.poster_path} alt={room.winner.title} className="w-full h-96 object-cover" />
          <div className="p-5 text-left">
            <div className="flex justify-between items-baseline mb-2">
              <h2 className="text-xl font-bold leading-snug">{room.winner.title}</h2>
              <span className="text-xs text-neutral-400 ml-2">{room.winner.release_year}</span>
            </div>
            <p className="text-xs text-neutral-300 line-clamp-3 leading-relaxed">{room.winner.overview}</p>
          </div>
        </div>
        <button 
          onClick={() => setRoom(null)} 
          className="mt-6 text-xs text-neutral-500 underline"
        >
          Start New Session
        </button>
      </main>
    );
  }

  return null;
}