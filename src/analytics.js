// ===== Analytics & Smart Insights Engine =====
// v2: Fixed expenses excluded from warnings/optimization.
//     Only variable expenses are actionable.

/**
 * Generate smart insights based on spending data
 * Fixed expenses are reported neutrally; warnings only for variable ones.
 */
function generateInsights(income, categories, categoryExpenses) {
  const insights = [];
  if (income === 0) return insights;

  const totalSpent = Object.values(categoryExpenses).reduce((s, c) => s + c.total, 0);
  const variableSpent = Object.values(categoryExpenses)
    .filter(d => d.category.expenseType === 'variable')
    .reduce((s, c) => s + c.total, 0);
  const remaining = income - totalSpent;
  const spentPercent = (totalSpent / income) * 100;

  // Overall spending health
  if (spentPercent > 90) {
    insights.push({
      type: 'danger', icon: '🚨',
      text: `You've spent ${spentPercent.toFixed(0)}% of your income! Only ₹${Math.max(0, remaining).toLocaleString('en-IN')} left.`,
    });
  } else if (spentPercent > 75) {
    insights.push({
      type: 'warning', icon: '⚠️',
      text: `You've used ${spentPercent.toFixed(0)}% of your income. Consider slowing down on variable spending.`,
    });
  } else if (spentPercent < 50 && totalSpent > 0) {
    insights.push({
      type: 'positive', icon: '🎉',
      text: `Great job! You've only spent ${spentPercent.toFixed(0)}% of your income. Keep it up!`,
    });
  }

  // Category-level analysis — ONLY for variable expenses
  for (const [catId, data] of Object.entries(categoryExpenses)) {
    const { category, total } = data;
    if (category.budgetAmount <= 0 || total <= 0) continue;

    // Skip fixed expenses from overspend warnings — they can't be reduced
    if (category.expenseType === 'fixed') continue;

    const catPercent = (total / category.budgetAmount) * 100;
    const overAmount = total - category.budgetAmount;

    if (total > category.budgetAmount) {
      insights.push({
        type: 'danger', icon: '🔴',
        text: `You are overspending on ${category.name} by ₹${overAmount.toLocaleString('en-IN')} — try to bring it back within ₹${category.budgetAmount.toLocaleString('en-IN')}`,
      });
    } else if (catPercent > 70) {
      insights.push({
        type: 'warning', icon: '🟡',
        text: `You have used ${catPercent.toFixed(0)}% of your ${category.name} budget — try to stay under 90% to meet savings goals`,
      });
    } else if (catPercent < 40 && total > 0) {
      insights.push({
        type: 'positive', icon: '🟢',
        text: `${category.name} spending is well under control at ${catPercent.toFixed(0)}% of budget`,
      });
    }
  }

  // Highest variable spending category
  const sortedVariable = Object.values(categoryExpenses)
    .filter(d => d.total > 0 && d.category.expenseType === 'variable')
    .sort((a, b) => b.total - a.total);

  if (sortedVariable.length > 0) {
    const top = sortedVariable[0];
    const topPercent = variableSpent > 0 ? ((top.total / variableSpent) * 100).toFixed(0) : 0;
    insights.push({
      type: 'info', icon: '📊',
      text: `${top.category.name} is your highest variable spending at ₹${top.total.toLocaleString('en-IN')} (${topPercent}% of variable expenses)`,
    });
  }

  return insights;
}

/**
 * Detect overspending alerts — only meaningful for VARIABLE expenses
 */
function getOverspendingAlerts(categories, categoryExpenses) {
  const alerts = [];

  for (const [catId, data] of Object.entries(categoryExpenses)) {
    const { category, total } = data;
    // Skip fixed expenses — overspending on rent is not actionable
    if (category.expenseType === 'fixed') continue;
    if (category.budgetAmount <= 0 || total <= category.budgetAmount) continue;

    const over = total - category.budgetAmount;
    const percent = ((over / category.budgetAmount) * 100).toFixed(0);

    alerts.push({
      categoryName: category.name,
      icon: category.icon,
      budgetAmount: category.budgetAmount,
      spent: total,
      overBy: over,
      overPercent: percent,
      text: `${category.icon} ${category.name}: Over by ₹${over.toLocaleString('en-IN')} (${percent}% above budget of ₹${category.budgetAmount.toLocaleString('en-IN')})`,
    });
  }

  return alerts.sort((a, b) => b.overBy - a.overBy);
}

/**
 * Generate budget optimization suggestions — ONLY for variable expenses
 */
function getOptimizationSuggestions(income, categories, categoryExpenses) {
  const suggestions = [];
  const totalSpent = Object.values(categoryExpenses).reduce((s, c) => s + c.total, 0);

  // Only consider variable categories for optimization
  const variableData = Object.values(categoryExpenses)
    .filter(d => d.total > 0 && d.category.budgetAmount > 0 && d.category.expenseType === 'variable')
    .sort((a, b) => b.total - a.total);

  for (const data of variableData) {
    const { category, total } = data;
    const reduction10 = Math.round(total * 0.1);

    if (total > category.budgetAmount) {
      const overBy = total - category.budgetAmount;
      suggestions.push({
        icon: '✂️',
        text: `Cut ${category.name} back to budget (₹${category.budgetAmount.toLocaleString('en-IN')}) to save ₹${overBy.toLocaleString('en-IN')}`,
        savings: overBy,
        categoryName: category.name,
      });
    } else if (total > category.budgetAmount * 0.5) {
      suggestions.push({
        icon: '💡',
        text: `Reduce ${category.name} spending by 10% to save ₹${reduction10.toLocaleString('en-IN')}/month`,
        savings: reduction10,
        categoryName: category.name,
      });
    }
  }

  // Overall suggestion
  if (totalSpent > income * 0.8) {
    const targetSpend = Math.round(income * 0.7);
    const neededSave = totalSpent - targetSpend;
    suggestions.push({
      icon: '🎯',
      text: `To keep spending at 70% of income, reduce variable expenses by ₹${neededSave.toLocaleString('en-IN')}`,
      savings: neededSave,
    });
  }

  return suggestions;
}

/**
 * Smart Goal Engine: suggest how to save a specific amount
 * ONLY suggests reductions on VARIABLE expenses — never rent/EMI!
 */
function suggestSavingsPlan(targetAmount, categories, categoryExpenses) {
  const plan = [];
  let remaining = targetAmount;

  // Only variable expenses can be reduced
  const candidates = Object.values(categoryExpenses)
    .filter(d => d.total > 0 && d.category.budgetAmount > 0 && d.category.expenseType === 'variable')
    .map(d => {
      const maxReduction = Math.round(d.total * 0.25); // max 25% cut on variable
      return {
        ...d,
        maxReduction,
        currentOverBudget: Math.max(0, d.total - d.category.budgetAmount),
      };
    })
    .sort((a, b) => b.currentOverBudget - a.currentOverBudget || b.maxReduction - a.maxReduction);

  // First pass: cut from overspending variable categories
  for (const c of candidates) {
    if (remaining <= 0) break;
    if (c.currentOverBudget > 0) {
      const cut = Math.min(c.currentOverBudget, remaining);
      plan.push({
        categoryName: c.category.name,
        icon: c.category.icon,
        currentSpend: c.total,
        suggestedCut: cut,
        newSpend: c.total - cut,
        text: `${c.category.icon} Reduce ${c.category.name} from ₹${c.total.toLocaleString('en-IN')} to ₹${(c.total - cut).toLocaleString('en-IN')} — save ₹${cut.toLocaleString('en-IN')}`,
      });
      remaining -= cut;
    }
  }

  // Second pass: proportional cuts from remaining variable categories
  if (remaining > 0) {
    for (const c of candidates) {
      if (remaining <= 0) break;
      const alreadyCut = plan.find(p => p.categoryName === c.category.name);
      const remainingCap = c.maxReduction - (alreadyCut ? alreadyCut.suggestedCut : 0);
      if (remainingCap <= 0) continue;

      const cut = Math.min(remainingCap, remaining);
      if (alreadyCut) {
        alreadyCut.suggestedCut += cut;
        alreadyCut.newSpend -= cut;
        alreadyCut.text = `${c.category.icon} Reduce ${c.category.name} from ₹${c.total.toLocaleString('en-IN')} to ₹${alreadyCut.newSpend.toLocaleString('en-IN')} — save ₹${alreadyCut.suggestedCut.toLocaleString('en-IN')}`;
      } else {
        plan.push({
          categoryName: c.category.name,
          icon: c.category.icon,
          currentSpend: c.total,
          suggestedCut: cut,
          newSpend: c.total - cut,
          text: `${c.category.icon} Reduce ${c.category.name} from ₹${c.total.toLocaleString('en-IN')} to ₹${(c.total - cut).toLocaleString('en-IN')} — save ₹${cut.toLocaleString('en-IN')}`,
        });
      }
      remaining -= cut;
    }
  }

  const totalSavable = plan.reduce((s, p) => s + p.suggestedCut, 0);

  return {
    targetAmount,
    achievable: remaining <= 0,
    totalSavable,
    shortfall: Math.max(0, remaining),
    steps: plan,
  };
}

/**
 * Generate monthly summary report data
 */
function generateMonthlySummary(income, categories, categoryExpenses, expenses) {
  const totalSpent = Object.values(categoryExpenses).reduce((s, c) => s + c.total, 0);
  const fixedSpent = Object.values(categoryExpenses)
    .filter(d => d.category.expenseType === 'fixed')
    .reduce((s, c) => s + c.total, 0);
  const variableSpent = totalSpent - fixedSpent;
  const remaining = income - totalSpent;

  // Monthly savings = actual expenses flagged as savings
  const monthlySavings = expenses
    .filter(e => e.isSavingsExpense)
    .reduce((sum, e) => sum + e.amount, 0);

  const savingsRate = income > 0 ? ((remaining / income) * 100).toFixed(1) : 0;

  const sortedVariable = Object.values(categoryExpenses)
    .filter(d => d.total > 0 && d.category.expenseType === 'variable')
    .sort((a, b) => b.total - a.total);

  const highest = sortedVariable[0] || null;
  const totalItems = expenses.length;
  const avgPerExpense = totalItems > 0 ? Math.round(totalSpent / totalItems) : 0;

  const overBudget = Object.values(categoryExpenses)
    .filter(d => d.total > d.category.budgetAmount && d.category.budgetAmount > 0 && d.category.expenseType === 'variable');

  return {
    income,
    totalSpent,
    fixedSpent,
    variableSpent,
    remaining,
    monthlySavings,
    savingsRate,
    highestCategory: highest ? highest.category.name : 'N/A',
    highestAmount: highest ? highest.total : 0,
    totalItems,
    avgPerExpense,
    overBudgetCount: overBudget.length,
    categoriesCount: categories.length,
  };
}

export {
  generateInsights,
  getOverspendingAlerts,
  getOptimizationSuggestions,
  suggestSavingsPlan,
  generateMonthlySummary,
};
