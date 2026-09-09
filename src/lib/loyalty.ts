import type { LoyaltyTier, Settings } from './types';

export interface TierConfig {
  tier: LoyaltyTier;
  discountRate: number;
  cashbackRate: number;
  spendingThreshold: number;
  monthlyThreshold: number;
  yearlyThreshold: number;
  birthdayBonus: number;
  dailyCashbackCap: number;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  classic_to_bronze_monthly: 100000,
  bronze_to_silver_monthly: 300000,
  bronze_to_silver_yearly: 1000000,
  silver_to_gold_monthly: 500000,
  silver_to_gold_yearly: 3000000,
  silver_stay_yearly: 3000000,
  gold_stay_yearly: 5000000,
  silver_cashback_rate: 0.05,
  gold_cashback_rate: 0.10,
  birthday_gold_cashback_rate: 0.30,
  silver_daily_cashback_cap: 15000,
  gold_daily_cashback_cap: 30000,
  bronze_discount_rate: 0.10,
  silver_discount_rate: 0.15,
  gold_discount_rate: 0.20,
  updated_at: new Date().toISOString(),
};

export function getTierConfigs(settings: Settings): Record<LoyaltyTier, TierConfig> {
  return {
    Classic: {
      tier: 'Classic',
      discountRate: 0,
      cashbackRate: 0,
      spendingThreshold: settings.classic_to_bronze_monthly,
      monthlyThreshold: settings.classic_to_bronze_monthly,
      yearlyThreshold: settings.classic_to_bronze_monthly,
      birthdayBonus: 0,
      dailyCashbackCap: 0,
    },
    Bronze: {
      tier: 'Bronze',
      discountRate: settings.bronze_discount_rate,
      cashbackRate: 0,
      spendingThreshold: settings.bronze_to_silver_yearly,
      monthlyThreshold: settings.bronze_to_silver_monthly,
      yearlyThreshold: settings.bronze_to_silver_yearly,
      birthdayBonus: 0,
      dailyCashbackCap: 0,
    },
    Silver: {
      tier: 'Silver',
      discountRate: settings.silver_discount_rate,
      cashbackRate: settings.silver_cashback_rate,
      spendingThreshold: settings.silver_to_gold_yearly,
      monthlyThreshold: settings.silver_to_gold_monthly,
      yearlyThreshold: settings.silver_to_gold_yearly,
      birthdayBonus: 0,
      dailyCashbackCap: settings.silver_daily_cashback_cap,
    },
    Gold: {
      tier: 'Gold',
      discountRate: settings.gold_discount_rate,
      cashbackRate: settings.gold_cashback_rate,
      spendingThreshold: settings.gold_stay_yearly,
      monthlyThreshold: settings.gold_stay_yearly,
      yearlyThreshold: settings.gold_stay_yearly,
      birthdayBonus: settings.birthday_gold_cashback_rate,
      dailyCashbackCap: settings.gold_daily_cashback_cap,
    },
  };
}

export const TIER_ORDER: LoyaltyTier[] = ['Classic', 'Bronze', 'Silver', 'Gold'];

export function getTierFromSpending(
  spendingSinceUpgrade: number,
  currentTier: LoyaltyTier,
  settings: Settings,
): LoyaltyTier {
  const configs = getTierConfigs(settings);
  let newTier: LoyaltyTier = currentTier;
  for (const tier of TIER_ORDER) {
    const config = configs[tier];
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
  settings: Settings,
): boolean {
  const configs = getTierConfigs(settings);
  const config = configs[currentTier];
  if (config.yearlyThreshold === 0) return false;
  return yearlySinceUpgrade < config.yearlyThreshold * 0.5;
}

export function getDiscountRate(tier: LoyaltyTier, settings?: Settings): number {
  if (!settings) {
    const defaults = getTierConfigs(DEFAULT_SETTINGS);
    return defaults[tier].discountRate;
  }
  return getTierConfigs(settings)[tier].discountRate;
}

export function getCashbackRate(tier: LoyaltyTier, isBirthday: boolean, settings?: Settings): number {
  const configs = getTierConfigs(settings || DEFAULT_SETTINGS);
  const config = configs[tier];
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

export function getDaysUntilBirthday(birthMonth: number | null, birthDay: number | null): number | null {
  if (!birthMonth || !birthDay) return null;
  const today = new Date();
  const year = today.getFullYear();
  let next = new Date(year, birthMonth - 1, birthDay);
  if (next < today) {
    next = new Date(year + 1, birthMonth - 1, birthDay);
  }
  return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export interface TierPerks {
  cafeDiscount: number;
  hondaDiscount: number;
  millenniumDiscount: number;
  cashbackRate: number;
  dailyCashbackCap: number;
  birthdayPerks: string[];
  roomUpgrade: boolean;
}

export function getTierPerks(tier: LoyaltyTier): TierPerks {
  const perks: Record<LoyaltyTier, TierPerks> = {
    Classic: {
      cafeDiscount: 0,
      hondaDiscount: 0,
      millenniumDiscount: 0,
      cashbackRate: 0,
      dailyCashbackCap: 0,
      birthdayPerks: [],
      roomUpgrade: false,
    },
    Bronze: {
      cafeDiscount: 10,
      hondaDiscount: 5,
      millenniumDiscount: 0,
      cashbackRate: 0,
      dailyCashbackCap: 0,
      birthdayPerks: ['Free drink or snack', '30% off Honda service'],
      roomUpgrade: false,
    },
    Silver: {
      cafeDiscount: 15,
      hondaDiscount: 10,
      millenniumDiscount: 5,
      cashbackRate: 5,
      dailyCashbackCap: 15000,
      birthdayPerks: ['Free drink and snack', '50% off Millennium hotel', '30% off Honda service'],
      roomUpgrade: false,
    },
    Gold: {
      cafeDiscount: 20,
      hondaDiscount: 15,
      millenniumDiscount: 10,
      cashbackRate: 10,
      dailyCashbackCap: 30000,
      birthdayPerks: [
        'Free deluxe room (1 night)',
        'Free food + drink + snack combo',
        '30% cashback',
        'VIP lounge access',
        'Optional gift delivered home',
      ],
      roomUpgrade: true,
    },
  };
  return perks[tier];
}
