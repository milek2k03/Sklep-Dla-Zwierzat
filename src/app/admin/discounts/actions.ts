"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  normalizeDiscountCode,
  serializeWeekdays,
  type DiscountScopeType,
  type DiscountTimeMode,
} from "@/lib/discounts";
import { getAdminSession } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type DiscountInsert = Database["public"]["Tables"]["discount_codes"]["Insert"];
type DiscountUpdate = Database["public"]["Tables"]["discount_codes"]["Update"];

const scopeTypes: DiscountScopeType[] = ["all", "category", "product"];
const timeModes: DiscountTimeMode[] = ["permanent", "scheduled", "recurring"];

export async function createDiscountAction(formData: FormData) {
  await requireAdmin();

  const discount = parseDiscountForm(formData);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("discount_codes").insert(discount);

  if (error) {
    redirect(`/admin/discounts?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/discounts");
  redirect("/admin/discounts?saved=1");
}

export async function updateDiscountAction(formData: FormData) {
  await requireAdmin();

  const id = getRequiredString(formData, "id");
  const discount = parseDiscountForm(formData);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("discount_codes")
    .update(discount as DiscountUpdate)
    .eq("id", id);

  if (error) {
    redirect(`/admin/discounts?edit=${id}&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/discounts");
  redirect("/admin/discounts?saved=1");
}

export async function deleteDiscountAction(formData: FormData) {
  await requireAdmin();

  const id = getRequiredString(formData, "id");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("discount_codes").delete().eq("id", id);

  if (error) {
    redirect(`/admin/discounts?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/discounts");
  redirect("/admin/discounts?saved=1");
}

async function requireAdmin() {
  const adminSession = await getAdminSession();

  if (adminSession.status !== "admin") {
    redirect("/admin/login");
  }
}

function parseDiscountForm(formData: FormData): DiscountInsert {
  const code = normalizeDiscountCode(getRequiredString(formData, "code"));
  const percent = clampPercent(getRequiredInteger(formData, "percent"));
  const scopeType = getRequiredString(formData, "scopeType") as DiscountScopeType;
  const timeMode = getRequiredString(formData, "timeMode") as DiscountTimeMode;

  if (!scopeTypes.includes(scopeType)) {
    throw new Error("Niepoprawny zakres rabatu.");
  }

  if (!timeModes.includes(timeMode)) {
    throw new Error("Niepoprawny tryb czasowy rabatu.");
  }

  const scopeValue = getScopeValue(formData, scopeType);
  const timeValues = getTimeValues(formData, timeMode);

  return {
    code,
    percent,
    scope_type: scopeType,
    scope_value: scopeValue,
    time_mode: timeMode,
    starts_at: timeValues.startsAt,
    ends_at: timeValues.endsAt,
    weekdays: timeValues.weekdays,
    is_active: formData.get("isActive") === "on",
  };
}

function getScopeValue(formData: FormData, scopeType: DiscountScopeType) {
  if (scopeType === "all") {
    return null;
  }

  if (scopeType === "category") {
    return getRequiredString(formData, "scopeCategory");
  }

  return getRequiredString(formData, "scopeProduct");
}

function getTimeValues(formData: FormData, timeMode: DiscountTimeMode) {
  if (timeMode === "permanent") {
    return { startsAt: null, endsAt: null, weekdays: [] };
  }

  if (timeMode === "scheduled") {
    return {
      startsAt: getDateTime(formData, "startsAt"),
      endsAt: getDateTime(formData, "endsAt"),
      weekdays: [],
    };
  }

  const weekdays = serializeWeekdays(formData);

  if (weekdays.length === 0) {
    throw new Error("Wybierz co najmniej jeden dzień tygodnia.");
  }

  return { startsAt: null, endsAt: null, weekdays };
}

function getRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Pole ${key} jest wymagane.`);
  }

  return value.trim();
}

function getRequiredInteger(formData: FormData, key: string) {
  const value = Number(getRequiredString(formData, key));

  if (!Number.isInteger(value)) {
    throw new Error(`Pole ${key} musi być liczbą całkowitą.`);
  }

  return value;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function getDateTime(formData: FormData, key: string) {
  const value = getRequiredString(formData, key);
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Pole ${key} musi być poprawną datą.`);
  }

  return date.toISOString();
}
