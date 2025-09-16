"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");

  const createSession = () => {
    const id = crypto.randomUUID().slice(0, 8);
    router.push(`/studio/${id}`);
  };

  const joinSession = () => {
    if (!sessionId.trim()) return;
    router.push(`/studio/${sessionId.trim()}`);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="w-full py-4 px-6 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-fuchsia-500" />
          <span className="text-xl font-semibold">LiveLoop</span>
        </div>
        <nav className="text-sm opacity-80 hidden sm:flex gap-6">
          <a href="#features" className="hover:opacity-100">Features</a>
          <a href="#how" className="hover:opacity-100">How it works</a>
          <a href="#faq" className="hover:opacity-100">FAQ</a>
        </nav>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img
              src="https://images.unsplash.com/photo-1461782296610-9e5f56f8e597?q=80&w=1974&auto=format&fit=crop"
              alt="studio background"
              className="w-full h-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/60 to-black" />
          </div>
          <div className="relative mx-auto max-w-6xl px-6 py-24 grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight">
                Jam together in real time.
                <br />
                Record loops. Get AI vibes.
              </h1>
              <p className="mt-4 text-lg text-white/80 max-w-xl">
                LiveLoop is a collaborative, AI-assisted live-looping studio. Create
                sessions, invite friends, capture loops, and shape songs with harmony
                and drum suggestions. Export stems to your favorite DAW.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={createSession}
                  className="px-5 py-3 rounded-md bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-semibold"
                >
                  Create a session
                </button>
                <div className="flex items-center gap-2 bg-white/10 rounded-md p-1 w-full sm:w-auto">
                  <input
                    placeholder="Enter session ID"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    className="bg-transparent px-3 py-2 outline-none w-full"
                  />
                  <button
                    onClick={joinSession}
                    className="px-4 py-2 rounded-md bg-white/20 hover:bg-white/30 text-white"
                  >
                    Join
                  </button>
                </div>
              </div>
              <div className="mt-6 text-sm text-white/70">
                Or share an invite like: {typeof window !== "undefined" && (
                  <span className="font-mono">
                    {`${window.location.origin}/studio/your-id`}
                  </span>
                )}
              </div>
            </div>
            <div className="relative rounded-xl overflow-hidden ring-1 ring-white/10">
              <img
                src="https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=2069&auto=format&fit=crop"
                alt="LiveLoop preview"
                className="w-full h-[320px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-fuchsia-500/10 via-transparent to-cyan-400/10" />
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-6 py-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Feature title="Live collaboration" desc="Jam with friends in real time using low-latency WebRTC and session rooms." />
          <Feature title="Loop recorder" desc="Capture mic or instrument, quantize, and layer loops with the Web Audio API." />
          <Feature title="AI assist" desc="Get harmony suggestions, drum patterns, and mock stem separation to explore ideas." />
          <Feature title="Export ready" desc="Download your mix or stems as WAV and continue in your DAW of choice." />
        </section>

        <section id="how" className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <ol className="mt-4 space-y-2 text-white/80 list-decimal list-inside">
            <li>Create a session and share the link.</li>
            <li>Enable the mic and record your first loop.</li>
            <li>Invite LiveLoop AI to suggest chords and drums.</li>
            <li>Export your mix or stems and finish the track in your DAW.</li>
          </ol>
        </section>

        <section id="faq" className="mx-auto max-w-6xl px-6 py-16 border-t border-white/10">
          <h2 className="text-2xl font-semibold">FAQ</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="font-semibold">Is collaboration real-time?</h3>
              <p className="text-white/80">Yes. We use Socket.IO for session state and WebRTC for peer audio.</p>
            </div>
            <div>
              <h3 className="font-semibold">Do I need to install anything?</h3>
              <p className="text-white/80">No, it runs in your browser. Use headphones for best results.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-6 py-6 text-center text-white/60 text-sm">
        © {new Date().getFullYear()} LiveLoop — Built with Next.js
      </footer>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-lg bg-white/5 p-4 ring-1 ring-white/10">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-white/75 text-sm mt-1">{desc}</p>
    </div>
  );
}