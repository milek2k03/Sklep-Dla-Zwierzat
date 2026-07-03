import type { Database } from "@/types/supabase";

export type ReturnCondition =
  Database["public"]["Tables"]["return_case_items"]["Row"]["return_condition"];
export type RestockAction =
  Database["public"]["Tables"]["return_case_items"]["Row"]["restock_action"];

type ReturnItemLike = {
  restock_action?: "pending" | "restock" | "discard" | null;
  return_condition?: ReturnCondition | null;
  returnCondition?: ReturnCondition | null;
};

export const returnConditions = [
  "sellable",
  "unsellable",
  "needs_review",
] as const satisfies readonly ReturnCondition[];

export const returnConditionLabels: Record<ReturnCondition, string> = {
  sellable: "Wraca na magazyn",
  unsellable: "Nie wraca na magazyn",
  needs_review: "Wymaga sprawdzenia",
};

export const returnConditionBadgeClasses: Record<ReturnCondition, string> = {
  sellable: "bg-[#e8f4ea] text-[#2f6b3f]",
  unsellable: "bg-[#fff1e8] text-[#a64022]",
  needs_review: "bg-[#f7f1e8] text-[#6d675f]",
};

export function getReturnCondition(item: ReturnItemLike): ReturnCondition {
  if (item.return_condition ?? item.returnCondition) {
    return (item.return_condition ?? item.returnCondition) as ReturnCondition;
  }

  if (item.restock_action === "restock") {
    return "sellable";
  }

  if (item.restock_action === "discard") {
    return "unsellable";
  }

  return "needs_review";
}

export function getReturnConditionLabel(
  condition: ReturnCondition | string | null | undefined,
) {
  if (condition === "sellable") {
    return returnConditionLabels.sellable;
  }

  if (condition === "unsellable") {
    return returnConditionLabels.unsellable;
  }

  return returnConditionLabels.needs_review;
}

export function shouldReturnToStock(item: ReturnItemLike) {
  return getReturnCondition(item) === "sellable";
}

export function isInventoryLoss(item: ReturnItemLike) {
  return getReturnCondition(item) === "unsellable";
}

export function getReturnToStock(condition: ReturnCondition) {
  return condition === "sellable";
}

export function getRestockActionForCondition(
  condition: ReturnCondition,
): RestockAction {
  if (condition === "sellable") {
    return "restock";
  }

  if (condition === "unsellable") {
    return "discard";
  }

  return "pending";
}
