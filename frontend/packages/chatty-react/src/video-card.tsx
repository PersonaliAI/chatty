"use client";

import React, { useState, useRef } from "react";
import { Play, Pause, ExternalLink, Video as VideoIcon } from "lucide-react";

export interface VideoClipData {
  title?: string;
  video_url: string;
  timestamp?: number;
  thumbnail_url?: string;
  duration?: number;
}

interface VideoCardProps {
  clip: VideoClipData;
  primaryColor?: string;
}

export function VideoCard({ clip, primaryColor = "#f97316" }: VideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const formatTimestamp = (sec?: number) => {
    if (sec === undefined || sec === null || sec < 0) return null;
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  const handlePlayToggle = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      if (clip.timestamp && videoRef.current.currentTime < 1) {
        videoRef.current.currentTime = clip.timestamp;
      }
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const isDirectVideo = clip.video_url.endsWith(".mp4") || clip.video_url.endsWith(".webm");
  const timeLabel = formatTimestamp(clip.timestamp);

  return (
    <div className="my-2.5 w-full max-w-[280px] sm:max-w-[320px] rounded-2xl border border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden text-left transition-all hover:shadow-md">
      <div className="relative w-full aspect-video bg-black overflow-hidden group">
        {isDirectVideo ? (
          <>
            <video
              ref={videoRef}
              src={clip.video_url}
              poster={clip.thumbnail_url}
              playsInline
              controls={isPlaying}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="w-full h-full object-cover"
            />
            {!isPlaying && (
              <button
                type="button"
                onClick={handlePlayToggle}
                className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/50 transition-colors cursor-pointer"
                aria-label="Play video"
              >
                <div
                  className="size-11 sm:size-12 rounded-full flex items-center justify-center shadow-lg text-white transition-transform group-hover:scale-110"
                  style={{ background: primaryColor }}
                >
                  <Play className="size-5 fill-current translate-x-0.5" />
                </div>
              </button>
            )}
          </>
        ) : (
          <a
            href={clip.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block w-full h-full"
          >
            {clip.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={clip.thumbnail_url}
                alt={clip.title || "Video thumbnail"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-neutral-400">
                <VideoIcon className="size-10 stroke-[1.5]" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/50 transition-colors">
              <div
                className="size-11 sm:size-12 rounded-full flex items-center justify-center shadow-lg text-white transition-transform group-hover:scale-110"
                style={{ background: primaryColor }}
              >
                <Play className="size-5 fill-current translate-x-0.5" />
              </div>
            </div>
          </a>
        )}

        {timeLabel && (
          <div className="absolute bottom-2 left-2 pointer-events-none">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-black/75 text-white backdrop-blur-sm">
              ▶ Key moment: {timeLabel}
            </span>
          </div>
        )}
      </div>

      {clip.title && (
        <div className="p-3">
          <h4 className="text-xs font-semibold text-neutral-900 dark:text-white line-clamp-2 leading-snug">
            {clip.title}
          </h4>
        </div>
      )}
    </div>
  );
}
