"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Check,
  Film,
  Heart,
  Loader2,
  LogIn,
  PartyPopper,
  RadioTower,
  RotateCcw,
  Share2,
  Unplug,
  Wifi,
  X,
} from "lucide-react";
import usePeerSync from "@/hooks/usePeerSync";
import { deckForRoom } from "@/lib/movies";

const encode = (obj) => JSON.stringify(obj);

function decode(payload) {
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export default function Home() {
  const {
    status,
    role,
    roomCode,
    messages,
    error,
    isConnected,
    host,
    join,
    enterRoom,
    send,
    clearMessages,
    disconnect,
  } = usePeerSync();

  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [roundStart, setRoundStart] = useState(0);

  // ?r=CODE turns the app into a fixed room: no code to type, just tap the link.
  const autoRoom = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("r")?.toUpperCase() ?? null,
    () => null
  );
  const enteredRef = useRef(false);
  useEffect(() => {
    if (!autoRoom || enteredRef.current) return;
    enteredRef.current = true;
    enterRoom(autoRoom);
  }, [autoRoom, enterRoom]);

  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );
  const inviteUrl = origin && roomCode ? `${origin}/?r=${roomCode}` : "";


  const isBusy = status === "hosting" || status === "connecting";
  const deck = useMemo(() => (roomCode ? deckForRoom(roomCode) : []), [roomCode]);

  const round = useMemo(() => {
    const decoded = messages.map((m) => ({ ...m, body: decode(m.payload) }));
    // A "reset" from the other device restarts the round on this device too.
    const start = decoded.reduce(
      (acc, m) => (m.from === "peer" && m.body?.t === "reset" ? Math.max(acc, m.at + 1) : acc),
      roundStart
    );
    return decoded.filter((m) => m.at >= start);
  }, [messages, roundStart]);

  const myVotes = round.filter((m) => m.from === "me" && m.body?.t === "vote");
  const theirVotes = round.filter((m) => m.from === "peer" && m.body?.t === "vote");
  const myLikes = new Set(myVotes.filter((m) => m.body.like).map((m) => m.body.id));
  const theirLikes = new Set(theirVotes.filter((m) => m.body.like).map((m) => m.body.id));

  const match = deck.find((movie) => myLikes.has(movie.id) && theirLikes.has(movie.id));
  const current = deck[myVotes.length];

  const vote = (like) => {
    if (!current) return;
    send(encode({ t: "vote", id: current.id, like }));
  };

  const startOver = () => {
    const at = Date.now();
    send(encode({ t: "reset" }));
    clearMessages();
    setRoundStart(at + 1);
  };

  const shareInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "FlickSync",
          text: "Let's pick a film — tap this and start swiping.",
          url: inviteUrl,
        });
        return;
      } catch {
        // Share sheet dismissed; fall through to copying.
      }
    }
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="flex min-h-svh flex-col bg-neutral-950 text-neutral-100">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-rose-500">
              <Film className="size-5" />
            </span>
            FlickSync
          </span>
          {isConnected ? (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <Wifi className="size-3.5" />
              Synced
            </span>
          ) : null}
        </header>

        {!isConnected && autoRoom ? (
          <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            {error ? (
              <>
                <p className="text-3xl">📡</p>
                <p className="font-semibold">Couldn&apos;t connect</p>
                <p className="text-sm text-neutral-400">{error}</p>
                <button
                  type="button"
                  onClick={() => enterRoom(autoRoom)}
                  className="flex items-center gap-2 rounded-2xl bg-fuchsia-600 px-5 py-3 font-semibold active:scale-[0.98]"
                >
                  <RotateCcw className="size-4" />
                  Try again
                </button>
              </>
            ) : (
              <>
                <Loader2 className="size-8 animate-spin text-fuchsia-400" />
                <p className="font-semibold">
                  {role === "host" ? "You're in — waiting for Jemma" : "Connecting you two…"}
                </p>
                <p className="text-sm text-neutral-400">
                  {role === "host"
                    ? "Swiping starts the moment she opens the link."
                    : "One second."}
                </p>
              </>
            )}
          </section>
        ) : !isConnected ? (
          <section className="flex flex-1 flex-col justify-center gap-5">
            <p className="text-center text-sm text-neutral-400">
              Two phones, one deck. You both swipe — the first film you both like
              wins, and neither of you sees the other&apos;s votes until it does.
            </p>

            <button
              type="button"
              onClick={host}
              disabled={isBusy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-fuchsia-600 px-4 py-4 text-base font-semibold transition active:scale-[0.98] disabled:opacity-50"
            >
              {status === "hosting" && !roomCode ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <RadioTower className="size-5" />
              )}
              Start a room
            </button>

            {role === "host" && roomCode ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-4 text-center">
                <span className="text-xs uppercase tracking-widest text-fuchsia-300">
                  Room ready
                </span>
                <span className="font-mono text-3xl font-bold tracking-[0.3em]">
                  {roomCode}
                </span>

                <button
                  type="button"
                  onClick={shareInvite}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 font-semibold text-neutral-900 active:scale-[0.98]"
                >
                  {copied ? (
                    <>
                      <Check className="size-5" />
                      Link copied
                    </>
                  ) : (
                    <>
                      <Share2 className="size-5" />
                      Send link to Jemma
                    </>
                  )}
                </button>

                <p className="break-all rounded-lg bg-neutral-950/50 px-3 py-2 text-[11px] text-neutral-400">
                  {inviteUrl}
                </p>

                <span className="flex items-center justify-center gap-2 text-xs text-neutral-400">
                  <Loader2 className="size-3 animate-spin" />
                  Waiting for her to join…
                </span>
              </div>
            ) : null}

            <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-neutral-600">
              <span className="h-px flex-1 bg-neutral-800" />
              or
              <span className="h-px flex-1 bg-neutral-800" />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                join(joinCode);
              }}
              className="flex flex-col gap-3"
            >
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE"
                maxLength={6}
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                className="w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-4 text-center font-mono text-xl tracking-[0.3em] outline-none placeholder:text-neutral-700 focus:border-fuchsia-500"
              />
              <button
                type="submit"
                disabled={isBusy || joinCode.trim().length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-700 bg-neutral-800 px-4 py-4 text-base font-semibold transition active:scale-[0.98] disabled:opacity-50"
              >
                {status === "connecting" ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <LogIn className="size-5" />
                )}
                Join room
              </button>
            </form>

            {error ? (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-center text-sm text-rose-300">
                {error}
              </p>
            ) : null}
          </section>
        ) : match ? (
          <section className="flex flex-1 flex-col justify-center gap-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <PartyPopper className="size-10 text-fuchsia-400" />
              <h2 className="text-2xl font-bold">It&apos;s a match</h2>
              <p className="text-sm text-neutral-400">You both swiped right on…</p>
            </div>

            <div
              className={`flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br ${match.from} ${match.to} p-8 shadow-2xl`}
            >
              <span className="text-6xl">{match.emoji}</span>
              <h3 className="text-2xl font-bold leading-tight">{match.title}</h3>
              <p className="text-sm text-white/80">
                {match.year} · {match.genre} · {match.runtime}
              </p>
            </div>

            <p className="text-sm text-neutral-400">
              Put the kettle on. Decided in {myVotes.length}{" "}
              {myVotes.length === 1 ? "swipe" : "swipes"}.
            </p>

            <button
              type="button"
              onClick={startOver}
              className="flex items-center justify-center gap-2 rounded-2xl border border-neutral-700 bg-neutral-800 px-4 py-3.5 font-semibold active:scale-[0.98]"
            >
              <RotateCcw className="size-4" />
              Not feeling it — go again
            </button>
          </section>
        ) : (
          <section className="flex flex-1 flex-col gap-5">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>
                Card {Math.min(myVotes.length + 1, deck.length)} of {deck.length}
              </span>
              <span className="flex items-center gap-1.5">
                <Heart className="size-3.5 text-fuchsia-400" />
                Jemma&apos;s done {theirVotes.length}
              </span>
            </div>

            {current ? (
              <>
                <div
                  key={current.id}
                  className={`flex flex-1 flex-col justify-end gap-3 rounded-3xl bg-gradient-to-br ${current.from} ${current.to} p-6 shadow-2xl`}
                >
                  <span className="text-6xl">{current.emoji}</span>
                  <h2 className="text-3xl font-bold leading-tight">{current.title}</h2>
                  <p className="text-sm font-medium text-white/80">
                    {current.year} · {current.genre} · {current.runtime}
                  </p>
                  <p className="text-sm text-white/70">{current.blurb}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => vote(false)}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-neutral-700 bg-neutral-900 py-5 text-base font-semibold text-rose-300 active:scale-[0.98]"
                  >
                    <X className="size-6" />
                    Nope
                  </button>
                  <button
                    type="button"
                    onClick={() => vote(true)}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 py-5 text-base font-semibold text-emerald-300 active:scale-[0.98]"
                  >
                    <Heart className="size-6" />
                    Yes
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl border border-neutral-800 bg-neutral-900/60 p-8 text-center">
                {theirVotes.length < deck.length ? (
                  <>
                    <Loader2 className="size-7 animate-spin text-fuchsia-400" />
                    <p className="font-semibold">You&apos;re done — waiting on Jemma</p>
                    <p className="text-sm text-neutral-400">
                      She&apos;s {deck.length - theirVotes.length} cards from the end.
                      A match pops up the moment you agree.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl">😬</p>
                    <p className="font-semibold">No overlap this time</p>
                    <p className="text-sm text-neutral-400">
                      You made it through the whole deck without agreeing once.
                      Reshuffle and be less fussy.
                    </p>
                    <button
                      type="button"
                      onClick={startOver}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-fuchsia-600 px-5 py-3 font-semibold active:scale-[0.98]"
                    >
                      <RotateCcw className="size-4" />
                      Reshuffle
                    </button>
                  </>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={disconnect}
              className="flex items-center justify-center gap-2 text-xs text-neutral-500"
            >
              <Unplug className="size-3.5" />
              Leave room {roomCode}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
