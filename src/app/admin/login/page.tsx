import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { storeBrandName } from "@/lib/brand";
import { getAdminSession } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: `Logowanie admina | ${storeBrandName}`,
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const adminSession = await getAdminSession();

  if (adminSession.status === "admin") {
    redirect("/admin");
  }

  return (
    <section className="mx-auto max-w-md px-4 py-14 sm:px-6 lg:px-8">
      <AdminLoginForm />
    </section>
  );
}
