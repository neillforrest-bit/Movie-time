export async function fetchTenMovies() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error("TMDB_API_KEY is missing from environment.");

  // Fetch acclaimed, popular movies
  const randomPage = Math.floor(Math.random() * 5) + 1;
  const url = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&include_adult=false&vote_average.gte=7.2&vote_count.gte=800&page=${randomPage}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error("Failed to fetch from TMDB");

  const data = await res.json();
  
  // Shuffle and take exactly 10
  const shuffled = (data.results || []).sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 10).map((m) => ({
    id: m.id,
    title: m.title,
    overview: m.overview,
    poster_path: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
    rating: Math.round(m.vote_average * 10),
    release_year: m.release_date ? m.release_date.split('-')[0] : 'N/A'
  }));
}