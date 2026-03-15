"use client";

import React from "react";
import Link from "next/link";
import { useAuth, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, StatusBadge } from "@/components/query-states";
import {
  ApiClientError,
  createBillingCheckout,
  getMyBilling,
  listBillingPlans,
} from "@aqshara/api";
import type { BillingFeatureKey, BillingPlanItem } from "@aqshara/api";

const FEATURE_LABELS: Record<BillingFeatureKey, string> = {
  upload: "Uploads",
  translation: "Translations",
  video_generation: "Video generations",
};

function formatPlanPrice(
  plan: Pick<BillingPlanItem, "price_amount" | "price_currency" | "is_free">,
) {
  if (plan.is_free || plan.price_amount === null) {
    return "Free";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: plan.price_currency,
    maximumFractionDigits: 0,
  }).format(plan.price_amount);
}

export default function BillingPage() {
  const { getToken, isLoaded } = useAuth();
  const { user } = useUser();

  const plansQuery = useQuery({
    queryKey: ["billing", "plans"],
    enabled: isLoaded,
    queryFn: () => listBillingPlans(getToken),
  });

  const meQuery = useQuery({
    queryKey: ["billing", "me"],
    enabled: isLoaded,
    queryFn: () => getMyBilling(getToken),
  });

  const checkoutMutation = useMutation({
    mutationFn: async (planCode: string) => {
      const origin = window.location.origin;
      const primaryEmail =
        user?.primaryEmailAddress?.emailAddress ??
        user?.emailAddresses[0]?.emailAddress ??
        "";
      const displayName = user?.fullName ?? user?.firstName ?? "";
      const phone = (user?.unsafeMetadata?.billing_phone as string) || "";

      return createBillingCheckout(
        {
          plan_code: planCode,
          success_url: `${origin}/billing/success`,
          return_url: `${origin}/billing/cancel`,
          customer_name: displayName.trim(),
          customer_email: primaryEmail.trim(),
          customer_phone: phone.trim(),
        },
        getToken,
      );
    },
    onSuccess: (data) => {
      if (data.data?.checkout_url) {
        window.location.href = data.data.checkout_url;
      }
    },
  });

  const isBillingDetailsError =
    checkoutMutation.error instanceof ApiClientError &&
    checkoutMutation.error.status === 400 &&
    checkoutMutation.error.message
      .toLowerCase()
      .includes("billing checkout requires");

  const billing = meQuery.data?.data;
  const effectivePlan = billing?.effective_plan;
  const subscription = billing?.subscription;
  const usage = billing?.usage.features ?? [];
  const plans = plansQuery.data?.data ?? [];

  return (
    <>
      {checkoutMutation.isError && (
        <div className="flex items-start gap-4 rounded-[16px] border border-destructive/20 bg-destructive/10 p-6">
          <HugeiconsIcon
            icon={AlertCircleIcon}
            size={24}
            className="mt-0.5 shrink-0 text-destructive"
          />
          <div className="flex-1">
            <h3 className="mb-1 text-[15px] font-semibold text-destructive">
              {isBillingDetailsError
                ? "Billing details required"
                : "Checkout failed"}
            </h3>
            <p className="text-[14px] text-destructive/80">
              {isBillingDetailsError ? (
                <>
                  Please complete your billing details in the{" "}
                  <Link href="/settings" className="underline font-medium">
                    Settings
                  </Link>{" "}
                  page before subscribing.
                </>
              ) : checkoutMutation.error instanceof Error ? (
                checkoutMutation.error.message
              ) : (
                "An unexpected error occurred."
              )}
            </p>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-[16px] border border-[#EBEBEB] bg-white shadow-sm dark:border-border dark:bg-card">
        <div className="border-b border-[#EBEBEB] px-6 py-5 dark:border-border/50">
          <h2 className="text-[17px] font-bold text-foreground">
            Current Subscription
          </h2>
        </div>
        <div className="p-6">
          {meQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : meQuery.isError ? (
            <ErrorState
              title="Failed to load subscription"
              description={
                meQuery.error instanceof Error
                  ? meQuery.error.message
                  : "Could not load your billing snapshot."
              }
              onRetry={() => meQuery.refetch()}
            />
          ) : effectivePlan ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-[18px] font-semibold text-foreground">
                    {effectivePlan.name}
                  </h3>
                  <StatusBadge
                    label={subscription?.status ?? "free"}
                    tone={
                      subscription?.status === "active"
                        ? "success"
                        : subscription?.status === "canceled"
                          ? "warning"
                          : "neutral"
                    }
                  />
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[18px] font-bold text-foreground">
                    {formatPlanPrice(
                      subscription?.plan ?? {
                        price_amount: null,
                        price_currency: "IDR",
                        is_free: effectivePlan.is_free,
                      },
                    )}
                  </span>
                  {subscription?.plan && !subscription.plan.is_free && (
                    <span className="ml-1 text-[14px] text-muted-foreground">
                      / {subscription.plan.interval}
                    </span>
                  )}
                </div>
              </div>

              {subscription?.current_period_start &&
                subscription.current_period_end && (
                  <p className="text-[14px] text-muted-foreground">
                    Current period:{" "}
                    {new Date(
                      subscription.current_period_start,
                    ).toLocaleDateString()}{" "}
                    to{" "}
                    {new Date(
                      subscription.current_period_end,
                    ).toLocaleDateString()}
                  </p>
                )}

              <div className="grid gap-3 sm:grid-cols-3">
                {usage.map((feature) => (
                  <div
                    key={feature.feature_key}
                    className="rounded-[14px] border border-[#EBEBEB] bg-[#FAFAFA] px-4 py-3 dark:border-border dark:bg-muted/30"
                  >
                    <p className="text-[13px] font-medium text-muted-foreground">
                      {FEATURE_LABELS[feature.feature_key]}
                    </p>
                    <p className="mt-1 text-[22px] font-semibold text-foreground">
                      {feature.remaining}
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      remaining of {feature.limit}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="mb-4 text-[15px] text-muted-foreground">
                Your billing plan is not available yet.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-[16px] border border-[#EBEBEB] bg-white shadow-sm dark:border-border dark:bg-card">
        <div className="border-b border-[#EBEBEB] px-6 py-5 dark:border-border/50">
          <h2 className="text-[17px] font-bold text-foreground">
            Available Plans
          </h2>
        </div>
        <div className="p-6">
          {plansQuery.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : plansQuery.isError ? (
            <ErrorState
              title="Failed to load plans"
              description={
                plansQuery.error instanceof Error
                  ? plansQuery.error.message
                  : "Could not load available plans."
              }
              onRetry={() => plansQuery.refetch()}
            />
          ) : plans.length === 0 ? (
            <EmptyState
              title="No plans available"
              description="There are currently no billing plans available to purchase."
            />
          ) : (
            <div className="grid gap-4">
              {plans.map((plan) => {
                const isCurrentPlan = effectivePlan?.code === plan.code;
                const canCheckout = plan.checkout_enabled && !plan.is_free;

                return (
                  <div
                    key={plan.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-[#EBEBEB] p-5 dark:border-border sm:flex-row sm:items-center"
                  >
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-[16px] font-semibold text-foreground">
                          {plan.name}
                        </h3>
                        {isCurrentPlan && (
                          <StatusBadge label="Current plan" tone="success" />
                        )}
                      </div>
                      <p className="mb-2 text-[14px] text-muted-foreground">
                        {plan.description}
                      </p>
                      <div className="font-medium text-foreground">
                        {formatPlanPrice(plan)}
                        {!plan.is_free && (
                          <span className="ml-1 text-[14px] font-normal text-muted-foreground">
                            / {plan.interval}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        {Object.entries(plan.quotas).map(
                          ([featureKey, limit]) => (
                            <div
                              key={featureKey}
                              className="rounded-[12px] bg-[#F6F6F6] px-3 py-2 text-[13px] text-muted-foreground dark:bg-muted/40"
                            >
                              <span className="block font-medium text-foreground">
                                {limit}
                              </span>
                              {
                                FEATURE_LABELS[
                                  featureKey as BillingFeatureKey
                                ]
                              }
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        checkoutMutation.mutate(plan.code);
                      }}
                      disabled={
                        checkoutMutation.isPending ||
                        !canCheckout ||
                        isCurrentPlan
                      }
                      className="w-full sm:w-auto"
                      variant={
                        isCurrentPlan || !canCheckout ? "outline" : "default"
                      }
                    >
                      {isCurrentPlan
                        ? "Current plan"
                        : !canCheckout
                          ? "Included"
                          : checkoutMutation.isPending &&
                              checkoutMutation.variables === plan.code
                            ? "Processing..."
                            : "Subscribe"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
