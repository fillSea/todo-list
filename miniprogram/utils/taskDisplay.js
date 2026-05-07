function toUTC8DateOnly(input) {
  if (!input) {
    return null;
  }

  const date = new Date(input);
  const utc8 = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(
    utc8.getUTCFullYear(),
    utc8.getUTCMonth(),
    utc8.getUTCDate()
  ) - 8 * 60 * 60 * 1000);
}

function getTodayInUTC8() {
  return toUTC8DateOnly(new Date());
}

function isTaskOverdueByDate(task) {
  if (!task || Number(task.status) !== 0 || !task.dueDate) {
    return false;
  }

  const dueDateOnly = toUTC8DateOnly(task.dueDate);
  const today = getTodayInUTC8();
  return !!dueDateOnly && dueDateOnly.getTime() < today.getTime();
}

function getTaskSeriesGroupId(task) {
  return task && (task.parentTaskId || task._id);
}

function getUTC8DateString(input) {
  const dateOnly = toUTC8DateOnly(input);
  if (!dateOnly) {
    return '';
  }

  const utc8 = new Date(dateOnly.getTime() + 8 * 60 * 60 * 1000);
  const year = utc8.getUTCFullYear();
  const month = String(utc8.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc8.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function compareUTC8DateStrings(dateA, dateB) {
  if (!dateA && !dateB) {
    return 0;
  }
  if (!dateA) {
    return -1;
  }
  if (!dateB) {
    return 1;
  }
  if (dateA === dateB) {
    return 0;
  }
  return dateA < dateB ? -1 : 1;
}

function getSelectedDateMode(dateStr) {
  const todayStr = getUTC8DateString(new Date());
  const compareResult = compareUTC8DateStrings(dateStr, todayStr);
  if (compareResult < 0) {
    return 'past';
  }
  if (compareResult > 0) {
    return 'future';
  }
  return 'today';
}

function isDateBeforeTodayUTC8(dateStr) {
  return getSelectedDateMode(dateStr) === 'past';
}

function isDateTodayUTC8(dateStr) {
  return getSelectedDateMode(dateStr) === 'today';
}

module.exports = {
  toUTC8DateOnly,
  getTodayInUTC8,
  isTaskOverdueByDate,
  getTaskSeriesGroupId,
  getUTC8DateString,
  compareUTC8DateStrings,
  getSelectedDateMode,
  isDateBeforeTodayUTC8,
  isDateTodayUTC8
};
