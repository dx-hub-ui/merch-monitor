"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabaseClient } from "./server";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export async function signIn(formData: FormData) {
  const result = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (!result.success) {
    return { error: "Invalid credentials" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);
  if (error) {
    return { error: error.message };
  }
  redirect("/");
}

export async function signUp(formData: FormData) {
  const result = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (!result.success) {
    return { error: "Invalid credentials" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.auth.signUp(result.data);
  if (error) {
    return { error: error.message };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function changePassword(formData: FormData) {
  const schema = z
    .object({
      password: z.string().min(8),
      confirm: z.string().min(8)
    })
    .refine(values => values.password === values.confirm, {
      path: ["confirm"],
      message: "Passwords do not match"
    });

  const result = schema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm")
  });
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid form" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password: result.data.password });
  if (error) {
    return { error: error.message };
  }
  return { success: true };
}
