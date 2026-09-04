"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
const PEER_ID_PREFIX = "flicksync-";
const RETRY_MS = 1500;
const GUEST_TIMEOUT_MS = 6000;

export function generateRoomCode() {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]
  ).join("");
}

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

/**
 * Pairs two devices on the same room code. Either device can arrive first: each
 * tries to claim the room, and whoever loses the claim dials the other. The
 * loop restarts on any failure or drop, which is what makes it survive iOS
 * suspending the tab.
 */
export function usePeerSync() {
  const [status, setStatus] = useState("idle"); // idle | pairing | waiting | connected
  const [role, setRole] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [messages, setMessages] = useState([]);
  const [lastMessage, setLastMessage] = useState(null);

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const timerRef = useRef(null);
  const codeRef = useRef("");
  const aliveRef = useRef(false);
  const runRef = useRef(0);

  const safeSet = useCallback((fn) => {
    if (aliveRef.current) fn();
  }, []);

  const teardownPeer = useCallback(() => {
    clearTimeout(timerRef.current);
    try {
      connRef.current?.close();
    } catch {}
    try {
      peerRef.current?.destroy();
    } catch {}
    connRef.current = null;
    peerRef.current = null;
  }, []);

  const attachConnection = useCallback(
    (conn, restart) => {
      connRef.current = conn;

      conn.on("open", () => {
        clearTimeout(timerRef.current);
        safeSet(() => setStatus("connected"));
      });

      conn.on("data", (data) => {
        const payload = typeof data === "string" ? data : JSON.stringify(data);
        const entry = { from: "peer", payload, at: Date.now() };
        safeSet(() => {
          setLastMessage(entry);
          setMessages((prev) => [...prev, entry]);
        });
      });

      conn.on("close", () => {
        connRef.current = null;
        safeSet(() => setStatus("pairing"));
        restart();
      });

      conn.on("error", () => {
        connRef.current = null;
        restart();
      });
    },
    [safeSet]
  );

  const pair = useCallback(
    async (code) => {
      const myRun = ++runRef.current;
      const stale = () => !aliveRef.current || runRef.current !== myRun;

      codeRef.current = code;
      safeSet(() => {
        setRoomCode(code);
        setStatus("pairing");
      });

      const { default: Peer } = await import("peerjs");
      if (stale()) return;

      let claim;

      const restart = () => {
        if (stale() || connRef.current?.open) return;
        teardownPeer();
        timerRef.current = setTimeout(() => {
          if (!stale()) claim();
        }, RETRY_MS);
      };

      // Loser of the claim dials whoever holds the room id.
      const dial = () => {
        if (stale()) return;
        teardownPeer();

        const peer = new Peer();
        peerRef.current = peer;

        peer.on("open", () => {
          if (stale()) return;
          safeSet(() => setRole("guest"));
          attachConnection(peer.connect(PEER_ID_PREFIX + code, { reliable: true }), restart);
          // Host may have vanished between the claim and the dial.
          timerRef.current = setTimeout(() => {
            if (!stale() && !connRef.current?.open) restart();
          }, GUEST_TIMEOUT_MS);
        });

        peer.on("disconnected", () => {
          if (!stale()) peer.reconnect();
        });

        peer.on("error", () => restart());
      };

      claim = () => {
        if (stale()) return;
        teardownPeer();

        const peer = new Peer(PEER_ID_PREFIX + code);
        peerRef.current = peer;

        peer.on("open", () => {
          if (stale()) return;
          safeSet(() => {
            setRole("host");
            setStatus("waiting");
          });
        });

        peer.on("connection", (conn) => {
          if (connRef.current?.open) {
            conn.close();
            return;
          }
          attachConnection(conn, restart);
        });

        peer.on("disconnected", () => {
          if (!stale()) peer.reconnect();
        });

        peer.on("error", (err) => {
          if (stale()) return;
          if (err?.type === "unavailable-id") dial();
          else restart();
        });
      };

      claim();
    },
    [attachConnection, safeSet, teardownPeer]
  );

  const enterRoom = useCallback(
    (code) => {
      const normalized = normalizeCode(code);
      if (normalized) pair(normalized);
    },
    [pair]
  );

  useEffect(() => {
    aliveRef.current = true;

    // iOS kills the broker socket when Safari backgrounds; recover on return.
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !codeRef.current) return;
      if (connRef.current?.open) return;
      const peer = peerRef.current;
      if (peer && peer.disconnected && !peer.destroyed) peer.reconnect();
      else pair(codeRef.current);
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      aliveRef.current = false;
      runRef.current++;
      document.removeEventListener("visibilitychange", onVisible);
      teardownPeer();
    };
  }, [pair, teardownPeer]);

  const send = useCallback((payload) => {
    const conn = connRef.current;
    if (!conn?.open) return false;

    const text = String(payload);
    conn.send(text);
    const entry = { from: "me", payload: text, at: Date.now() };
    setLastMessage(entry);
    setMessages((prev) => [...prev, entry]);
    return true;
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastMessage(null);
  }, []);

  return {
    status,
    role,
    roomCode,
    messages,
    lastMessage,
    isConnected: status === "connected",
    enterRoom,
    send,
    clearMessages,
  };
}

export default usePeerSync;
