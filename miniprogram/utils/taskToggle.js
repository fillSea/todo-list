const {
  getSelectedDateMode
} = require('./taskDisplay');

function normalizeCheckboxValue(detail) {
  if (typeof detail === 'boolean') {
    return detail;
  }

  if (detail && typeof detail === 'object' && 'value' in detail) {
    return !!detail.value;
  }

  return !!detail;
}

function showModalAsync(options) {
  return new Promise(resolve => {
    wx.showModal({
      ...options,
      success: resolve
    });
  });
}

async function callToggleTaskStatus({ taskId, status, confirmCompleteOverdue, confirmUncheck }) {
  const result = await wx.cloud.callFunction({
    name: 'taskFunctions',
    data: {
      action: 'toggleTaskStatus',
      data: {
        taskId,
        status,
        confirmCompleteOverdue: confirmCompleteOverdue || undefined,
        confirmUncheck: confirmUncheck || undefined
      }
    }
  });

  return {
    rawResult: result,
    resultData: result.result && result.result.data
  };
}

async function handleTaskStatusToggle(options) {
  const {
    taskId,
    task,
    newStatus,
    selectedDate,
    refreshView,
    reloadTasks,
    updateLocalTaskStatus,
    navigateToDate,
    notTodayConfirmText,
    optimistic = true,
    silentRefreshAfterSuccess
  } = options;

  let confirmedOverdue = false;
  const oldStatus = task ? Number(task.status) : (newStatus === 1 ? 0 : 1);
  const shouldDeferOptimisticUpdate = oldStatus === 1 && Number(newStatus) === 0;
  const shouldDeferPermissionUnknownTask = task && task.listId && task.canEditTask !== true;
  let optimisticApplied = false;

  if (task && task.canEditTask === false) {
    wx.showToast({
      title: '您没有编辑权限',
      icon: 'none'
    });
    if (typeof refreshView === 'function') {
      refreshView();
    }
    return;
  }

  const applyLocalStatus = (status, resultData = {}) => {
    if (typeof updateLocalTaskStatus === 'function') {
      updateLocalTaskStatus(status, resultData);
    }
  };

  const rollbackLocalStatus = () => {
    if (optimisticApplied) {
      applyLocalStatus(oldStatus, {
        completedAt: task && task.completedAt,
        completedBy: task && task.completedBy
      });
      optimisticApplied = false;
      return;
    }

    if (typeof refreshView === 'function') {
      refreshView();
    }
  };

  const refreshInBackground = () => {
    const refreshFn = silentRefreshAfterSuccess || reloadTasks;
    if (typeof refreshFn === 'function') {
      Promise.resolve()
        .then(() => refreshFn())
        .catch(error => console.error('后台刷新任务失败:', error));
    }
  };

  if (newStatus === 1 && task) {
    if (Number(task.repeatType) > 0 && selectedDate) {
      const selectedDateMode = getSelectedDateMode(selectedDate);

      if (selectedDateMode === 'past') {
        const confirmRes = await showModalAsync({
          title: '提示',
          content: '该任务已过期，确认要标记为已完成吗？',
          confirmText: '确认完成',
          cancelText: '取消'
        });

        if (!confirmRes.confirm) {
          refreshView && refreshView();
          return;
        }

        confirmedOverdue = true;
      } else if (selectedDateMode !== 'today') {
        await showModalAsync({
          title: '提示',
          content: '无法完成非当日的周期任务',
          showCancel: false,
          confirmText: '知道了'
        });
        refreshView && refreshView();
        return;
      }
    } else if (task.isOverdue) {
      const confirmRes = await showModalAsync({
        title: '提示',
        content: '该任务已过期，确认要标记为已完成吗？',
        confirmText: '确认完成',
        cancelText: '取消'
      });

      if (!confirmRes.confirm) {
        refreshView && refreshView();
        return;
      }

      confirmedOverdue = true;
    }
  }

  try {
    if (optimistic && !shouldDeferOptimisticUpdate && !shouldDeferPermissionUnknownTask) {
      applyLocalStatus(newStatus);
      optimisticApplied = true;
    }

    const { rawResult, resultData } = await callToggleTaskStatus({
      taskId,
      status: newStatus,
      confirmCompleteOverdue: confirmedOverdue
    });

    if (rawResult.result && rawResult.result.code !== 0) {
      wx.showToast({
        title: rawResult.result.message || '操作失败',
        icon: 'none'
      });
      rollbackLocalStatus();
      return;
    }

    if (resultData && resultData.needConfirmCompleteNotToday) {
      rollbackLocalStatus();
      const modalRes = await showModalAsync({
        title: '提示',
        content: resultData.confirmMessage || '只能完成当天的周期任务',
        confirmText: notTodayConfirmText || '去查看',
        cancelText: '取消'
      });

      if (modalRes.confirm && resultData.dueDate && typeof navigateToDate === 'function') {
        navigateToDate(resultData.dueDate);
      } else {
        refreshView && refreshView();
      }
      return;
    }

    if (resultData && resultData.needConfirmUncheck) {
      rollbackLocalStatus();
      const modalRes = await showModalAsync({
        title: '提示',
        content: resultData.confirmMessage || '取消完成此任务不会影响后续的周期任务，是否确认？',
        confirmText: '确认',
        cancelText: '取消'
      });

      if (!modalRes.confirm) {
        return;
      }

      const confirmResult = await callToggleTaskStatus({
        taskId,
        status: newStatus,
        confirmUncheck: true
      });

      if (confirmResult.rawResult.result && confirmResult.rawResult.result.code !== 0) {
        wx.showToast({
          title: confirmResult.rawResult.result.message || '操作失败',
          icon: 'none'
        });
        return;
      }

      applyLocalStatus(newStatus, confirmResult.resultData || {});
      wx.showToast({
        title: '已取消完成',
        icon: 'success'
      });
      if (confirmResult.resultData && (confirmResult.resultData.newPeriodicTasks || confirmResult.resultData.isRepeatTask)) {
        refreshInBackground();
      }
      return;
    }

    if (resultData && (resultData.newPeriodicTasks || resultData.isRepeatTask)) {
      if (!optimisticApplied) {
        applyLocalStatus(newStatus, resultData);
      } else {
        applyLocalStatus(newStatus, resultData);
      }
      refreshInBackground();
      return;
    }

    if (!optimisticApplied) {
      applyLocalStatus(newStatus, resultData || {});
    } else if (resultData) {
      applyLocalStatus(newStatus, resultData);
    }
  } catch (error) {
    console.error('更新任务状态失败:', error);
    wx.showToast({
      title: '操作失败',
      icon: 'none'
    });
    rollbackLocalStatus();
  }
}

module.exports = {
  normalizeCheckboxValue,
  handleTaskStatusToggle
};
