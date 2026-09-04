export const MOVIES = [
  { id: "dune2", title: "Dune: Part Two", year: 2024, genre: "Sci-Fi Epic", runtime: "2h 46m", emoji: "🏜️", blurb: "Sandworms, prophecy, and Zendaya being rightly unimpressed.", from: "from-amber-500", to: "to-orange-700" },
  { id: "everything", title: "Everything Everywhere All at Once", year: 2022, genre: "Absurdist Sci-Fi", runtime: "2h 19m", emoji: "🥯", blurb: "Multiverse chaos that somehow ends in a hug.", from: "from-fuchsia-500", to: "to-indigo-700" },
  { id: "knives", title: "Knives Out", year: 2019, genre: "Whodunnit", runtime: "2h 10m", emoji: "🔪", blurb: "Rich family, one dead patriarch, one absurd accent.", from: "from-emerald-500", to: "to-teal-800" },
  { id: "lalaland", title: "La La Land", year: 2016, genre: "Musical Romance", runtime: "2h 8m", emoji: "🎹", blurb: "Gorgeous, jazzy, and emotionally devastating.", from: "from-violet-500", to: "to-sky-700" },
  { id: "getout", title: "Get Out", year: 2017, genre: "Horror Thriller", runtime: "1h 44m", emoji: "🫖", blurb: "The most stressful weekend at the in-laws ever filmed.", from: "from-rose-600", to: "to-neutral-900" },
  { id: "spiderverse", title: "Across the Spider-Verse", year: 2023, genre: "Animation", runtime: "2h 20m", emoji: "🕸️", blurb: "Every frame is a poster. Every poster slaps.", from: "from-pink-500", to: "to-cyan-700" },
  { id: "past-lives", title: "Past Lives", year: 2023, genre: "Quiet Romance", runtime: "1h 45m", emoji: "🌙", blurb: "Bring tissues. Genuinely, bring tissues.", from: "from-sky-500", to: "to-blue-800" },
  { id: "mad-max", title: "Mad Max: Fury Road", year: 2015, genre: "Action", runtime: "2h", emoji: "🔥", blurb: "Two hours of one car chase. Perfect film.", from: "from-orange-500", to: "to-red-800" },
  { id: "parasite", title: "Parasite", year: 2019, genre: "Dark Comedy", runtime: "2h 12m", emoji: "🪜", blurb: "Starts funny. Does not stay funny.", from: "from-lime-500", to: "to-emerald-900" },
  { id: "notting-hill", title: "Notting Hill", year: 1999, genre: "Rom-Com", runtime: "2h 4m", emoji: "📚", blurb: "Just a girl, standing in front of a boy, etc.", from: "from-rose-400", to: "to-fuchsia-700" },
  { id: "arrival", title: "Arrival", year: 2016, genre: "Cerebral Sci-Fi", runtime: "1h 56m", emoji: "🛸", blurb: "Aliens land. Linguistics saves the day.", from: "from-slate-500", to: "to-indigo-900" },
  { id: "grand-budapest", title: "The Grand Budapest Hotel", year: 2014, genre: "Comedy", runtime: "1h 39m", emoji: "🛎️", blurb: "Symmetrical, pink, and extremely quotable.", from: "from-pink-400", to: "to-rose-700" },
  { id: "top-gun", title: "Top Gun: Maverick", year: 2022, genre: "Action", runtime: "2h 11m", emoji: "✈️", blurb: "Sincerely great popcorn cinema. No notes.", from: "from-cyan-500", to: "to-blue-900" },
  { id: "anatomy", title: "Anatomy of a Fall", year: 2023, genre: "Courtroom Drama", runtime: "2h 31m", emoji: "⚖️", blurb: "You will argue about the verdict afterwards.", from: "from-stone-500", to: "to-neutral-900" },
  { id: "barbie", title: "Barbie", year: 2023, genre: "Comedy", runtime: "1h 54m", emoji: "🎀", blurb: "Hot pink existential crisis.", from: "from-pink-500", to: "to-rose-600" },
  { id: "whiplash", title: "Whiplash", year: 2014, genre: "Drama", runtime: "1h 47m", emoji: "🥁", blurb: "Not quite my tempo.", from: "from-amber-500", to: "to-neutral-900" },
  { id: "the-menu", title: "The Menu", year: 2022, genre: "Satire Thriller", runtime: "1h 47m", emoji: "🍽️", blurb: "Tasting menu goes very, very wrong.", from: "from-teal-500", to: "to-slate-900" },
  { id: "in-bruges", title: "In Bruges", year: 2008, genre: "Dark Comedy", runtime: "1h 47m", emoji: "🏰", blurb: "Hitmen on an enforced city break.", from: "from-indigo-500", to: "to-slate-800" },
  { id: "moonrise", title: "Moonrise Kingdom", year: 2012, genre: "Indie Romance", runtime: "1h 34m", emoji: "⛺", blurb: "Twee runaway kids, gloriously so.", from: "from-yellow-500", to: "to-emerald-800" },
  { id: "sicario", title: "Sicario", year: 2015, genre: "Crime Thriller", runtime: "2h 1m", emoji: "🌵", blurb: "Tense enough to bruise the sofa.", from: "from-orange-600", to: "to-stone-900" },
  { id: "amelie", title: "Amélie", year: 2001, genre: "Whimsical Romance", runtime: "2h 2m", emoji: "🍨", blurb: "Parisian daydream with a garden gnome subplot.", from: "from-red-500", to: "to-green-800" },
  { id: "no-country", title: "No Country for Old Men", year: 2007, genre: "Neo-Western", runtime: "2h 2m", emoji: "🪙", blurb: "Call it, friendo.", from: "from-amber-600", to: "to-stone-900" },
];

/** Deterministic shuffle so both devices see the same deck order from the room code. */
export function deckForRoom(roomCode) {
  let seed = 2166136261;
  for (const ch of String(roomCode)) {
    seed ^= ch.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }

  const next = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 100000) / 100000;
  };

  const deck = [...MOVIES];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
