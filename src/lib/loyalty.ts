import type { LoyaltyTier } from './types';

export interface TierConfig {
  tier: LoyaltyTier;
  discountRate: number;
  cashbackRate: number;
  spendingThreshold: number;
  monthlyThreshold: number;
  yearlyThreshold: number;
  birthdayBonus: number;
}

export const TIER_CONFIGS: Record<LoyaltyTier, TierConfig> = {
  Classic: {
    tier: 'Classic',
    discountRate: 0,
    cashbackRate: 0,
    spendingThreshold: 0,
    monthlyThreshold: 0,
    yearlyThreshold: 0,
    birthdayBonus: 0,
  },
  Bronze: {
    tier: 'Bronze',
    discountRate: 0.10,
    cashbackRate: 0.05,
    spendingThreshold: 500000,
    monthlyThreshold: 100000,
    yearlyThreshold: 1000000,
    birthdayBonus: 0,
  },
  Silver: {
    tier: 'Silver',
    discountRate: 0.15,
    cashbackRate: 0.07,
    spendingThreshold: 1500000,
    monthlyThreshold: 300000,
    yearlyThreshold: 3000000,
    birthdayBonus: 0,
  },
  Gold: {
    tier: 'Gold',
    discountRate: 0.20,
    cashbackRate: 0.10,
    spendingThreshold: 3000000,
    monthlyThreshold: 500000,
    yearlyThreshold: 5000000,
    birthdayBonus: 0.15,
  },
};

export const TIER_ORDER: LoyaltyTier[] = ['Classic', 'Bronze', 'Silver', 'Gold'];

export function getTierFromSpending(
  spendingSinceUpgrade: number,
  currentTier: LoyaltyTier,
): LoyaltyTier {
  let newTier: LoyaltyTier = currentTier;
  for (const tier of TIER_ORDER) {
    const config = TIER_CONFIGS[tier];
    if (spendingSinceUpgrade >= config.spendingThreshold && config.spendingThreshold > 0) {
      newTier = tier;
    }
  }
  return newTier;
}

export function shouldDowngrade(
  monthlySinceUpgrade: number,
  yearlySinceUpgrade: number,
  currentTier: LoyaltyTier,
): boolean {
  const config = TIER_CONFIGS[currentTier];
  if (config.monthlyThreshold === 0) return false;
  return monthlySinceUpgrade < config.monthlyThreshold * 0.5 ||
    yearlySinceUpgrade < config.yearlyThreshold * 0.5;
}

export function getDiscountRate(tier: LoyaltyTier): number {
  return TIER_CONFIGS[tier].discountRate;
}

export function getCashbackRate(tier: LoyaltyTier, isBirthday: boolean): number {
  const config = TIER_CONFIGS[tier];
  if (isBirthday && config.birthdayBonus > 0) {
    return config.cashbackRate + config.birthdayBonus;
  }
  return config.cashbackRate;
}

export function isBirthdayMonth(birthdate: string): boolean {
  const today = new Date();
  const birth = new Date(birthdate);
  return today.getMonth() === birth.getMonth();
}
