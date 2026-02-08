"use client";

import { useCallback, useRef, useState } from "react";

export default function ReadLesson({ lessonText, label = "Read lesson aloud" }) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const chunksRef = useRef([]);
  const currentIndexRef = useRef(0);
  const currentAudioRef = useRef(null);

  const stop = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    currentIndexRef.current = 0;
    setStatus("idle");
  }, []);

  const playNextChunk = useCallback(() => {
    const chunks = chunksRef.current;
    const idx = currentIndexRef.current;
    if (idx >= chunks.length) {
      setStatus("idle");
      currentAudioRef.current = null;
      return;
    }
    const b64 = chunks[idx];
    const audio = new Audio(`data:audio/mp3;base64,${b64}`);
    currentAudioRef.current = audio;
    audio.onended = () => {
      currentIndexRef.current = idx + 1;
      playNextChunk();
    };
    audio.onerror = () => {
      setError("Audio playback failed.");
      setStatus("idle");
    };
    audio.play().catch((err) => {
      setError(err?.message || "Playback failed");
      setStatus("idle");
    });
  }, []);

  const play = useCallback(async () => {
    const text = typeof lessonText === "string" ? lessonText.trim() : "";
    if (!text) {
      setError("No lesson text to read.");
      return;
    }
    setError(null);
    setStatus("loading");

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: lessonText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "TTS request failed");

      const chunks = Array.isArray(data.chunks) ? data.chunks : [];
      if (chunks.length === 0) {
        setStatus("idle");
        setError("No audio generated.");
        return;
      }

      chunksRef.current = chunks;
      currentIndexRef.current = 0;
      setStatus("playing");
      playNextChunk();
    } catch (err) {
      setError(err?.message || "Could not generate speech.");
      setStatus("idle");
    }
  }, [lessonText, playNextChunk]);

  const pause = useCallback(() => {
    if (currentAudioRef.current && status === "playing") {
      currentAudioRef.current.pause();
      setStatus("paused");
    }
  }, [status]);

  const resume = useCallback(() => {
    if (currentAudioRef.current && status === "paused") {
      setStatus("playing");
      currentAudioRef.current.play().catch(() => setStatus("idle"));
    }
  }, [status]);

  if (!lessonText || (typeof lessonText === "string" && !lessonText.trim())) {
    return null;
  }

  return (
    <div className="read-lesson">
      <div className="row">
        {status === "idle" && (
          <button type="button" className="ghost tiny" onClick={play}>
            {label}
          </button>
        )}
        {status === "loading" && (
          <span className="muted">Generating audio…</span>
        )}
        {(status === "playing" || status === "paused") && (
          <>
            <button type="button" className="ghost tiny" onClick={stop}>
              Stop
            </button>
            {status === "playing" ? (
              <button type="button" className="ghost tiny" onClick={pause}>
                Pause
              </button>
            ) : (
              <button type="button" className="ghost tiny" onClick={resume}>
                Resume
              </button>
            )}
            <span className="muted">
              {status === "playing" ? "Playing…" : "Paused"}
            </span>
          </>
        )}
      </div>
      {error && <p className="muted" style={{ color: "#f87171" }}>{error}</p>}
    </div>
  );
}
