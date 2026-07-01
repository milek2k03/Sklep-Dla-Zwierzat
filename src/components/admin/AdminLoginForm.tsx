"use client";

import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Nieprawidłowy e-mail lub hasło.");
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Supabase nie jest jeszcze skonfigurowany.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-[#eee7db] bg-white p-6 shadow-sm"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f5efe5] text-[#b65320]">
        <LockKeyhole className="h-5 w-5" aria-hidden="true" />
      </div>

      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
        Panel admina
      </h1>
      <p className="mt-3 text-sm leading-6 text-[#6d675f]">
        Zaloguj się kontem Supabase Auth, które ma wpis w tabeli
        <span className="font-semibold text-[#1f1f1f]"> admin_profiles</span>.
      </p>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-[#1f1f1f]">E-mail</span>
          <input
            className="field-input mt-2"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[#1f1f1f]">Hasło</span>
          <input
            className="field-input mt-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-[#fff1e8] p-3 text-sm font-medium text-[#a64022]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#1f1f1f] px-6 text-sm font-semibold text-white transition hover:bg-[#34302d] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading}
      >
        {isLoading ? "Logowanie..." : "Zaloguj"}
      </button>
    </form>
  );
}
