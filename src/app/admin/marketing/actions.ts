"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminSession } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function revokeMarketingConsentAction(formData: FormData) {
  const adminSession = await getAdminSession();
  if (adminSession.status !== "admin") {
    redirect("/admin/login");
  }

  const email = z.email().max(180).safeParse(formData.get("email"));
  if (!email.success) {
    redirect("/admin/marketing?error=invalid_email");
  }

  const supabase = await createSupabaseServerClient();
  const { data: revoked, error } = await supabase.rpc(
    "revoke_marketing_preference",
    { p_email: email.data.trim().toLowerCase() },
  );

  if (error) {
    console.error("Failed to revoke marketing preference", error);
    redirect("/admin/marketing?error=save_failed");
  }

  revalidatePath("/admin/marketing");
  redirect(`/admin/marketing?${revoked ? "saved=1" : "error=already_inactive"}`);
}
