"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
const PEER_ID_PREFIX = "flicksync-";

function generateRoomCode() {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]
  ).join("");
}

function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase();
}

/**
 * Peer-to-peer sync for two devices. `peerjs` is imported lazily so it never
 * runs during SSR.
 */
export function usePeerSync() {
  const [status, setStatus] = useState("idle"); // idle | hosting | connecting | connected | error
  const [role, setRole] = useState(null); // "host" | "guest"
  const [roomCode, setRoomCode] = useState("");
  const [messages, setMessages] = useState([]);
  const [lastMessage, setLastMessage] = useState(null);
  const [error, setError] = useState(null);

  const PeerCtorRef = useRef(null);
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    import("peerjs").then((mod) => {
      if (!cancelled) PeerCtorRef.current = mod.default ?? mod.Peer;
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      connRef.current?.close();
      peerRef.current?.destroy();
      connRef.current = null;
      peerRef.current = null;
    };
  }, []);

  const safeSet = useCallback((fn) => {
    if (mountedRef.current) fn();
  }, []);

  const attachConnection = useCallback(
    (conn) => {
      connRef.current = conn;

      conn.on("open", () => {
        safeSet(() => {
          setStatus("connected");
          setError(null);
        });
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
        safeSet(() => setStatus("idle"));
      });

      conn.on("error", (err) => {
        safeSet(() => {
          setError(err?.message || "Connection error");
          setStatus("error");
        });
      });
    },
    [safeSet]
  );

  const waitForPeerCtor = useCallback(async () => {
    if (PeerCtorRef.current) return PeerCtorRef.current;
    const mod = await import("peerjs");
    PeerCtorRef.current = mod.default ?? mod.Peer;
    return PeerCtorRef.current;
  }, []);

  const host = useCallback(async () => {
    setError(null);
    setStatus("hosting");

    const Peer = await waitForPeerCtor();
    const code = generateRoomCode();

    peerRef.current?.destroy();
    const peer = new Peer(PEER_ID_PREFIX + code);
    peerRef.current = peer;

    peer.on("open", () => {
      safeSet(() => {
        setRole("host");
        setRoomCode(code);
      });
    });

    peer.on("connection", (conn) => {
      // Only one partner per room.
      if (connRef.current) {
        conn.close();
        return;
      }
      attachConnection(conn);
    });

    peer.on("error", (err) => {
      safeSet(() => {
        setError(err?.message || "Peer error");
        setStatus("error");
      });
    });

    return code;
  }, [attachConnection, safeSet, waitForPeerCtor]);

  const join = useCallback(
    async (code) => {
      const normalized = normalizeCode(code);
      if (!normalized) {
        setError("Enter a room code.");
        return;
      }

      setError(null);
      setStatus("connecting");

      const Peer = await waitForPeerCtor();

      peerRef.current?.destroy();
      const peer = new Peer();
      peerRef.current = peer;

      peer.on("open", () => {
        safeSet(() => {
          setRole("guest");
          setRoomCode(normalized);
        });
        attachConnection(peer.connect(PEER_ID_PREFIX + normalized, { reliable: true }));
      });

      peer.on("error", (err) => {
        safeSet(() => {
          setError(
            err?.type === "peer-unavailable"
              ? "No room found with that code."
              : err?.message || "Peer error"
          );
          setStatus("error");
        });
      });
    },
    [attachConnection, safeSet, waitForPeerCtor]
  );

  const send = useCallback((payload) => {
    const conn = connRef.current;
    if (!conn || !conn.open) return false;

    const text = String(payload);
    conn.send(text);
    const entry = { from: "me", payload: text, at: Date.now() };
    setLastMessage(entry);
    setMessages((prev) => [...prev, entry]);
    return true;
  }, []);

  const connectAsGuest = useCallback(
    async (code) => {
      const Peer = await waitForPeerCtor();
      const peer = new Peer();
      peerRef.current = peer;

      peer.on("open", () => {
        safeSet(() => {
          setRole("guest");
          setRoomCode(code);
        });
        attachConnection(peer.connect(PEER_ID_PREFIX + code, { reliable: true }));
      });

      peer.on("error", (err) => {
        safeSet(() => {
          setError(
            err?.type === "peer-unavailable"
              ? "No room found with that code."
              : err?.message || "Peer error"
          );
          setStatus("error");
        });
      });
    },
    [attachConnection, safeSet, waitForPeerCtor]
  );

  /** Fixed-room mode: first device in becomes host, the second auto-joins it. */
  const enterRoom = useCallback(
    async (code) => {
      const normalized = normalizeCode(code);
      if (!normalized) return;

      setError(null);
      setStatus("connecting");

      const Peer = await waitForPeerCtor();
      peerRef.current?.destroy();

      const peer = new Peer(PEER_ID_PREFIX + normalized);
      peerRef.current = peer;

      peer.on("open", () => {
        safeSet(() => {
          setRole("host");
          setRoomCode(normalized);
          setStatus("hosting");
        });
      });

      peer.on("connection", (conn) => {
        if (connRef.current) {
          conn.close();
          return;
        }
        attachConnection(conn);
      });

      peer.on("error", (err) => {
        if (err?.type === "unavailable-id") {
          peer.destroy();
          connectAsGuest(normalized);
          return;
        }
        safeSet(() => {
          setError(err?.message || "Peer error");
          setStatus("error");
        });
      });
    },
    [attachConnection, connectAsGuest, safeSet, waitForPeerCtor]
  );

  const clearMessages = useCallback(() => {

    setMessages([]);
    setLastMessage(null);
  }, []);

  const disconnect = useCallback(() => {
    connRef.current?.close();
    peerRef.current?.destroy();
    connRef.current = null;
    peerRef.current = null;
    setStatus("idle");
    setRole(null);
    setRoomCode("");
    setMessages([]);
    setLastMessage(null);
  }, []);

  return {
    status,
    role,
    roomCode,
    messages,
    lastMessage,
    error,
    isConnected: status === "connected",
    host,
    join,
    enterRoom,
    send,
    clearMessages,
    disconnect,
  };
}

export default usePeerSync;
