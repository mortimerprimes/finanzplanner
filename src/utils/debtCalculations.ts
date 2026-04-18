import type { Debt } from '../types';

const DEFAULT_MAX_MONTHS = 600;

export interface DebtProjectionPoint {
  month: number;
  label: string;
  balance: number;
  interestPaid: number;
  principalPaid: number;
  cumulativeInterest: number;
}

export interface DebtProjection {
  feasible: boolean;
  months: number;
  totalInterest: number;
  totalPaid: number;
  payoffDate: string | null;
  monthlyPayment: number;
  startingBalance: number;
  endingBalance: number;
  schedule: DebtProjectionPoint[];
}

export interface DebtScenarioOptions {
  extraMonthlyPayment?: number;
  lumpSumPayment?: number;
  interestRateOverride?: number;
  monthlyPaymentOverride?: number;
  maxMonths?: number;
}

export function calculateRequiredMonthlyPayment(
  debt: Debt,
  targetMonths: number,
  options: Pick<DebtScenarioOptions, 'lumpSumPayment' | 'interestRateOverride'> = {}
): number {
  const months = Math.max(1, Math.round(targetMonths));
  const startingBalance = Math.max(0, debt.remainingAmount - Math.max(0, options.lumpSumPayment || 0));
  const interestRate = Math.max(0, options.interestRateOverride ?? debt.interestRate);

  if (startingBalance <= 0) {
    return 0;
  }

  if (interestRate === 0) {
    return roundCurrency(startingBalance / months);
  }

  const monthlyRate = interestRate / 100 / 12;
  const payment = startingBalance * (monthlyRate / (1 - (1 + monthlyRate) ** -months));
  return roundCurrency(payment);
}

function addMonthsToIsoDate(startDate: string, months: number): string {
  const baseDate = Number.isNaN(new Date(startDate).getTime()) ? new Date() : new Date(startDate);
  const nextDate = new Date(baseDate);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate.toISOString();
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateDebtProjection(
  debt: Debt,
  options: DebtScenarioOptions = {}
): DebtProjection {
  const extraMonthlyPayment = Math.max(0, options.extraMonthlyPayment || 0);
  const lumpSumPayment = Math.max(0, options.lumpSumPayment || 0);
  const interestRate = Math.max(0, options.interestRateOverride ?? debt.interestRate);
  const maxMonths = Math.max(1, options.maxMonths || DEFAULT_MAX_MONTHS);
  const monthlyPayment = Math.max(0, options.monthlyPaymentOverride ?? (debt.monthlyPayment + extraMonthlyPayment));
  const startingBalance = Math.max(0, debt.remainingAmount - lumpSumPayment);
  const schedule: DebtProjectionPoint[] = [{
    month: 0,
    label: 'Start',
    balance: roundCurrency(startingBalance),
    interestPaid: 0,
    principalPaid: 0,
    cumulativeInterest: 0,
  }];

  if (startingBalance <= 0) {
    return {
      feasible: true,
      months: 0,
      totalInterest: 0,
      totalPaid: roundCurrency(Math.min(lumpSumPayment, debt.remainingAmount)),
      payoffDate: new Date().toISOString(),
      monthlyPayment,
      startingBalance,
      endingBalance: 0,
      schedule,
    };
  }

  if (monthlyPayment <= 0) {
    return {
      feasible: false,
      months: Infinity,
      totalInterest: 0,
      totalPaid: 0,
      payoffDate: null,
      monthlyPayment,
      startingBalance,
      endingBalance: startingBalance,
      schedule,
    };
  }

  const monthlyRate = interestRate / 100 / 12;
  if (monthlyRate > 0 && monthlyPayment <= startingBalance * monthlyRate) {
    return {
      feasible: false,
      months: Infinity,
      totalInterest: 0,
      totalPaid: 0,
      payoffDate: null,
      monthlyPayment,
      startingBalance,
      endingBalance: startingBalance,
      schedule,
    };
  }

  let remainingBalance = startingBalance;
  let cumulativeInterest = 0;
  let totalPaid = 0;

  for (let month = 1; month <= maxMonths; month += 1) {
    const interestPayment = roundCurrency(remainingBalance * monthlyRate);
    const paymentThisMonth = roundCurrency(Math.min(monthlyPayment, remainingBalance + interestPayment));
    const principalPayment = roundCurrency(Math.max(0, paymentThisMonth - interestPayment));

    cumulativeInterest = roundCurrency(cumulativeInterest + interestPayment);
    totalPaid = roundCurrency(totalPaid + paymentThisMonth);
    remainingBalance = roundCurrency(Math.max(0, remainingBalance - principalPayment));

    schedule.push({
      month,
      label: `${month}`,
      balance: remainingBalance,
      interestPaid: interestPayment,
      principalPaid: principalPayment,
      cumulativeInterest,
    });

    if (remainingBalance <= 0.01) {
      return {
        feasible: true,
        months: month,
        totalInterest: cumulativeInterest,
        totalPaid: roundCurrency(totalPaid + Math.min(lumpSumPayment, debt.remainingAmount)),
        payoffDate: addMonthsToIsoDate(debt.startDate || new Date().toISOString(), month),
        monthlyPayment,
        startingBalance,
        endingBalance: 0,
        schedule,
      };
    }
  }

  return {
    feasible: false,
    months: Infinity,
    totalInterest: cumulativeInterest,
    totalPaid: roundCurrency(totalPaid + Math.min(lumpSumPayment, debt.remainingAmount)),
    payoffDate: null,
    monthlyPayment,
    startingBalance,
    endingBalance: remainingBalance,
    schedule,
  };
}
