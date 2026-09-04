const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

async function tmdbFetch(path, params = {}) {
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set("api_key", process.env.TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TMDB request failed: ${res.status}`);
  return res.json();
}

function formatRuntime(minutes) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Fetches the current popular-movies page and enriches each entry with runtime + genre name. */
export async function getPopularMovies(page = 1) {
  const [{ results }, { genres }] = await Promise.all([
    tmdbFetch("/movie/popular", { page }),
    tmdbFetch("/genre/movie/list"),
  ]);
  const genreById = new Map(genres.map((g) => [g.id, g.name]));

  const details = await Promise.all(
    results.map((movie) => tmdbFetch(`/movie/${movie.id}`).catch(() => null))
  );

  return results.map((movie, i) => ({
    id: `tmdb-${movie.id}`,
    title: movie.title,
    year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
    genre: genreById.get(movie.genre_ids[0]) || "Movie",
    runtime: formatRuntime(details[i]?.runtime),
    blurb: movie.overview?.length > 140 ? `${movie.overview.slice(0, 137)}...` : movie.overview,
    posterUrl: movie.poster_path ? IMAGE_BASE + movie.poster_path : null,
    voteAverage: movie.vote_average,
  }));
}
