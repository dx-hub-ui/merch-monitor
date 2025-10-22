"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DEFAULT_KEYWORD_ALIAS, fetchKeywordLists, normaliseKeywordTerm } from "@/lib/keywords";

async function withAuth<T>(handler: (context: { supabase: ReturnType<typeof createServerSupabaseClient>; userId: string }) => Promise<T>): Promise<T> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("AUTH_REQUIRED");
  }

  return handler({ supabase, userId: user.id });
}

function normaliseAlias(alias?: string) {
  return (alias ?? DEFAULT_KEYWORD_ALIAS).toLowerCase();
}

function triggerRevalidate() {
  revalidatePath("/keywords");
  revalidatePath("/keywords/explore");
}

export async function createKeywordList(name: string) {
  const normalisedName = name?.trim();
  if (!normalisedName) {
    throw new Error("List name is required");
  }

  return withAuth(async ({ supabase, userId }) => {
    const { error } = await supabase.from("keyword_lists").insert({
      name: normalisedName,
      user_id: userId
    });
    if (error) {
      throw error;
    }
    triggerRevalidate();
    return fetchKeywordLists(userId, { supabase });
  });
}

export async function renameKeywordList(listId: string, name: string) {
  const normalisedName = name?.trim();
  if (!listId) {
    throw new Error("List id is required");
  }
  if (!normalisedName) {
    throw new Error("List name is required");
  }

  return withAuth(async ({ supabase, userId }) => {
    const { error } = await supabase
      .from("keyword_lists")
      .update({ name: normalisedName })
      .eq("id", listId);
    if (error) {
      throw error;
    }
    triggerRevalidate();
    return fetchKeywordLists(userId, { supabase });
  });
}

export async function deleteKeywordList(listId: string) {
  if (!listId) {
    throw new Error("List id is required");
  }

  return withAuth(async ({ supabase, userId }) => {
    const { error } = await supabase.from("keyword_lists").delete().eq("id", listId);
    if (error) {
      throw error;
    }
    triggerRevalidate();
    return fetchKeywordLists(userId, { supabase });
  });
}

export async function addKeywordsToList(listId: string, keywords: string[], alias?: string) {
  if (!listId) {
    throw new Error("List id is required");
  }

  return withAuth(async ({ supabase, userId }) => {
    const map = new Map<string, { original: string; normalized: string }>();
    for (const keyword of keywords ?? []) {
      const normalised = normaliseKeywordTerm(keyword);
      if (!normalised) continue;
      if (!map.has(normalised.normalized)) {
        map.set(normalised.normalized, normalised);
      }
    }

    if (!map.size) {
      return fetchKeywordLists(userId, { supabase });
    }

    const rows = Array.from(map.values()).map(entry => ({
      list_id: listId,
      term: entry.original,
      normalized: entry.normalized,
      alias: normaliseAlias(alias)
    }));

    const { error } = await supabase
      .from("keyword_list_items")
      .upsert(rows, { onConflict: "list_id,normalized,alias" });

    if (error) {
      throw error;
    }

    triggerRevalidate();
    return fetchKeywordLists(userId, { supabase });
  });
}

export async function removeKeywordFromList(itemId: number) {
  if (!itemId) {
    throw new Error("Keyword id is required");
  }

  return withAuth(async ({ supabase, userId }) => {
    const { error } = await supabase.from("keyword_list_items").delete().eq("id", itemId);
    if (error) {
      throw error;
    }
    triggerRevalidate();
    return fetchKeywordLists(userId, { supabase });
  });
}
