import { describe, expect, it } from "vitest";
import { calculateGoalPlanPreview, formatGoalDuration } from "./utils";

describe("goal plan calculations", () => {
  it("calculates duration and an affordable contribution from live finances", () => {
    const preview = calculateGoalPlanPreview({
      targetAmount: 120_000,
      currentAmount: 20_000,
      monthlyContribution: 10_000,
      monthlyIncome: 50_000,
      monthlyExpenses: 25_000,
      otherGoalContributions: 5_000,
      isActive: true,
    });

    expect(preview.remainingAmount).toBe(100_000);
    expect(preview.estimatedMonths).toBe(10);
    expect(preview.estimatedDays).toBe(305);
    expect(preview.recommendedContribution).toBe(10_000);
    expect(preview.incomePercentage).toBe(20);
    expect(preview.availableAfterPlan).toBe(10_000);
    expect(preview.affordability).toBe("on_track");
  });

  it("reduces the recommendation when expenses and other goals use the salary", () => {
    const preview = calculateGoalPlanPreview({
      targetAmount: 50_000,
      currentAmount: 0,
      monthlyContribution: 8_000,
      monthlyIncome: 20_000,
      monthlyExpenses: 12_000,
      otherGoalContributions: 4_000,
      isActive: true,
    });

    expect(preview.recommendedContribution).toBeCloseTo(5_333.33, 2);
    expect(preview.expenseCeiling).toBe(8_000);
    expect(preview.availableAfterPlan).toBe(0);
    expect(preview.affordability).toBe("overcommitted");
  });

  it("formats long estimates in years and months", () => {
    expect(formatGoalDuration(760)).toBe("About 2 years 1 month");
  });
});
