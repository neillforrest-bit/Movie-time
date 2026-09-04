import { NextResponse } from "next/server";
import { getPopularMovies } from "@/lib/tmdb";

export const revalidate = 3600;

export async function GET() {
  try {
    const movies = await getPopularMovies();
    return NextResponse.json({ movies });
  } catch (err) {
    return NextResponse.json({ movies: [], error: err.message }, { status: 502 });
  }
}
