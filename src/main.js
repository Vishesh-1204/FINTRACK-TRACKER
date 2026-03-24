// ===== FinTrack — Main Application v2 =====
import './style.css';
import { openDB } from './db.js';
import { register, login, logout, getSession } from './auth.js';
import {
  getIncome, setIncome,
  getCategories, addCategory, updateCategory, deleteCategory,
  seedDefaultCategories, copyCategoriesToMonth,
  getSavingsFund, setSavingsFund, addToSavingsFund,
  markMonthRolledOver, isMonthRolledOver,
  getBankTracker, saveBankTracker, getProjectedBalance,
} from './budget.js';
import {
  getExpenses, addExpense, updateExpense, deleteExpense,
  getTotalExpenses, getExpensesByCategories, getRemainingBalance, getDailySpending,
} from './expenses.js';
import { generateInsights, getOverspendingAlerts, getOptimizationSuggestions, suggestSavingsPlan, generateMonthlySummary } from './analytics.js';
import { getGoals, addGoal, updateGoal, deleteGoal, depositToGoal, getGoalProgress } from './goals.js';
import { renderPieChart, renderBarChart, renderLineChart } from './charts.js';

// ===== State =====
let currentUser = null;
let currentMonth = '';
let currentPage = 'dashboard';
let expenseFilter = 'all';

// ===== Utility =====
function formatMonth(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function displayMonth(monthStr) {
  const [y, m] = monthStr.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatCurrency(amount) {
  const isNegative = amount < 0;
  return (isNegative ? '-' : '') + '₹' + Math.abs(amount).toLocaleString('en-IN');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== Init =====
async function init() {
  await openDB();

  const session = getSession();
  if (session) {
    currentUser = session;
    currentMonth = formatMonth(new Date());
    await ensureDefaultCategories();
    showApp();
  } else {
    showAuth();
  }

  setupAuthListeners();
  setupNavListeners();
  setupMonthSelector();
  setupBudgetListeners();
  setupExpenseListeners();
  setupGoalListeners();
  setupAnalyticsListeners();
  setupBankTrackerListeners();
}

async function ensureDefaultCategories() {
  if (!currentUser) return;
  await seedDefaultCategories(currentUser.id, currentMonth);
}

// ===== Auth =====
function showAuth() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  document.getElementById('user-display-name').textContent = currentUser.displayName;
  document.getElementById('user-avatar').textContent = currentUser.displayName.charAt(0).toUpperCase();

  updateMonthDisplay();
  navigateTo('dashboard');
}

function setupAuthListeners() {
  document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('register-form').classList.add('active');
  });

  document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('register-form').classList.remove('active');
    document.getElementById('login-form').classList.add('active');
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
      errorEl.textContent = 'Please fill in all fields';
      return;
    }

    try {
      const user = await login(username, password);
      currentUser = { id: user.id, username: user.username, displayName: user.displayName, currency: user.currency };
      currentMonth = formatMonth(new Date());
      await ensureDefaultCategories();
      showToast(`Welcome back, ${user.displayName}!`);
      showApp();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('register-error');
    errorEl.textContent = '';
    const displayName = document.getElementById('reg-displayname').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    if (!displayName || !username || !password) {
      errorEl.textContent = 'Please fill in all fields';
      return;
    }
    if (password.length < 4) {
      errorEl.textContent = 'Password must be at least 4 characters';
      return;
    }
    if (password !== confirm) {
      errorEl.textContent = 'Passwords do not match';
      return;
    }

    try {
      const user = await register(displayName, username, password);
      currentUser = { id: user.id, username: user.username, displayName: user.displayName, currency: user.currency };
      currentMonth = formatMonth(new Date());
      await seedDefaultCategories(currentUser.id, currentMonth);
      showToast(`Welcome, ${user.displayName}! Default budget categories created.`);
      showApp();
      navigateTo('budget');
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    logout();
    currentUser = null;
    showAuth();
    document.getElementById('login-form').reset();
    document.getElementById('register-form').reset();
    document.getElementById('login-form').classList.add('active');
    document.getElementById('register-form').classList.remove('active');
  });
}

// ===== Navigation =====
function setupNavListeners() {
  const allLinks = document.querySelectorAll('[data-page]');
  allLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
  document.querySelectorAll('.bnav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
  refreshPage(page);
}

async function refreshPage(page) {
  if (!currentUser) return;
  switch (page) {
    case 'dashboard': await refreshDashboard(); break;
    case 'budget': await refreshBudget(); break;
    case 'expenses': await refreshExpenses(); break;
    case 'analytics': await refreshAnalytics(); break;
    case 'goals': await refreshGoals(); break;
  }
}

// ===== Month Selector =====
function setupMonthSelector() {
  document.getElementById('prev-month-btn').addEventListener('click', async () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 2);
    currentMonth = formatMonth(d);
    await ensureDefaultCategories();
    updateMonthDisplay();
    refreshPage(currentPage);
  });

  document.getElementById('next-month-btn').addEventListener('click', async () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m);
    currentMonth = formatMonth(d);
    await ensureDefaultCategories();
    updateMonthDisplay();
    refreshPage(currentPage);
  });
}

function updateMonthDisplay() {
  const label = displayMonth(currentMonth);
  document.getElementById('month-display').textContent = label;
  document.getElementById('current-month-label').textContent = label;
}

// ===== DASHBOARD =====
async function refreshDashboard() {
  const userId = currentUser.id;
  const income = await getIncome(userId, currentMonth);
  const categories = await getCategories(userId, currentMonth);
  const expenses = await getExpenses(userId, currentMonth);
  const totalSpent = getTotalExpenses(expenses);
  const remaining = getRemainingBalance(income, totalSpent);

  const catExpenses = getExpensesByCategories(expenses, categories);

  // Monthly Savings = actual expenses flagged as savings
  const monthlySavings = expenses
    .filter(e => e.isSavingsExpense)
    .reduce((sum, e) => sum + e.amount, 0);

  // Total Savings Fund
  const totalFund = await getSavingsFund(userId);

  document.getElementById('dash-income').textContent = formatCurrency(income);
  document.getElementById('dash-spent').textContent = formatCurrency(totalSpent);
  document.getElementById('dash-remaining').textContent = formatCurrency(remaining);
  document.getElementById('dash-monthly-savings').textContent = formatCurrency(monthlySavings);
  document.getElementById('dash-total-fund').textContent = formatCurrency(totalFund);

  // Color remaining based on health
  const remEl = document.getElementById('dash-remaining');
  remEl.style.color = remaining < 0 ? 'var(--color-danger)' : remaining < income * 0.2 ? 'var(--color-warning)' : '';

  // Charts
  const catData = Object.values(catExpenses);
  renderPieChart('chart-pie', catData);
  renderBarChart('chart-bar', catData);

  // Bank Tracker
  await refreshBankTrackerDisplay();

  // Insights
  const insights = generateInsights(income, categories, catExpenses);
  const insightsEl = document.getElementById('dash-insights');
  if (insights.length === 0) {
    insightsEl.innerHTML = '<p class="no-data">Set up your budget and add expenses to see smart insights</p>';
  } else {
    insightsEl.innerHTML = insights.map(i => `
      <div class="insight-item insight-${i.type}">
        <span class="insight-icon">${i.icon}</span>
        <span>${i.text}</span>
      </div>
    `).join('');
  }

  // Recent expenses
  const recentEl = document.getElementById('dash-recent');
  const sorted = [...expenses].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  if (sorted.length === 0) {
    recentEl.innerHTML = '<p class="no-data">No expenses yet. Start tracking!</p>';
  } else {
    recentEl.innerHTML = sorted.map(exp => {
      const cat = categories.find(c => c.id === exp.categoryId);
      return renderExpenseRow(exp, cat);
    }).join('');
  }

  document.getElementById('dash-add-expense-btn').onclick = () => navigateTo('expenses');
}

function renderExpenseRow(exp, cat, showActions = false) {
  const catName = cat ? cat.name : 'Unknown';
  const catIcon = cat ? cat.icon : '📦';
  const catColor = cat ? cat.color : '#667eea';
  const typeLabel = cat && cat.expenseType === 'fixed' ? '<span class="type-badge type-fixed">Fixed</span>' : '';

  return `
    <div class="expense-row" data-id="${exp.id}">
      <div class="expense-cat-badge" style="background:${catColor}20; color:${catColor}">${catIcon}</div>
      <div class="expense-details">
        <div class="expense-item-name">${exp.itemName} ${typeLabel}</div>
        <div class="expense-cat-name">${catName}</div>
      </div>
      <div class="expense-amount" style="color:${catColor}">-${formatCurrency(exp.amount)}</div>
      <div class="expense-date">${formatDate(exp.date)}</div>
      ${showActions ? `
        <div class="expense-actions">
          <button class="btn-icon edit-expense-btn" data-id="${exp.id}" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon delete-expense-btn" data-id="${exp.id}" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

// ===== BANK TRACKER =====
async function refreshBankTrackerDisplay() {
  const userId = currentUser.id;
  const bankData = await getBankTracker(userId);

  const totalCredits = (bankData.credits || []).reduce((s, c) => s + c.amount, 0);
  const totalDebits = (bankData.debits || []).reduce((s, d) => s + d.amount, 0);
  const projected = getProjectedBalance(bankData);

  document.getElementById('bank-balance').textContent = formatCurrency(bankData.currentBalance);
  document.getElementById('bank-credits').textContent = '+' + formatCurrency(totalCredits);
  document.getElementById('bank-debits').textContent = '-' + formatCurrency(totalDebits);
  document.getElementById('bank-projected').textContent = formatCurrency(projected);

  const projEl = document.getElementById('bank-projected');
  projEl.className = 'bank-stat-value ' + (projected < 0 ? 'negative' : 'positive');
}

function setupBankTrackerListeners() {
  document.getElementById('edit-bank-btn').addEventListener('click', openBankModal);
  document.getElementById('close-bank-modal').addEventListener('click', closeBankModal);
  document.getElementById('cancel-bank-btn').addEventListener('click', closeBankModal);
  document.querySelector('#bank-modal .modal-backdrop').addEventListener('click', closeBankModal);

  document.getElementById('add-credit-btn').addEventListener('click', () => addBankItemRow('credits'));
  document.getElementById('add-debit-btn').addEventListener('click', () => addBankItemRow('debits'));

  document.getElementById('bank-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const balance = parseInt(document.getElementById('bank-bal-input').value) || 0;

    const credits = [];
    document.querySelectorAll('#bank-credits-list .bank-item-row').forEach(row => {
      const name = row.querySelector('.bank-item-name').value.trim();
      const amount = parseInt(row.querySelector('.bank-item-amount').value) || 0;
      if (name && amount > 0) credits.push({ name, amount });
    });

    const debits = [];
    document.querySelectorAll('#bank-debits-list .bank-item-row').forEach(row => {
      const name = row.querySelector('.bank-item-name').value.trim();
      const amount = parseInt(row.querySelector('.bank-item-amount').value) || 0;
      if (name && amount > 0) debits.push({ name, amount });
    });

    await saveBankTracker(currentUser.id, { currentBalance: balance, credits, debits });
    showToast('Bank tracker updated');
    closeBankModal();
    await refreshBankTrackerDisplay();
  });
}

async function openBankModal() {
  const bankData = await getBankTracker(currentUser.id);

  document.getElementById('bank-bal-input').value = bankData.currentBalance || '';

  const creditsEl = document.getElementById('bank-credits-list');
  creditsEl.innerHTML = '';
  for (const c of (bankData.credits || [])) {
    addBankItemRow('credits', c.name, c.amount);
  }

  const debitsEl = document.getElementById('bank-debits-list');
  debitsEl.innerHTML = '';
  for (const d of (bankData.debits || [])) {
    addBankItemRow('debits', d.name, d.amount);
  }

  document.getElementById('bank-modal').classList.remove('hidden');
}

function closeBankModal() {
  document.getElementById('bank-modal').classList.add('hidden');
}

function addBankItemRow(type, name = '', amount = '') {
  const listId = type === 'credits' ? 'bank-credits-list' : 'bank-debits-list';
  const list = document.getElementById(listId);
  const row = document.createElement('div');
  row.className = 'bank-item-row';
  row.innerHTML = `
    <input type="text" class="bank-item-name" placeholder="${type === 'credits' ? 'e.g. Freelance pay' : 'e.g. Bike service'}" value="${name}" />
    <input type="number" class="bank-item-amount" placeholder="₹" min="0" value="${amount}" />
    <button type="button" class="btn-icon bank-item-remove" title="Remove">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  row.querySelector('.bank-item-remove').addEventListener('click', () => row.remove());
  list.appendChild(row);
}

// ===== BUDGET PAGE =====
async function refreshBudget() {
  const userId = currentUser.id;
  const income = await getIncome(userId, currentMonth);
  const categories = await getCategories(userId, currentMonth);
  const expenses = await getExpenses(userId, currentMonth);

  document.getElementById('income-input').value = income || '';

  // Savings fund display
  const totalFund = await getSavingsFund(userId);
  document.getElementById('current-fund-display').textContent = formatCurrency(totalFund);

  // Rollover button logic
  const isRolled = await isMonthRolledOver(userId, currentMonth);
  const rolloverBtn = document.getElementById('rollover-btn');
  if (rolloverBtn) {
    const totalSpent = getTotalExpenses(expenses);
    const remaining = getRemainingBalance(income, totalSpent);
    
    if (isRolled || remaining <= 0) {
      rolloverBtn.disabled = true;
      rolloverBtn.textContent = isRolled ? 'Already Rolled Over' : 'Nothing to Rollover';
      rolloverBtn.style.opacity = '0.5';
      rolloverBtn.style.cursor = 'not-allowed';
    } else {
      rolloverBtn.disabled = false;
      rolloverBtn.textContent = 'Rollover to Savings Fund';
      rolloverBtn.style.opacity = '1';
      rolloverBtn.style.cursor = 'pointer';
    }
  }

  const totalAllocated = categories.reduce((s, c) => s + c.budgetAmount, 0);
  const catExpenses = getExpensesByCategories(expenses, categories);

  // Allocation bar
  const barEl = document.getElementById('budget-allocation-bar');
  if (income > 0 && categories.length > 0) {
    barEl.innerHTML = categories.filter(c => c.budgetAmount > 0).map(c =>
      `<div class="alloc-segment" style="width:${(c.budgetAmount / income * 100).toFixed(1)}%; background:${c.color};" title="${c.name}: ${formatCurrency(c.budgetAmount)}"></div>`
    ).join('');
  } else {
    barEl.innerHTML = '';
  }

  const allocInfo = document.getElementById('budget-allocation-info');
  const allocPercent = income > 0 ? ((totalAllocated / income) * 100).toFixed(0) : 0;
  allocInfo.textContent = `Allocated: ${formatCurrency(totalAllocated)} / ${formatCurrency(income)} (${allocPercent}%)`;
  if (totalAllocated > income) allocInfo.style.color = 'var(--color-danger)';
  else allocInfo.style.color = '';

  // Categories grid
  const listEl = document.getElementById('categories-list');
  if (categories.length === 0) {
    listEl.innerHTML = '<p class="no-data">No categories yet. Add your first budget category!</p>';
  } else {
    // Group by type
    const fixedCats = categories.filter(c => c.expenseType === 'fixed');
    const variableCats = categories.filter(c => c.expenseType !== 'fixed');

    let html = '';
    if (fixedCats.length > 0) {
      html += '<div class="category-type-label">🔒 Fixed Expenses</div>';
      html += fixedCats.map(cat => renderCategoryCard(cat, catExpenses)).join('');
    }
    if (variableCats.length > 0) {
      html += '<div class="category-type-label">📊 Variable Expenses</div>';
      html += variableCats.map(cat => renderCategoryCard(cat, catExpenses)).join('');
    }
    listEl.innerHTML = html;

    // Event listeners
    listEl.querySelectorAll('.edit-cat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCategoryModal(btn.dataset.id);
      });
    });
    listEl.querySelectorAll('.delete-cat-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Delete this category? Expenses in this category will become uncategorized.')) {
          await deleteCategory(btn.dataset.id);
          showToast('Category deleted');
          refreshBudget();
        }
      });
    });
  }
}

function renderCategoryCard(cat, catExpenses) {
  const data = catExpenses[cat.id] || { total: 0 };
  const spent = data.total;
  const percent = cat.budgetAmount > 0 ? Math.min(100, (spent / cat.budgetAmount) * 100) : 0;
  const progressColor = spent > cat.budgetAmount ? 'var(--color-danger)' : cat.color;
  const typeBadge = cat.expenseType === 'fixed' ? '<span class="type-badge type-fixed">Fixed</span>' : '<span class="type-badge type-variable">Variable</span>';

  return `
    <div class="category-card" data-id="${cat.id}">
      <div class="category-header">
        <div class="category-name-row">
          <span class="category-icon">${cat.icon}</span>
          <span class="category-name">${cat.name}</span>
          ${typeBadge}
        </div>
        <div class="category-actions">
          <button class="btn-icon edit-cat-btn" data-id="${cat.id}" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon delete-cat-btn" data-id="${cat.id}" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      </div>
      <div class="category-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width:${percent}%; background:${progressColor}"></div>
        </div>
      </div>
      <div class="category-stats">
        <span class="category-spent" style="color:${progressColor}">${formatCurrency(spent)} spent</span>
        <span>${formatCurrency(cat.budgetAmount)} budget</span>
      </div>
    </div>
  `;
}

function setupBudgetListeners() {
  // Save income
  document.getElementById('save-income-btn').addEventListener('click', async () => {
    const amount = parseInt(document.getElementById('income-input').value) || 0;
    await setIncome(currentUser.id, currentMonth, amount);
    showToast(`Income set to ${formatCurrency(amount)}`);
    refreshBudget();
  });

  // Rollover logic
  document.getElementById('rollover-btn')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    e.target.textContent = 'Rolling over...';
    const expenses = await getExpenses(currentUser.id, currentMonth);
    const income = await getIncome(currentUser.id, currentMonth);
    const totalSpent = getTotalExpenses(expenses);
    const remaining = getRemainingBalance(income, totalSpent);

    if (remaining <= 0) {
      showToast('No remaining balance to rollover.', 'error');
      return;
    }

    const rolled = await markMonthRolledOver(currentUser.id, currentMonth, remaining);
    if (rolled) {
      showToast(`Successfully rolled over ${formatCurrency(remaining)} to Total Savings Fund!`);
      refreshBudget();
      refreshDashboard();
    } else {
      showToast('This month has already been rolled over.', 'error');
    }
  });

  // Add category
  document.getElementById('add-category-btn').addEventListener('click', () => openCategoryModal());

  // Category modal
  document.getElementById('close-category-modal').addEventListener('click', closeCategoryModal);
  document.getElementById('cancel-category-btn').addEventListener('click', closeCategoryModal);
  document.querySelector('#category-modal .modal-backdrop').addEventListener('click', closeCategoryModal);

  // Icon picker
  document.getElementById('icon-picker').addEventListener('click', (e) => {
    const option = e.target.closest('.icon-option');
    if (!option) return;
    document.querySelectorAll('#icon-picker .icon-option').forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');
  });

  // Color picker
  document.getElementById('color-picker').addEventListener('click', (e) => {
    const option = e.target.closest('.color-option');
    if (!option) return;
    document.querySelectorAll('#color-picker .color-option').forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');
  });

  // Category form submit
  document.getElementById('category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('cat-edit-id').value;
    const name = document.getElementById('cat-name').value.trim();
    const budget = parseInt(document.getElementById('cat-budget').value) || 0;
    const expenseType = document.getElementById('cat-type').value;
    const isSavingsCategory = document.getElementById('cat-is-savings').checked;
    const icon = document.querySelector('#icon-picker .icon-option.selected')?.dataset.icon || '📦';
    const color = document.querySelector('#color-picker .color-option.selected')?.dataset.color || '#667eea';

    if (!name) return;

    if (editId) {
      await updateCategory(editId, { name, budgetAmount: budget, icon, color, expenseType, isSavingsCategory });
      showToast('Category updated');
    } else {
      await addCategory(currentUser.id, currentMonth, { name, budgetAmount: budget, icon, color, expenseType, isSavingsCategory });
      showToast('Category added');
    }

    closeCategoryModal();
    refreshBudget();
  });
}

async function openCategoryModal(editId = null) {
  const modal = document.getElementById('category-modal');
  const form = document.getElementById('category-form');
  form.reset();
  document.getElementById('cat-edit-id').value = '';
  document.getElementById('cat-type').value = 'variable';
  document.getElementById('cat-is-savings').checked = false;

  // Reset pickers
  document.querySelectorAll('#icon-picker .icon-option').forEach(o => o.classList.remove('selected'));
  document.querySelector('#icon-picker .icon-option[data-icon="🍔"]').classList.add('selected');
  document.querySelectorAll('#color-picker .color-option').forEach(o => o.classList.remove('selected'));
  document.querySelector('#color-picker .color-option[data-color="#667eea"]').classList.add('selected');

  if (editId) {
    document.getElementById('category-modal-title').textContent = 'Edit Category';
    const categories = await getCategories(currentUser.id, currentMonth);
    const cat = categories.find(c => c.id === editId);
    if (cat) {
      document.getElementById('cat-edit-id').value = cat.id;
      document.getElementById('cat-name').value = cat.name;
      document.getElementById('cat-budget').value = cat.budgetAmount;
      document.getElementById('cat-type').value = cat.expenseType || 'variable';
      document.getElementById('cat-is-savings').checked = !!cat.isSavingsCategory;

      document.querySelectorAll('#icon-picker .icon-option').forEach(o => {
        o.classList.toggle('selected', o.dataset.icon === cat.icon);
      });
      document.querySelectorAll('#color-picker .color-option').forEach(o => {
        o.classList.toggle('selected', o.dataset.color === cat.color);
      });
    }
  } else {
    document.getElementById('category-modal-title').textContent = 'Add Category';
  }

  modal.classList.remove('hidden');
}

function closeCategoryModal() {
  document.getElementById('category-modal').classList.add('hidden');
}

// ===== EXPENSES PAGE =====
async function refreshExpenses() {
  const userId = currentUser.id;
  const categories = await getCategories(userId, currentMonth);
  const expenses = await getExpenses(userId, currentMonth);

  // Populate filters
  const filtersEl = document.getElementById('expense-filters');
  filtersEl.innerHTML = `<button class="filter-chip ${expenseFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>` +
    categories.map(c => `<button class="filter-chip ${expenseFilter === c.id ? 'active' : ''}" data-filter="${c.id}">${c.icon} ${c.name}</button>`).join('');

  filtersEl.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      expenseFilter = chip.dataset.filter;
      refreshExpenses();
    });
  });

  // Populate category select in modal
  const select = document.getElementById('exp-category');
  select.innerHTML = '<option value="">Select category</option>' +
    categories.map(c => `<option value="${c.id}">${c.icon} ${c.name} (${c.expenseType})</option>`).join('');

  // Filter
  let filtered = expenses;
  if (expenseFilter !== 'all') {
    filtered = expenses.filter(e => e.categoryId === expenseFilter);
  }

  filtered.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  const grouped = {};
  for (const exp of filtered) {
    if (!grouped[exp.date]) grouped[exp.date] = [];
    grouped[exp.date].push(exp);
  }

  const listEl = document.getElementById('expenses-list');
  if (filtered.length === 0) {
    listEl.innerHTML = '<p class="no-data">No expenses found. Click "+ Add Expense" to start tracking.</p>';
  } else {
    let html = '';
    for (const [date, exps] of Object.entries(grouped)) {
      html += `<div class="expenses-day-header">${formatDate(date)}</div>`;
      for (const exp of exps) {
        const cat = categories.find(c => c.id === exp.categoryId);
        html += renderExpenseRow(exp, cat, true);
      }
    }
    listEl.innerHTML = html;

    listEl.querySelectorAll('.edit-expense-btn').forEach(btn => {
      btn.addEventListener('click', () => openExpenseModal(btn.dataset.id));
    });
    listEl.querySelectorAll('.delete-expense-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Delete this expense?')) {
          try {
            await deleteExpense(btn.dataset.id);
            showToast('Expense deleted');
            refreshExpenses();
          } catch (err) {
            if (err.message === 'rate_limited') {
              showToast('Please wait a moment before trying again', 'warning');
            } else {
              showToast(err.message, 'error');
            }
          }
        }
      });
    });
  }
}

function setupExpenseListeners() {
  document.getElementById('add-expense-btn').addEventListener('click', () => openExpenseModal());
  document.getElementById('close-expense-modal').addEventListener('click', closeExpenseModal);
  document.getElementById('cancel-expense-btn').addEventListener('click', closeExpenseModal);
  document.querySelector('#expense-modal .modal-backdrop').addEventListener('click', closeExpenseModal);

  document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    try {
      const editId = document.getElementById('exp-edit-id').value;
      const categoryId = document.getElementById('exp-category').value;
      const itemName = document.getElementById('exp-item').value.trim();
      const amount = parseInt(document.getElementById('exp-amount').value) || 0;
      const date = document.getElementById('exp-date').value;

      if (!categoryId || !itemName || !amount || !date) {
        showToast('Please fill in all fields', 'error');
        return;
      }

      if (editId) {
        await updateExpense(editId, { categoryId, itemName, amount, date });
        showToast('Expense updated');
      } else {
        await addExpense(currentUser.id, currentMonth, { categoryId, itemName, amount, date });
        showToast('Expense added');
      }

      closeExpenseModal();
      refreshExpenses();
    } catch (err) {
      if (err.message === 'rate_limited') {
        showToast('Please wait a moment before adding another expense', 'warning');
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

async function openExpenseModal(editId = null) {
  const modal = document.getElementById('expense-modal');
  const form = document.getElementById('expense-form');
  form.reset();
  document.getElementById('exp-edit-id').value = '';

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('exp-date').value = today;

  const categories = await getCategories(currentUser.id, currentMonth);
  const select = document.getElementById('exp-category');
  select.innerHTML = '<option value="">Select category</option>' +
    categories.map(c => `<option value="${c.id}">${c.icon} ${c.name} (${c.expenseType})</option>`).join('');

  if (editId) {
    document.getElementById('expense-modal-title').textContent = 'Edit Expense';
    const expenses = await getExpenses(currentUser.id, currentMonth);
    const exp = expenses.find(e => e.id === editId);
    if (exp) {
      document.getElementById('exp-edit-id').value = exp.id;
      document.getElementById('exp-category').value = exp.categoryId;
      document.getElementById('exp-item').value = exp.itemName;
      document.getElementById('exp-amount').value = exp.amount;
      document.getElementById('exp-date').value = exp.date;
    }
  } else {
    document.getElementById('expense-modal-title').textContent = 'Add Expense';
  }

  modal.classList.remove('hidden');
}

function closeExpenseModal() {
  document.getElementById('expense-modal').classList.add('hidden');
}

// ===== ANALYTICS PAGE =====
async function refreshAnalytics() {
  const userId = currentUser.id;
  const income = await getIncome(userId, currentMonth);
  const categories = await getCategories(userId, currentMonth);
  const expenses = await getExpenses(userId, currentMonth);
  const catExpenses = getExpensesByCategories(expenses, categories);
  const catData = Object.values(catExpenses);

  // Overspending alerts (variable only)
  const alerts = getOverspendingAlerts(categories, catExpenses);
  const alertsEl = document.getElementById('overspending-alerts');
  if (alerts.length === 0) {
    alertsEl.innerHTML = '<p class="no-data">✅ All variable categories are within budget!</p>';
  } else {
    alertsEl.innerHTML = alerts.map(a => `
      <div class="alert-item">
        <span class="insight-icon">${a.icon}</span>
        <span>${a.text}</span>
      </div>
    `).join('');
  }

  // Optimization suggestions (variable only)
  const suggestions = getOptimizationSuggestions(income, categories, catExpenses);
  const sugEl = document.getElementById('optimization-suggestions');
  if (suggestions.length === 0) {
    sugEl.innerHTML = '<p class="no-data">Your variable spending is well-optimized!</p>';
  } else {
    sugEl.innerHTML = suggestions.map(s => `
      <div class="suggestion-item">
        <span class="insight-icon">${s.icon}</span>
        <span>${s.text}</span>
      </div>
    `).join('');
  }

  // Charts
  renderPieChart('chart-analytics-pie', catData);
  const dailyData = getDailySpending(expenses);
  renderLineChart('chart-line', dailyData);

  // Monthly Summary
  const summary = generateMonthlySummary(income, categories, catExpenses, expenses);
  const summaryEl = document.getElementById('monthly-summary');

  if (income === 0 && expenses.length === 0) {
    summaryEl.innerHTML = '<p class="no-data">No data for this month. Set your income and start tracking!</p>';
  } else {
    summaryEl.innerHTML = `
      <div class="summary-stat">
        <span class="summary-stat-value">${formatCurrency(summary.income)}</span>
        <span class="summary-stat-label">Total Income</span>
      </div>
      <div class="summary-stat">
        <span class="summary-stat-value negative">${formatCurrency(summary.totalSpent)}</span>
        <span class="summary-stat-label">Total Spent</span>
      </div>
      <div class="summary-stat">
        <span class="summary-stat-value">${formatCurrency(summary.fixedSpent)}</span>
        <span class="summary-stat-label">Fixed Expenses</span>
      </div>
      <div class="summary-stat">
        <span class="summary-stat-value">${formatCurrency(summary.variableSpent)}</span>
        <span class="summary-stat-label">Variable Expenses</span>
      </div>
      <div class="summary-stat">
        <span class="summary-stat-value ${summary.remaining >= 0 ? 'positive' : 'negative'}">${formatCurrency(summary.remaining)}</span>
        <span class="summary-stat-label">Remaining Balance</span>
      </div>
      <div class="summary-stat">
        <span class="summary-stat-value">${summary.savingsRate}%</span>
        <span class="summary-stat-label">Savings Rate</span>
      </div>
      <div class="summary-stat">
        <span class="summary-stat-value">${summary.highestCategory}</span>
        <span class="summary-stat-label">Top Variable (${formatCurrency(summary.highestAmount)})</span>
      </div>
      <div class="summary-stat">
        <span class="summary-stat-value">${summary.totalItems}</span>
        <span class="summary-stat-label">Total Expenses</span>
      </div>
      <div class="summary-stat">
        <span class="summary-stat-value">${formatCurrency(summary.avgPerExpense)}</span>
        <span class="summary-stat-label">Avg per Expense</span>
      </div>
      <div class="summary-stat">
        <span class="summary-stat-value ${summary.overBudgetCount > 0 ? 'negative' : 'positive'}">${summary.overBudgetCount}</span>
        <span class="summary-stat-label">Over Budget (Variable)</span>
      </div>
    `;
  }
}

function setupAnalyticsListeners() {
  document.getElementById('goal-engine-btn').addEventListener('click', async () => {
    const amount = parseInt(document.getElementById('goal-engine-input').value) || 0;
    if (amount <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }

    const userId = currentUser.id;
    const categories = await getCategories(userId, currentMonth);
    const expenses = await getExpenses(userId, currentMonth);
    const catExpenses = getExpensesByCategories(expenses, categories);

    const plan = suggestSavingsPlan(amount, categories, catExpenses);
    const resultsEl = document.getElementById('goal-engine-results');

    if (plan.steps.length === 0) {
      resultsEl.innerHTML = '<p class="no-data">Not enough variable spending data to suggest a plan. Add more expenses in variable categories.</p>';
      return;
    }

    let html = '<div class="goal-plan-header">Here\'s how to save ' + formatCurrency(amount) + ':</div>';
    html += plan.steps.map(s => `
      <div class="suggestion-item">
        <span class="insight-icon">${s.icon}</span>
        <span>${s.text}</span>
      </div>
    `).join('');

    if (plan.achievable) {
      html += `<div class="suggestion-item" style="border-color: var(--color-success)">
        <span class="insight-icon">✅</span>
        <span>Total savable: <strong>${formatCurrency(plan.totalSavable)}</strong> — Goal of ${formatCurrency(amount)} is <strong>achievable</strong> by reducing only variable expenses!</span>
      </div>`;
    } else {
      html += `<div class="suggestion-item" style="border-color: var(--color-warning)">
        <span class="insight-icon">⚠️</span>
        <span>Can save ${formatCurrency(plan.totalSavable)} from variable expenses but still short by ${formatCurrency(plan.shortfall)}. Consider increasing income or setting a smaller goal.</span>
      </div>`;
    }

    resultsEl.innerHTML = html;
  });
}

// ===== GOALS PAGE =====
async function refreshGoals() {
  const userId = currentUser.id;
  const goals = await getGoals(userId);

  const listEl = document.getElementById('goals-list');
  if (goals.length === 0) {
    listEl.innerHTML = '<p class="no-data">No savings goals yet. Create one to start working toward your financial targets!</p>';
  } else {
    listEl.innerHTML = goals.map(goal => {
      const progress = getGoalProgress(goal);
      const circumference = 2 * Math.PI * 34;
      const dashOffset = circumference - (progress.percent / 100) * circumference;
      const ringColor = progress.isCompleted ? 'var(--color-success)' : 'var(--color-primary)';

      return `
        <div class="goal-card" data-id="${goal.id}">
          <div class="goal-header">
            <span class="goal-name">${goal.name}</span>
            <div class="goal-actions">
              <button class="btn-icon delete-goal-btn" data-id="${goal.id}" title="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>
          </div>
          <div class="goal-progress-ring">
            <div class="goal-ring-container">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6"/>
                <circle cx="40" cy="40" r="34" fill="none" stroke="${ringColor}" stroke-width="6"
                  stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
                  stroke-linecap="round" style="transition: stroke-dashoffset 0.6s ease"/>
              </svg>
              <div class="goal-ring-text">${Math.round(progress.percent)}%</div>
            </div>
            <div class="goal-amounts">
              <div class="goal-saved-amount">${formatCurrency(goal.currentAmount)}</div>
              <div class="goal-target-amount">of ${formatCurrency(goal.targetAmount)}</div>
              ${!progress.isCompleted && progress.remaining > 0 ? `<div class="goal-target-amount">${formatCurrency(progress.remaining)} to go</div>` : ''}
            </div>
          </div>
          <div class="goal-deadline">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${goal.deadline ? `Target: ${formatDate(goal.deadline)}` : 'No deadline set'}
            ${progress.daysLeft > 0 ? ` (${progress.daysLeft} days left)` : ''}
            ${progress.isCompleted ? ' <strong style="color:var(--color-success)">🎉 Completed!</strong>' : ''}
          </div>
          ${!progress.isCompleted ? `
            <div class="goal-deposit-row">
              <input type="number" placeholder="Add savings..." min="1" class="goal-deposit-input" data-id="${goal.id}" />
              <button class="btn btn-sm btn-primary goal-deposit-btn" data-id="${goal.id}">+ Add</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.delete-goal-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Delete this savings goal?')) {
          await deleteGoal(btn.dataset.id);
          showToast('Goal deleted');
          refreshGoals();
        }
      });
    });

    listEl.querySelectorAll('.goal-deposit-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const input = listEl.querySelector(`.goal-deposit-input[data-id="${btn.dataset.id}"]`);
        const amount = parseInt(input.value) || 0;
        if (amount <= 0) {
          showToast('Enter a valid amount', 'error');
          return;
        }
        await depositToGoal(btn.dataset.id, amount);
        showToast(`${formatCurrency(amount)} added to goal!`);
        refreshGoals();
      });
    });
  }
}

function setupGoalListeners() {
  document.getElementById('add-goal-btn').addEventListener('click', () => openGoalModal());
  document.getElementById('close-goal-modal').addEventListener('click', closeGoalModal);
  document.getElementById('cancel-goal-btn').addEventListener('click', closeGoalModal);
  document.querySelector('#goal-modal .modal-backdrop').addEventListener('click', closeGoalModal);

  document.getElementById('goal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('goal-edit-id').value;
    const name = document.getElementById('goal-name').value.trim();
    const targetAmount = parseInt(document.getElementById('goal-target').value) || 0;
    const currentAmount = parseInt(document.getElementById('goal-saved').value) || 0;
    const deadline = document.getElementById('goal-deadline').value;

    if (!name || targetAmount <= 0) {
      showToast('Please fill in the goal name and target amount', 'error');
      return;
    }

    if (editId) {
      await updateGoal(editId, { name, targetAmount, currentAmount, deadline });
      showToast('Goal updated');
    } else {
      await addGoal(currentUser.id, { name, targetAmount, currentAmount, deadline });
      showToast('Goal created!');
    }

    closeGoalModal();
    refreshGoals();
  });
}

function openGoalModal(editId = null) {
  const modal = document.getElementById('goal-modal');
  const form = document.getElementById('goal-form');
  form.reset();
  document.getElementById('goal-edit-id').value = '';

  if (editId) {
    document.getElementById('goal-modal-title').textContent = 'Edit Goal';
  } else {
    document.getElementById('goal-modal-title').textContent = 'New Savings Goal';
  }

  modal.classList.remove('hidden');
}

function closeGoalModal() {
  document.getElementById('goal-modal').classList.add('hidden');
}

// ===== Start the app =====
init();
