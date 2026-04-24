import type { UserType } from "@/lib/supabase/types";

type Entitlements = {
  maxMessagesPerHour: number;
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  regular: {
    maxMessagesPerHour: 10,
  },
};
