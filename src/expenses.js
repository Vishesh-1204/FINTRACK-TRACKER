// ===== Expenses Module =====
import { generateId, addRecord, putRecord, deleteRecord, getAllByIndex, getRecord } from './db.js';
import { addToSavingsFund } from './budget.js';

// Lightweight safeguard to rate-limit raw operations (prevents 0ms double-fires)
let lastOperationTime = 0;
function isRateLimited() {
  const now = Date.now();
  if (now - lastOperationTime < 400) {
    return true;
  }
  lastOperationTime = now;
  return false;
}

async function getExpenses(userId, month) {
  return getAllByIndex('expenses', 'userMonth', [userId, month]);
}

async function getExpensesByCategory(categoryId) {
  return getAllByIndex('expenses', 'categoryId', categoryId);
}

async function addExpense(userId, month, data) {
  if (isRateLimited()) throw new Error('rate_limited');

  const category = await getRecord('categories', data.categoryId);
  const isSavings = category ? !!category.isSavingsCategory : false;

  const expense = {
    id: generateId(),
    userId,
    month,
    categoryId: data.categoryId,
    itemName: data.itemName.trim(),
    amount: data.amount,
    date: data.date,
    isSavingsExpense: isSavings,
    createdAt: Date.now(),
  };
  await addRecord('expenses', expense);

  // Auto-sync savings fund natively via snapshot
  if (isSavings) {
    await addToSavingsFund(userId, data.amount);
  }

  return expense;
}

async function updateExpense(expenseId, data) {
  if (isRateLimited()) throw new Error('rate_limited');

  const existing = await getRecord('expenses', expenseId);
  if (!existing) throw new Error('Expense not found');

  const newCategory = await getRecord('categories', data.categoryId);
  const isSavingsUpdated = newCategory ? !!newCategory.isSavingsCategory : false;

  // Revert old savings amount relying on historical snapshot
  if (existing.isSavingsExpense) {
    await addToSavingsFund(existing.userId, -existing.amount);
  }

  existing.isSavingsExpense = isSavingsUpdated;
  Object.assign(existing, data);
  await putRecord('expenses', existing);

  // Apply new savings amount
  if (isSavingsUpdated) {
    await addToSavingsFund(existing.userId, existing.amount);
  }

  return existing;
}

async function deleteExpense(expenseId) {
  if (isRateLimited()) throw new Error('rate_limited');

  const existing = await getRecord('expenses', expenseId);
  if (existing) {
    // Revert securely using snapshot
    if (existing.isSavingsExpense) {
      await addToSavingsFund(existing.userId, -existing.amount);
    }
  }
  return deleteRecord('expenses', expenseId);
}

// ----- Calculation Helpers -----
function getTotalExpenses(expenses) {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

function getExpensesByCategories(expenses, categories) {
  const map = {};
  for (const cat of categories) {
    map[cat.id] = {
      category: cat,
      expenses: [],
      total: 0,
    };
  }
  for (const exp of expenses) {
    if (map[exp.categoryId]) {
      map[exp.categoryId].expenses.push(exp);
      map[exp.categoryId].total += exp.amount;
    }
  }
  return map;
}

function getRemainingBalance(income, totalExpenses) {
  return income - totalExpenses;
}

function getSavings(income, totalExpenses, categories) {
  // Savings = income - total allocated budget expenses (excluding savings category)
  // Simple: remaining balance is effective savings
  return Math.max(0, income - totalExpenses);
}

function getDailySpending(expenses) {
  const dailyMap = {};
  for (const exp of expenses) {
    const date = exp.date;
    if (!dailyMap[date]) dailyMap[date] = 0;
    dailyMap[date] += exp.amount;
  }
  return Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));
}

export {
  getExpenses, getExpensesByCategory, addExpense, updateExpense, deleteExpense,
  getTotalExpenses, getExpensesByCategories, getRemainingBalance, getSavings, getDailySpending
};
