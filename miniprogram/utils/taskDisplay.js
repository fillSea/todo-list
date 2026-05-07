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

module.exports = {
  toUTC8DateOnly,
  getTodayInUTC8,
  isTaskOverdueByDate,
  getTaskSeriesGroupId,
  getUTC8DateString
};
