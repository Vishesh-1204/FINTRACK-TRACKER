// ===== Budget & Category Logic =====
import { generateId, addRecord, putRecord, deleteRecord, getAllByIndex, getByIndex, getRecord } from './db.js';

// ===== Default Categories =====
// expenseType: 'fixed' = cannot be reduced (rent, EMI), 'variable' = can be optimized
const DEFAULT_CATEGORIES = [
  { name: 'Rent',          icon: '🏠', color: '#764ba2', budgetAmount: 0, expenseType: 'fixed' },
  { name: 'EMI',           icon: '🏦', color: '#667eea', budgetAmount: 0, expenseType: 'fixed' },
  { name: 'Electricity',   icon: '⚡', color: '#ffd93d', budgetAmount: 0, expenseType: 'fixed' },
  { name: 'Food',          icon: '🍔', color: '#ff9a76', budgetAmount: 0, expenseType: 'variable' },
  { name: 'Petrol',        icon: '⛽', color: '#4facfe', budgetAmount: 0, expenseType: 'variable' },
  { name: 'Miscellaneous', icon: '📦', color: '#f093fb', budgetAmount: 0, expenseType: 'variable' },
  { name: 'Personal Care', icon: '💊', color: '#a8e6cf', budgetAmount: 0, expenseType: 'variable' },
  { name: 'Entertainment', icon: '🎬', color: '#ff6b6b', budgetAmount: 0, expenseType: 'variable' },
  { name: 'Education',     icon: '📚', color: '#6bcb77', budgetAmount: 0, expenseType: 'variable' },
  { name: 'Savings',       icon: '💰', color: '#00d4aa', budgetAmount: 0, expenseType: 'fixed', isSavingsCategory: true },
];

// ----- Income -----
async function getIncome(userId, month) {
  const record = await getByIndex('income', 'userMonth', [userId, month]);
  return record ? record.amount : 0;
}

async function setIncome(userId, month, amount) {
  const existing = await getByIndex('income', 'userMonth', [userId, month]);
  if (existing) {
    existing.amount = amount;
    return putRecord('income', existing);
  } else {
    return addRecord('income', {
      id: generateId(),
      userId,
      month,
      amount,
    });
  }
}

// ----- Categories -----
async function getCategories(userId, month) {
  return getAllByIndex('categories', 'userMonth', [userId, month]);
}

async function addCategory(userId, month, data) {
  const category = {
    id: generateId(),
    userId,
    month,
    name: data.name,
    icon: data.icon || '📦',
    color: data.color || '#667eea',
    budgetAmount: data.budgetAmount || 0,
    expenseType: data.expenseType || 'variable', // 'fixed' or 'variable'
    isSavingsCategory: !!data.isSavingsCategory,
    createdAt: Date.now(),
  };
  return addRecord('categories', category);
}

async function updateCategory(categoryId, data) {
  const existing = await getRecord('categories', categoryId);
  if (!existing) throw new Error('Category not found');
  Object.assign(existing, data);
  return putRecord('categories', existing);
}

async function deleteCategory(categoryId) {
  return deleteRecord('categories', categoryId);
}

// ----- Seed default categories for a new user/month -----
async function seedDefaultCategories(userId, month) {
  const existing = await getCategories(userId, month);
  if (existing.length > 0) return; // already has categories

  for (const cat of DEFAULT_CATEGORIES) {
    await addCategory(userId, month, { ...cat });
  }
}

// ----- Copy categories to new month -----
async function copyCategoriesToMonth(userId, fromMonth, toMonth) {
  const existing = await getCategories(userId, toMonth);
  if (existing.length > 0) return;

  const fromCats = await getCategories(userId, fromMonth);
  if (fromCats.length > 0) {
    for (const cat of fromCats) {
      await addCategory(userId, toMonth, {
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        budgetAmount: cat.budgetAmount,
        expenseType: cat.expenseType || 'variable',
        isSavingsCategory: !!cat.isSavingsCategory,
      });
    }
  } else {
    // No previous month data — seed defaults
    await seedDefaultCategories(userId, toMonth);
  }
}

// ----- Savings Fund (accumulated total savings across all months) -----
async function getSavingsFund(userId) {
  const record = await getByIndex('savingsFund', 'userId', userId);
  return record ? record.totalAmount : 0;
}

async function setSavingsFund(userId, totalAmount) {
  const existing = await getByIndex('savingsFund', 'userId', userId);
  if (existing) {
    existing.totalAmount = totalAmount;
    return putRecord('savingsFund', existing);
  } else {
    return addRecord('savingsFund', {
      id: generateId(),
      userId,
      totalAmount,
      rollovers: [],
    });
  }
}

async function addToSavingsFund(userId, amount) {
  const currentObj = await getByIndex('savingsFund', 'userId', userId);
  const currentTotal = currentObj ? currentObj.totalAmount : 0;
  return setSavingsFund(userId, currentTotal + amount);
}

// ----- Rollover Management -----
async function markMonthRolledOver(userId, month, amount) {
  const existing = await getByIndex('savingsFund', 'userId', userId);
  const data = existing || { id: generateId(), userId, totalAmount: 0, rollovers: [] };
  if (!data.rollovers) data.rollovers = [];
  
  if (data.rollovers.includes(month)) return false;
  
  data.rollovers.push(month);
  data.totalAmount += amount;
  
  if (existing) {
    await putRecord('savingsFund', data);
  } else {
    await addRecord('savingsFund', data);
  }
  return true;
}

async function isMonthRolledOver(userId, month) {
  const existing = await getByIndex('savingsFund', 'userId', userId);
  return existing && existing.rollovers && existing.rollovers.includes(month);
}

// ----- Bank Tracker -----
async function getBankTracker(userId) {
  const record = await getByIndex('bankTracker', 'userId', userId);
  return record || {
    id: null,
    userId,
    currentBalance: 0,
    credits: [],   // [{ name, amount }]
    debits: [],    // [{ name, amount }]
  };
}

async function saveBankTracker(userId, data) {
  const existing = await getByIndex('bankTracker', 'userId', userId);
  if (existing) {
    existing.currentBalance = data.currentBalance;
    existing.credits = data.credits;
    existing.debits = data.debits;
    return putRecord('bankTracker', existing);
  } else {
    return addRecord('bankTracker', {
      id: generateId(),
      userId,
      currentBalance: data.currentBalance,
      credits: data.credits || [],
      debits: data.debits || [],
    });
  }
}

function getProjectedBalance(bankData) {
  const totalCredits = (bankData.credits || []).reduce((s, c) => s + c.amount, 0);
  const totalDebits = (bankData.debits || []).reduce((s, d) => s + d.amount, 0);
  return bankData.currentBalance + totalCredits - totalDebits;
}

export {
  DEFAULT_CATEGORIES,
  getIncome, setIncome,
  getCategories, addCategory, updateCategory, deleteCategory,
  seedDefaultCategories, copyCategoriesToMonth,
  getSavingsFund, setSavingsFund, addToSavingsFund,
  markMonthRolledOver, isMonthRolledOver,
  getBankTracker, saveBankTracker, getProjectedBalance,
};
