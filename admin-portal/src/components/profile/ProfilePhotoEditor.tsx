"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Alert, Button, Input } from "antd";
import {
  LinkOutlined,
  UploadOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { apiClient } from "@/app/lib/api";
import { isValidProfilePhotoURL, type AvatarPolicy } from "@/app/lib/profile";
import { PROFILE_TEXT as text } from "@/config/profile";

export default function ProfilePhotoEditor({
  endpoint,
  policy,
  hasPhoto,
  onUpdated,
}: {
  endpoint: string;
  policy: AvatarPolicy;
  hasPhoto: boolean;
  onUpdated: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [url, setURL] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);
  const maxMB = policy.maxBytes / (1024 * 1024);
  const save = async (operation: () => Promise<unknown>) => {
    setSaving(true);
    setFeedback(null);
    try {
      await operation();
      setURL("");
      setFeedback({ type: "success", message: text.photo.updated });
      onUpdated();
    } catch {
      setFeedback({ type: "error", message: text.photo.failed });
    } finally {
      setSaving(false);
    }
  };
  const useURL = () => {
    if (!url.trim() || saving) return;
    if (new TextEncoder().encode(url.trim()).length > policy.maxURLBytes) {
      setFeedback({ type: "error", message: text.photo.urlTooLong });
    } else if (!isValidProfilePhotoURL(url.trim())) {
      setFeedback({ type: "error", message: text.photo.invalidURL });
    } else {
      void save(() => apiClient.patch(endpoint, { avatarUrl: url.trim() }));
    }
  };
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || saving) return;
    if (!policy.allowedMimeTypes.includes(file.type)) {
      setFeedback({ type: "error", message: text.photo.invalidType });
    } else if (file.size === 0) {
      setFeedback({ type: "error", message: text.photo.emptyFile });
    } else if (file.size > policy.maxBytes) {
      setFeedback({ type: "error", message: text.photo.tooLarge(maxMB) });
    } else {
      const data = new FormData();
      data.append("avatar", file);
      void save(() => apiClient.post(`${endpoint}/avatar`, data));
    }
  };
  return (
    <details className="border-t border-slate-100 p-6 sm:px-8">
      <summary className="cursor-pointer text-sm font-semibold text-teal-800">
        {text.photo.title}
      </summary>
      <div className="mt-4 space-y-4">
        <p className="m-0 text-sm leading-6 text-slate-500">
          {text.photo.help(maxMB)}
        </p>
        {feedback && (
          <Alert type={feedback.type} message={feedback.message} showIcon />
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label={text.photo.urlLabel}
            placeholder={text.photo.urlPlaceholder}
            prefix={<LinkOutlined />}
            value={url}
            onChange={(event) => setURL(event.target.value)}
            onPressEnter={useURL}
            disabled={saving}
          />
          <Button onClick={useURL} loading={saving} disabled={!url.trim()}>
            {text.photo.useURL}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            aria-label={text.photo.upload}
            accept={policy.allowedMimeTypes.join(",")}
            className="hidden"
            onChange={upload}
            disabled={saving}
          />
          <Button
            aria-label={text.photo.upload}
            icon={<UploadOutlined />}
            onClick={() => input.current?.click()}
            disabled={saving}
          >
            {text.photo.upload}
          </Button>
          {hasPhoto && (
            <Button
              aria-label={text.photo.remove}
              icon={<DeleteOutlined />}
              disabled={saving}
              onClick={() =>
                void save(() => apiClient.patch(endpoint, { avatarUrl: "" }))
              }
            >
              {text.photo.remove}
            </Button>
          )}
        </div>
      </div>
    </details>
  );
}
