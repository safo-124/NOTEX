"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { removeFeed, saveFeedUrl, syncTimetable } from "@/actions/timetable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TimetableCard({
  initialUrl,
  lastSyncedAt,
  lastStatus,
  eventCount,
}: {
  initialUrl: string;
  lastSyncedAt: string | null;
  lastStatus: string | null;
  eventCount: number;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timetable</CardTitle>
        <CardDescription>
          Your Sisu calendar share link. Lectures, exercises and small groups appear on Tonight and
          Week, and refresh on their own a few times a day.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="feed">Calendar URL</Label>
          <Input
            id="feed"
            value={url}
            placeholder="https://sisu.tuni.fi/ilmo/api/calendar-share/..."
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-xs text-[var(--muted-foreground)]">
            In Sisu, open your calendar and choose the sharing link. It is read-only.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={pending || !url.trim()}
            onClick={() =>
              startTransition(async () => {
                const saved = await saveFeedUrl(url);
                if (!saved.ok) {
                  setMessage(saved.message);
                  return;
                }
                const res = await syncTimetable();
                setMessage(res.message);
              })
            }
          >
            <RefreshCw /> Save and sync
          </Button>

          {initialUrl ? (
            <>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await syncTimetable();
                    setMessage(res.message);
                  })
                }
              >
                Sync now
              </Button>
              <Button
                variant="ghost"
                className="text-[var(--destructive)]"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await removeFeed();
                    setUrl("");
                    setMessage("Removed the feed and its events.");
                  })
                }
              >
                Remove
              </Button>
            </>
          ) : null}
        </div>

        {message ? <p className="text-sm text-[var(--muted-foreground)]">{message}</p> : null}

        {lastSyncedAt ? (
          <p className="font-mono text-[11px] text-[var(--muted-foreground)]">
            Last sync {lastSyncedAt} · {eventCount} events
            {lastStatus ? ` · ${lastStatus}` : ""}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
