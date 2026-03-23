"use client";

/**
 * Client-side Broadcast hook for real-time updates.
 *
 * Subscribes to a Supabase Broadcast channel and receives typed payloads.
 * Cleans up on unmount.
 */

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function useBroadcast<T>(
  channelName: string,
  eventName: string,
  onMessage: (payload: T) => void
): void {
  const callbackRef = useRef(onMessage);

  // Keep ref in sync with latest callback without triggering re-subscribe
  useEffect(() => {
    callbackRef.current = onMessage;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(channelName)
      .on("broadcast", { event: eventName }, (message) => {
        callbackRef.current(message.payload as T);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, eventName]);
}
