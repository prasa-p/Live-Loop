"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import io, { Socket } from "socket.io-client";
import Peer from "simple-peer";

// Socket singleton (client)
let socket: Socket | null = null;
function getSocket() {
  if (socket) return socket;
  socket = io(undefined as any, { path: "/api/socket_io" });
  return socket;
}

// Utility: simple WAV encoder from Float32Array
function encodeWAV(float32Data: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + float32Data.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  const write16 = (offset: number, data: number) => view.setUint16(offset, data, true);
  const write32 = (offset: number, data: number) => view.setUint32(offset, data, true);

  // RIFF/WAVE header
  writeString(0, "RIFF");
  write32(4, 36 + float32Data.length * 2);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  write32(16, 16); // PCM chunk size
  write16(20, 1); // PCM format
  write16(22, 1); // mono
  write32(24, sampleRate);
  write32(28, sampleRate * 2);
  write16(32, 2); // block align
  write16(34, 16); // bits per sample
  writeString(36, "data");
  write32(40, float32Data.length * 2);
  // PCM data
  let offset = 44;
  for (let i = 0; i < float32Data.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Data[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([view], { type: "audio/wav" });
}

// Basic drum samples (from Unsplash? not for audio) so create simple oscillator drums
function playKick(ctx: AudioContext, time: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(50, time + 0.1);
  gain.gain.setValueAtTime(1, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.2);
}
function playHat(ctx: AudioContext, time: number) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  const num = 6;
  for (let i = 0; i < num; i++) {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 400 + Math.random() * 4000;
    osc.connect(gain);
    osc.start(time);
    osc.stop(time + 0.05);
  }
  gain.connect(ctx.destination);
}

// Harmony suggestion (mock)
function suggestChords(key: string): string[] {
  const map: Record<string, string[]> = {
    C: ["C - Am - F - G", "C - G - Am - F", "C - Em - F - G"],
    G: ["G - Em - C - D", "G - D - Em - C", "G - Bm - C - D"],
    D: ["D - Bm - G - A", "D - A - Bm - G", "D - F#m - G - A"],
    A: ["A - F#m - D - E", "A - E - F#m - D", "A - C#m - D - E"],
    E: ["E - C#m - A - B", "E - B - C#m - A", "E - G#m - A - B"],
    F: ["F - Dm - Bb - C", "F - C - Dm - Bb", "F - Am - Bb - C"],
  };
  return map[key] || map["C"];
}

export default function StudioPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = String(params?.id || "");

  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState<string[]>([]);
  const [messages, setMessages] = useState<{ user: string; message: string; at: number }[]>([]);

  // Transport
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [bars, setBars] = useState(2);

  // Sequencer grid (16 steps)
  const steps = 16;
  const [grid, setGrid] = useState<boolean[]>(Array(steps).fill(false));

  // Audio Context
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextTickRef = useRef<number>(0);
  const currentStepRef = useRef<number>(0);
  const schedulerTimer = useRef<number | null>(null);

  // Recording
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const recordedBufferRef = useRef<AudioBuffer | null>(null);
  const [hasMic, setHasMic] = useState(false);
  const [loopUrl, setLoopUrl] = useState<string | null>(null);

  // WebRTC
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, Peer.Instance>>({});

  // Chat
  const [chatInput, setChatInput] = useState("");

  // AI Panel
  const [key, setKey] = useState("C");
  const chords = useMemo(() => suggestChords(key), [key]);

  // Setup socket & room
  useEffect(() => {
    // Ensure server-side Socket.IO is initialized
    fetch("/api/socket").catch(() => {});

    const s = getSocket();
    const userId = crypto.randomUUID().slice(0, 6);

    const onConnect = () => {
      setConnected(true);
      s.emit("room:join", { roomId, userId });
    };
    const onPeers = (ids: string[]) => {
      setPeers(ids);
      // If we already have a local stream, proactively init peers
      const stream = localStreamRef.current;
      if (stream) {
        ids.filter((id) => id !== s.id).forEach((id) => {
          if (peersRef.current[id]) return;
          const p = new Peer({ initiator: true, trickle: true, stream });
          p.on("signal", (signal) => s.emit("signal", { roomId, targetId: id, data: signal }));
          p.on("stream", (remote) => {
            const el = document.getElementById(`remote-${id}`) as HTMLAudioElement | null;
            if (el) {
              el.srcObject = remote;
              el.play().catch(() => {});
            }
          });
          p.on("close", () => delete peersRef.current[id]);
          peersRef.current[id] = p;
        });
      }
    };
    const onChat = (payload: any) => setMessages((m) => [...m, payload]);

    s.on("connect", onConnect);
    s.on("room:peers", onPeers);
    s.on("chat", onChat);

    // Signaling
    const onSignal = ({ from, data }: any) => {
      let peer = peersRef.current[from];
      if (!peer) {
        peer = new Peer({ initiator: false, trickle: true, stream: localStreamRef.current || undefined });
        peer.on("signal", (signal) => s.emit("signal", { roomId, targetId: from, data: signal }));
        peer.on("stream", (remote) => {
          const el = document.getElementById(`remote-${from}`) as HTMLAudioElement | null;
          if (el) {
            el.srcObject = remote;
            el.play().catch(() => {});
          }
        });
        peer.on("close", () => delete peersRef.current[from]);
        peersRef.current[from] = peer;
      }
      peer.signal(data);
    };
    s.on("signal", onSignal);

    // Transport sync
    s.on("transport:update", ({ state }) => {
      setIsPlaying(state.isPlaying);
      setBpm(state.bpm);
    });
    s.on("seq:update", ({ grid }) => setGrid(grid));

    // Start local media for WebRTC
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      localStreamRef.current = stream;
      // Initiate peers for current room peers
      setTimeout(() => {
        const others = peers.filter((id) => id !== s.id);
        others.forEach((id) => {
          if (peersRef.current[id]) return;
          const p = new Peer({ initiator: true, trickle: true, stream });
          p.on("signal", (signal) => s.emit("signal", { roomId, targetId: id, data: signal }));
          p.on("stream", (remote) => {
            const el = document.getElementById(`remote-${id}`) as HTMLAudioElement | null;
            if (el) {
              el.srcObject = remote;
              el.play().catch(() => {});
            }
          });
          p.on("close", () => delete peersRef.current[id]);
          peersRef.current[id] = p;
        });
      }, 500);
    }).catch(() => {});

    return () => {
      s.off("connect", onConnect);
      s.off("room:peers", onPeers);
      s.off("chat", onChat);
      s.off("signal");
      // Cleanup peers and media
      Object.values(peersRef.current).forEach((p) => p.destroy());
      peersRef.current = {};
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [roomId]);

  // Audio init
  function ensureCtx() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current!;
  }

  // Transport scheduling
  useEffect(() => {
    if (!isPlaying) {
      if (schedulerTimer.current) cancelAnimationFrame(schedulerTimer.current);
      schedulerTimer.current = null;
      currentStepRef.current = 0;
      nextTickRef.current = 0;
      return;
    }
    const ctx = ensureCtx();
    const lookahead = 0.1; // seconds
    const stepDur = 60 / bpm / 4; // 16th note

    const schedule = () => {
      const currentTime = ctx.currentTime;
      if (nextTickRef.current === 0) nextTickRef.current = currentTime + 0.05;
      while (nextTickRef.current < currentTime + lookahead) {
        const step = currentStepRef.current % steps;
        if (grid[step]) {
          playHat(ctx, nextTickRef.current);
          if (step % 4 === 0) playKick(ctx, nextTickRef.current);
        }
        currentStepRef.current++;
        nextTickRef.current += stepDur;
      }
      schedulerTimer.current = requestAnimationFrame(schedule);
    };
    schedulerTimer.current = requestAnimationFrame(schedule);
    return () => {
      if (schedulerTimer.current) cancelAnimationFrame(schedulerTimer.current);
      schedulerTimer.current = null;
    };
  }, [isPlaying, bpm, grid]);

  // Recording controls using MediaRecorder
  async function armMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setHasMic(true);
    } catch (e) {
      alert("Mic permission denied");
    }
  }
  function startRecording() {
    if (!mediaStreamRef.current) return;
    const mr = new MediaRecorder(mediaStreamRef.current, { mimeType: "audio/webm" });
    const chunks: BlobPart[] = [];
    mr.ondataavailable = (e) => chunks.push(e.data);
    mr.onstop = async () => {
      const webm = new Blob(chunks, { type: "audio/webm" });
      const arrayBuf = await webm.arrayBuffer();
      const audioCtx = ensureCtx();
      const abuf = await audioCtx.decodeAudioData(arrayBuf.slice(0));
      recordedBufferRef.current = abuf;
      // Create loop URL (WAV)
      const ch = abuf.getChannelData(0);
      const wav = encodeWAV(new Float32Array(ch), abuf.sampleRate);
      const url = URL.createObjectURL(wav);
      setLoopUrl(url);
    };
    mediaRecRef.current = mr;
    mr.start();
  }
  function stopRecording() {
    mediaRecRef.current?.stop();
  }
  function clearLoop() {
    recordedBufferRef.current = null;
    if (loopUrl) URL.revokeObjectURL(loopUrl);
    setLoopUrl(null);
  }
  function togglePlay() {
    const newState = !isPlaying;
    setIsPlaying(newState);
    getSocket().emit("transport:update", { roomId, state: { isPlaying: newState, bpm } });
  }
  function handleGridToggle(i: number) {
    const next = [...grid];
    next[i] = !next[i];
    setGrid(next);
    getSocket().emit("seq:update", { roomId, grid: next });
  }

  // Play the recorded loop along with transport
  useEffect(() => {
    if (!isPlaying || !recordedBufferRef.current) return;
    const ctx = ensureCtx();
    const src = ctx.createBufferSource();
    src.buffer = recordedBufferRef.current;
    src.loop = true;
    const totalBeats = bars * 4;
    const loopDur = (60 / bpm) * totalBeats; // seconds
    src.loopEnd = loopDur;
    src.connect(ctx.destination);
    src.start();
    return () => {
      src.stop();
      src.disconnect();
    };
  }, [isPlaying, bpm, bars, loopUrl]);

  // Chat send
  function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    const payload = { user: "You", message: text, at: Date.now() };
    setMessages((m) => [...m, payload]);
    getSocket().emit("chat", { roomId, message: text, user: "Guest" });
    setChatInput("");
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded bg-fuchsia-500" />
          <div className="font-semibold">LiveLoop Studio</div>
          <span className="text-white/50 text-sm">Room: {roomId}</span>
        </div>
        <div className="text-sm text-white/70">{connected ? "Connected" : "Connecting..."}</div>
      </header>

      <main className="flex-1 grid grid-rows-[auto_1fr]">
        {/* Transport */}
        <div className="px-4 py-3 flex items-center gap-3 border-b border-white/10">
          <button onClick={togglePlay} className="px-3 py-2 bg-fuchsia-500 text-black rounded">{isPlaying ? "Stop" : "Play"}</button>
          <label className="text-sm text-white/70">BPM</label>
          <input type="number" className="bg-white/10 rounded px-2 py-1 w-20" value={bpm} onChange={(e)=> setBpm(parseInt(e.target.value||"120",10))} />
          <label className="text-sm text-white/70">Bars</label>
          <select className="bg-white/10 rounded px-2 py-1" value={bars} onChange={(e)=> setBars(parseInt(e.target.value,10))}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={4}>4</option>
          </select>
          <div className="ml-auto flex items-center gap-2">
            {!hasMic ? (
              <button onClick={armMic} className="px-3 py-2 bg-white/10 rounded">Enable Mic</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={startRecording} className="px-3 py-2 bg-white/10 rounded">Record</button>
                <button onClick={stopRecording} className="px-3 py-2 bg-white/10 rounded">Stop</button>
                <button onClick={clearLoop} className="px-3 py-2 bg-white/10 rounded">Clear</button>
                {loopUrl && (
                  <a href={loopUrl} download={`loop-${roomId}.wav`} className="px-3 py-2 bg-white/10 rounded">Download Loop</a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main panels */}
        <div className="grid md:grid-cols-3 gap-4 p-4">
          {/* Sequencer */}
          <section className="md:col-span-2 rounded-lg bg-white/5 ring-1 ring-white/10 p-4">
            <h2 className="font-semibold">Step Sequencer</h2>
            <div className="mt-3 grid grid-cols-8 gap-2">
              {Array.from({ length: steps }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleGridToggle(i)}
                  className={`h-10 rounded border ${grid[i] ? "bg-fuchsia-500 text-black border-transparent" : "bg-white/10 border-white/10"}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <p className="text-white/60 text-sm mt-3">Kick on quarter notes, hats on enabled steps.</p>
          </section>

          {/* AI Assist */}
          <aside className="rounded-lg bg-white/5 ring-1 ring-white/10 p-4">
            <h2 className="font-semibold">AI Assist</h2>
            <div className="mt-3">
              <label className="text-sm text-white/70">Key</label>
              <select className="bg-white/10 rounded px-2 py-1 ml-2" value={key} onChange={(e)=> setKey(e.target.value)}>
                {"C C# D D# E F F# G G# A A# B".split(" ").map((k)=> (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <ul className="mt-3 space-y-2 text-sm text-white/80">
                {chords.map((c, idx) => (
                  <li key={idx} className="p-2 rounded bg-white/10">{c}</li>
                ))}
              </ul>
            </div>
            <div className="mt-4">
              <button className="px-3 py-2 bg-white/10 rounded" onClick={() => {
                // Generate drum pattern: toggle every other step
                const pattern = Array(steps).fill(false).map((_, i) => i % 2 === 0);
                setGrid(pattern);
                getSocket().emit("seq:update", { roomId, grid: pattern });
              }}>Generate Drum Pattern</button>
            </div>
            <div className="mt-4 text-sm text-white/70">
              Mock stem separation will split loop into "vocal" and "music" stems locally (demo only).
            </div>
          </aside>
        </div>

        {/* Collaboration: Peers and Chat */}
        <div className="grid md:grid-cols-3 gap-4 p-4 pt-0">
          <section className="rounded-lg bg-white/5 ring-1 ring-white/10 p-4">
            <h3 className="font-semibold">Peers</h3>
            <ul className="mt-2 text-sm text-white/80">
              {peers.map((id) => (
                <li key={id} className="truncate">{id}{id === (socket as any)?.id ? " (you)" : ""}</li>
              ))}
            </ul>
          </section>
          <section className="md:col-span-2 rounded-lg bg-white/5 ring-1 ring-white/10 p-4">
            <h3 className="font-semibold">Chat</h3>
            <div className="mt-2 h-32 overflow-auto space-y-1 text-sm">
              {messages.map((m, i) => (
                <div key={i} className="text-white/80"><span className="text-white/60 mr-2">[{new Date(m.at).toLocaleTimeString()}]</span><b className="mr-2">{m.user}:</b> {m.message}</div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input className="flex-1 bg-white/10 rounded px-2 py-2" placeholder="Say something" value={chatInput} onChange={(e)=> setChatInput(e.target.value)} onKeyDown={(e)=> e.key === "Enter" && sendChat()} />
              <button onClick={sendChat} className="px-3 py-2 bg-fuchsia-500 text-black rounded">Send</button>
            </div>
          </section>
        </div>
      </main>

      {/* Remote peer audios (hidden) */}
      <div className="hidden">
        {peers.filter((id)=> id !== (socket as any)?.id).map((id) => (
          <audio key={id} id={`remote-${id}`} />
        ))}
      </div>

      <footer className="border-t border-white/10 px-4 py-3 text-center text-white/60 text-sm">
        Invite link: {typeof window !== "undefined" ? `${window.location.origin}/studio/${roomId}` : ""}
      </footer>
    </div>
  );
}