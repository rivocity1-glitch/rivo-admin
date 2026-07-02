import { supabase } from "../lib/supabase";

export async function getCategories() {
  const { data, error } = await supabase
    .from("store_categories")
    .select("id,name")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;

  return data;
}