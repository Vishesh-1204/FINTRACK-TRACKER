// ===== Goals Module =====
import { generateId, addRecord, putRecord, deleteRecord, getAllByIndex, getRecord } from './db.js';

async function getGoals(userId) {
  return getAllByIndex('goals', 'userId', userId);
}

async function addGoal(userId, data) {
  const goal = {
    id: generateId(),
    userId,
    name: data.name.trim(),
    targetAmount: data.targetAmount,
    currentAmount: data.currentAmount || 0,
    deadline: data.deadline,
    createdAt: Date.now(),
  };
  return addRecord('goals', goal);
}

async function updateGoal(goalId, data) {
  const existing = await getRecord('goals', goalId);
  if (!existing) throw new Error('Goal not found');
  Object.assign(existing, data);
  return putRecord('goals', existing);
}

async function deleteGoal(goalId) {
  return deleteRecord('goals', goalId);
}

async function depositToGoal(goalId, amount) {
  const goal = await getRecord('goals', goalId);
  if (!goal) throw new Error('Goal not found');
  goal.currentAmount = Math.min(goal.targetAmount, goal.currentAmount + amount);
  return putRecord('goals', goal);
}

function getGoalProgress(goal) {
  const percent = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const isCompleted = goal.currentAmount >= goal.targetAmount;

  let daysLeft = 0;
  if (goal.deadline) {
    const deadline = new Date(goal.deadline);
    const now = new Date();
    daysLeft = Math.max(0, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)));
  }

  const monthlyNeeded = daysLeft > 0 ? Math.ceil(remaining / (daysLeft / 30)) : remaining;

  return {
    percent: Math.min(100, percent),
    remaining,
    isCompleted,
    daysLeft,
    monthlyNeeded,
  };
}

export { getGoals, addGoal, updateGoal, deleteGoal, depositToGoal, getGoalProgress };
