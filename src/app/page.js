"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Check,
  Film,
  Heart,
  Loader2,
  PartyPopper,
  RotateCcw,
  Share2,
  Wifi,
  X,
} from "lucide-react";
import usePeerSync, { generateRoomCode } from "@/hooks/usePeerSync";
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
    isConnected,
    enterRoom,
    send,
    clearMessages,
  } = usePeerSync();

  const [copied, setCopied] = useState(false);
  const [roundStart, setRoundStart] = useState(0);

  // Landing without a room creates one and puts it in the URL, so the address
  // bar is always the shareable invite.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    let code = params.get("r")?.toUpperCase();
    if (!code) {
      code = generateRoomCode();
      window.history.replaceState(null, "", `?r=${code}`);
    }
    enterRoom(code);
  }, [enterRoom]);

  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );
  const inviteUrl = origin && roomCode ? `${origin}/?r=${roomCode}` : "";

  const deck = useMemo(() => (roomCode ? deckForRoom(roomCode) : []), [roomCode]);

  const round = useMemo(() => {
    const decoded = messages.map((m) => ({ ...m, body: decode(m.payload) }));
    // A reset from the other device restarts the round here too.
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
    if (current) send(encode({ t: "vote", id: current.id, like }));
  };

  const startOver = () => {
    const at = Date.now();
    send(encode({ t: "reset" }));
    clearMessages();
    setRoundStart(at + 1);
  };

  const shareInvite = useCallback(async () => {
    if (!inviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "FlickSync", text: "Let's pick a film", url: inviteUrl });
        return;
      } catch {
        // Sheet dismissed; fall back to the clipboard.
      }
    }
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteUrl]);

  return (
    <main className="flex min-h-svh flex-col bg-neutral-950 text-neutral-100">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-rose-500">
              <Film className="size-5" />
            </span>
            FlickSync
          </span>
          <span
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
              isConnected
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-neutral-700 bg-neutral-900 text-neutral-400"
            }`}
          >
            {isConnected ? <Wifi className="size-3.5" /> : <Loader2 className="size-3.5 animate-spin" />}
            {isConnected ? "Synced" : "Linking…"}
          </span>
        </header>

        {!isConnected ? (
          <section className="flex flex-1 flex-col justify-center gap-5 text-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="size-8 animate-spin text-fuchsia-400" />
              <p className="text-lg font-semibold">Waiting for the other phone</p>
              <p className="text-sm text-neutral-400">
                Send this link. The moment it&apos;s open on both phones, swiping starts.
              </p>
            </div>

            <button
              type="button"
              onClick={shareInvite}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 text-base font-semibold text-neutral-900 active:scale-[0.98]"
            >
              {copied ? (
                <>
                  <Check className="size-5" />
                  Link copied
                </>
              ) : (
                <>
                  <Share2 className="size-5" />
                  Send the link
                </>
              )}
            </button>

            <p className="break-all rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-[11px] text-neutral-400">
              {inviteUrl || "Setting up…"}
            </p>

            <p className="text-xs text-neutral-600">
              Room {roomCode || "…"} · {role === "host" ? "you're first in" : "joining"} ·
              keeps retrying by itself
            </p>
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
          <section className="flex flex-1 flex-col gap-4">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>
                Card {Math.min(myVotes.length + 1, deck.length)} of {deck.length}
              </span>
              <span className="flex items-center gap-1.5">
                <Heart className="size-3.5 text-fuchsia-400" />
                They&apos;ve done {theirVotes.length}
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
                    <p className="font-semibold">You&apos;re done — waiting on them</p>
                    <p className="text-sm text-neutral-400">
                      {deck.length - theirVotes.length} cards to go. A match pops up
                      the moment you agree.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl">😬</p>
                    <p className="font-semibold">No overlap this time</p>
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
          </section>
        )}
      </div>
    </main>
  );
}
