# LiveLoop 🎛️🎶
Collaborative, AI-assisted **live-looping studio** on the web. Jam with friends in real time, layer audio/MIDI loops, get smart harmony & drum suggestions, separate stems, and one-click export to your DAW.

**Live demo:** https://liveloop-studio.vercel.app/

---

## ✨ Features
- **Real-time sessions** — create a room, invite collaborators, jam together
- **Loop recorder & sequencer** — capture 4–8 bar ideas, quantize, tempo control
- **AI assists** — harmony & drum suggestions (more coming), stems & mastering (roadmap)
- **Exports** — download stems / session snapshots
- **Modern stack** — Next.js app with Web Audio (and WebRTC planned)
- **Deploy-ready** — works on Vercel; environment-first config

---

## 🧰 Tech Stack
- **Frontend**: Next.js (React + TypeScript), Tailwind CSS
- **Audio**: Web Audio API (WebRTC/SFU planned), optional Tone.js
- **Backend (API routes)**: Next.js `pages/api` for lightweight endpoints
- **Infra/Deploy**: Vercel
- **State/Realtime**
