# download-clips-1107 — ⬇️ Download for the site's animations (preview, UI only)
Owner Nov 7 2026 ~10:07 AM CT [pt3077u]. Recorded in the player's browser: canvas.captureStream + page WebAudio -> MediaRecorder. $0, no server.
- js/v2-clip.js (new, reusable): V2Clip.record({source, caption, until, maxMs, start}) -> {blob, mime, ext, ms, audio}; save(); toBase64() (for a headless HatchBot later); button(); offer() for overlay scenes; arena()/arenaButton() for X Circus Kekimus replays.
- Formats: H.264 MP4 first (AAC where available, Opus on Linux Chrome), then WebM VP9/VP8, then plain MP4 (old Safari). Phones with file sharing get the share sheet (Save Video); others download.
- Captions are drawn in a band UNDER the scene (never over faces/bodies) + "xcpets.fun". The arena's own in-scene announcer lines are unchanged site behavior.
- Sound: an audio tap mirrors anything sent to the speakers; V2Sfx hit/roar blips are forced on while recording. Announcer speech (speechSynthesis) cannot be recorded. Hatch/breed/Mythic/hunt scenes have no site sound, so those clips are silent (no audio track).
- Where: arena Replay row (fight.html/play.html), life overlays (hatch, breed, Mythic, hunt-won/lost, …), cemetery overlays (hunted, zombie meal, raise…), Live Feed shared-event card.
- Rules untouched: four rule MD5s = main; replay SAME 971786/972883/972901.
