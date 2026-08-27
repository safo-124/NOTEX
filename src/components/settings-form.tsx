"use client";

import { useState, useTransition } from "react";
import { saveAlertPrefs, sendTestAlert } from "@/actions/settings";
import type { ChannelName } from "@/alerts/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Values = {
  enabled: boolean;
  leadMinutes: number;
  email: boolean;
  telegram: boolean;
  whatsapp: boolean;
  emailTo: string;
  telegramChatId: string;
  whatsappTo: string;
  dailySummary: boolean;
  summaryHour: number;
  timezone: string;
};

export function SettingsForm({
  initial,
  configured,
}: {
  initial: Values;
  configured: Record<ChannelName, boolean>;
}) {
  const [v, setV] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setV((prev) => ({ ...prev, [key]: value }));

  function test(channel: ChannelName) {
    startTransition(async () => {
      await saveAlertPrefs(v);
      const res = await sendTestAlert(channel);
      setMessage(res.message);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <CardDescription>One message before each block starts, on every channel you switch on.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>Send reminders</span>
            <Switch checked={v.enabled} onCheckedChange={(x) => set("enabled", x)} />
          </label>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead">Minutes before the block</Label>
            <Input
              id="lead"
              type="number"
              min={0}
              max={180}
              value={v.leadMinutes}
              onChange={(e) => set("leadMinutes", Number(e.target.value))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tz">Timezone</Label>
            <Input id="tz" value={v.timezone} onChange={(e) => set("timezone", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Channels</CardTitle>
          <CardDescription>
            Telegram is instant to set up. WhatsApp needs an approved Meta template before it will deliver.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ChannelBlock
            title="Email"
            ready={configured.email}
            on={v.email}
            setOn={(x) => set("email", x)}
            onTest={() => test("email")}
            pending={pending}
          >
            <Input
              placeholder="Leave blank to use your sign-in address"
              value={v.emailTo}
              onChange={(e) => set("emailTo", e.target.value)}
            />
          </ChannelBlock>

          <ChannelBlock
            title="Telegram"
            ready={configured.telegram}
            on={v.telegram}
            setOn={(x) => set("telegram", x)}
            onTest={() => test("telegram")}
            pending={pending}
          >
            <Input
              placeholder="Chat id, e.g. 123456789"
              value={v.telegramChatId}
              onChange={(e) => set("telegramChatId", e.target.value)}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Message your bot once, then read the id from /getUpdates.
            </p>
          </ChannelBlock>

          <ChannelBlock
            title="WhatsApp"
            ready={configured.whatsapp}
            on={v.whatsapp}
            setOn={(x) => set("whatsapp", x)}
            onTest={() => test("whatsapp")}
            pending={pending}
          >
            <Input
              placeholder="Number in international format, e.g. 358401234567"
              value={v.whatsappTo}
              onChange={(e) => set("whatsappTo", e.target.value)}
            />
          </ChannelBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evening summary</CardTitle>
          <CardDescription>Tonight&rsquo;s blocks and the week&rsquo;s hours, once a day.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>Send a summary</span>
            <Switch checked={v.dailySummary} onCheckedChange={(x) => set("dailySummary", x)} />
          </label>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hour">Hour</Label>
            <Select
              id="hour"
              value={v.summaryHour}
              onChange={(e) => set("summaryHour", Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-20 flex items-center gap-3 md:bottom-4">
        <Button
          className="flex-1"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await saveAlertPrefs(v);
              setMessage("Saved.");
            })
          }
        >
          Save settings
        </Button>
      </div>

      {message ? <p className="text-sm text-[var(--muted-foreground)]">{message}</p> : null}
    </div>
  );
}

function ChannelBlock({
  title,
  ready,
  on,
  setOn,
  onTest,
  pending,
  children,
}: {
  title: string;
  ready: boolean;
  on: boolean;
  setOn: (v: boolean) => void;
  onTest: () => void;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4 first:border-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{title}</p>
          {!ready ? (
            <p className="text-xs text-[var(--muted-foreground)]">Missing credentials in the environment</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onTest} disabled={pending || !ready}>
            Test
          </Button>
          <Switch checked={on} onCheckedChange={setOn} disabled={!ready} />
        </div>
      </div>
      {children}
    </div>
  );
}
