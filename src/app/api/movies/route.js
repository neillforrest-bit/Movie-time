import { NextResponse } from 'next/server';
import { fetchTenMovies } from '@/lib/tmdb';

// Global server memory to persist room state
const globalRooms = global.flickRooms || {};
global.flickRooms = globalRooms;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code')?.toUpperCase();
  const room = globalRooms[code];
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  return NextResponse.json(room);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, code, role, selections } = body;

    if (action === 'CREATE') {
      const newCode = Math.random().toString(36).substring(2, 6).toUpperCase();
      const movies = await fetchTenMovies();
      globalRooms[newCode] = {
        code: newCode,
        phase: 0,
        movies: movies,
        survivingMovies: [],
        hostVetoes: [],
        guestVetoes: [],
        hostShortlist: [],
        guestShortlist: [],
        winner: null
      };
      return NextResponse.json(globalRooms[newCode]);
    }

    const room = globalRooms[code?.toUpperCase()];
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    if (action === 'SUBMIT_VETO') {
      if (role === 'host') room.hostVetoes = selections;
      if (role === 'guest') room.guestVetoes = selections;

      if (room.hostVetoes.length === 3 && room.guestVetoes.length === 3) {
        const allVetoes = new Set([...room.hostVetoes, ...room.guestVetoes]);
        let survivors = room.movies.filter(m => !allVetoes.has(m.id));
        
        if (survivors.length < 4) {
          const vetoedList = room.movies.filter(m => allVetoes.has(m.id));
          survivors = [...survivors, ...vetoedList.slice(0, 4 - survivors.length)];
        } else if (survivors.length > 4) {
          survivors = survivors.slice(0, 4);
        }

        room.survivingMovies = survivors;
        room.phase = 1;
      }
      return NextResponse.json(room);
    }

    if (action === 'SUBMIT_SHORTLIST') {
      if (role === 'host') room.hostShortlist = selections;
      if (role === 'guest') room.guestShortlist = selections;

      if (room.hostShortlist.length === 2 && room.guestShortlist.length === 2) {
        const guestSet = new Set(room.guestShortlist);
        const overlap = room.hostShortlist.filter(id => guestSet.has(id));

        let winningId = overlap[0];
        if (!winningId) {
          const allPicks = [...room.hostShortlist, ...room.guestShortlist];
          winningId = allPicks[Math.floor(Math.random() * allPicks.length)];
        }

        room.winner = room.survivingMovies.find(m => m.id === winningId) || room.survivingMovies[0];
        room.phase = 2;
      }
      return NextResponse.json(room);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}