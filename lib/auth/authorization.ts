import type { User } from "@supabase/supabase-js";

export function isAuthorizedOwner(user: Pick<User, "app_metadata">) {
  return user.app_metadata?.access_role === "owner";
}
