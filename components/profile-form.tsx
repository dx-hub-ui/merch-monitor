"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useFormState, useFormStatus } from "react-dom";
import clsx from "clsx";
import { toast } from "sonner";
import { updateProfile, type UpdateProfileState } from "@/lib/profile/actions";

type ProfileFormProps = {
  displayName: string;
  timezone: string;
  avatarUrl: string | null;
};

type FormState = UpdateProfileState | undefined;

export function ProfileForm({ displayName, timezone, avatarUrl }: ProfileFormProps) {
  const [state, formAction] = useFormState<FormState, FormData>(async (_prev, formData) => updateProfile(formData), undefined);
  const [storedAvatar, setStoredAvatar] = useState<string | null>(avatarUrl);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const blobUrlRef = useRef<string | null>(null);
  const [timezones, setTimezones] = useState<string[]>([]);

  useEffect(() => {
    if (typeof Intl !== "undefined" && typeof (Intl as { supportedValuesOf?: (input: string) => string[] }).supportedValuesOf === "function") {
      const values = (Intl as { supportedValuesOf: (input: string) => string[] }).supportedValuesOf("timeZone");
      setTimezones(values);
    } else {
      setTimezones(["UTC"]);
    }
  }, []);

  useEffect(() => {
    if (!state) return;
    if (state.status === "success") {
      toast.success(state.message);
    } else if (state.status === "warning") {
      toast.warning(state.message);
    } else if (state.status === "error") {
      toast.error(state.message);
    }
    if ("avatarUrl" in state && state.avatarUrl !== undefined) {
      clearPreview();
      setStoredAvatar(state.avatarUrl ?? null);
      setPreview(state.avatarUrl ?? null);
    }
  }, [state]);

  useEffect(() => {
    return () => {
      clearPreview();
    };
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      clearPreview();
      setPreview(storedAvatar ?? null);
      return;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    const url = URL.createObjectURL(file);
    blobUrlRef.current = url;
    setPreview(url);
  };

  function clearPreview() {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }

  const timezoneOptions = useMemo(() => {
    if (timezones.length > 0) {
      return timezones;
    }
    return [timezone || "UTC"];
  }, [timezones, timezone]);

  return (
    <form
      action={formAction}
      className="space-y-6"
      encType="multipart/form-data"
    >
      <input type="hidden" name="existingAvatar" value={storedAvatar ?? ""} />
      <div className="flex items-start gap-6">
        <div>
          <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            {preview ? (
              <Image
                src={preview}
                alt="Current avatar"
                fill
                sizes="96px"
                className="object-cover"
                unoptimized={preview.startsWith("blob:")}
              />
            ) : (
              <span className="text-sm font-semibold uppercase text-slate-500 dark:text-slate-400">No avatar</span>
            )}
          </div>
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="avatar">
              Avatar
            </label>
            <input
              id="avatar"
              name="avatar"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Upload a square image for best results. Images are stored in Vercel Blob storage.
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Display name
          <input
            type="text"
            name="displayName"
            required
            defaultValue={displayName}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Timezone
          <select
            name="timezone"
            defaultValue={timezone || "UTC"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {timezoneOptions.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      {state?.status === "error" ? (
        <p className="text-sm text-red-600" role="alert">
          {state.message}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-3">
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </form>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx(
        "inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow transition",
        pending ? "opacity-75" : "hover:bg-brand-dark"
      )}
    >
      {pending ? "Saving…" : children}
    </button>
  );
}
