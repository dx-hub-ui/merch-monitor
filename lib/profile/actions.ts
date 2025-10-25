"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/supabase/queries";

export type UpdateProfileState =
  | { status: "success"; message: string; avatarUrl?: string | null }
  | { status: "warning"; message: string; avatarUrl?: string | null }
  | { status: "error"; message: string };

const schema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(80, "Display name must be 80 characters or fewer"),
  timezone: z.string().trim().min(1, "Timezone is required").max(120, "Timezone value is too long"),
  avatarUrl: z.string().url().optional().or(z.literal("")).optional()
});

export async function updateProfile(formData: FormData): Promise<UpdateProfileState> {
  const session = await requireSession();
  const parsed = schema.safeParse({
    displayName: formData.get("displayName"),
    timezone: formData.get("timezone"),
    avatarUrl: formData.get("existingAvatar")
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid profile details";
    return { status: "error", message };
  }

  const supabase = createServerSupabaseClient();
  const avatarFile = formData.get("avatar") as File | null;
  let avatarUrl = parsed.data.avatarUrl ? parsed.data.avatarUrl || null : null;
  let warningMessage: string | null = null;

  if (avatarFile && avatarFile.size > 0) {
    if (!avatarFile.type.startsWith("image/")) {
      return { status: "error", message: "Avatar must be an image file" };
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      warningMessage = "Avatar upload skipped because BLOB_READ_WRITE_TOKEN is not configured.";
    } else {
      const extension = avatarFile.name.split(".").pop()?.toLowerCase() || "png";
      const filename = `avatars/${session.user.id}-${Date.now()}.${extension}`;
      try {
        const blob = await put(filename, avatarFile, { access: "public", token });
        avatarUrl = blob.url;
      } catch (error) {
        console.error("Avatar upload failed", error);
        warningMessage = "Avatar upload failed. Try again later.";
      }
    }
  }

  const { error } = await supabase
    .from("users_profile")
    .upsert(
      {
        user_id: session.user.id,
        display_name: parsed.data.displayName,
        timezone: parsed.data.timezone,
        avatar_url: avatarUrl ?? null
      },
      { onConflict: "user_id" }
    );

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/account");
  revalidatePath("/");

  if (warningMessage) {
    return { status: "warning", message: warningMessage, avatarUrl };
  }

  return { status: "success", message: "Profile updated successfully.", avatarUrl };
}
