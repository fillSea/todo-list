Page({
  data: {
    taskId: '',
    loading: true,
    error: '',
    taskInfo: {},
    summary: {
      completionRate: 0,
      totalDueCount: 0,
      completedDueCount: 0,
      missedDueCount: 0,
      currentStreak: 0,
      longestStreak: 0,
      last7Rate: 0,
      last30Rate: 0,
      thisMonthPlanned: 0,
      thisMonthCompleted: 0,
      thisMonthMissed: 0,
      lastMissedDate: ''
    },
    monthlyStats: [],
    trendMonthlyStats: [],
    visibleMonthKeys: [],
    calendarMonths: [],
    historyRecords: [],
    priorityColor: '#999',
    priorityText: '无优先级',
    canLoadMoreMonths: false,
    statsHint: '连续完成按周期执行点计算，总完成率只统计截至今天应完成的周期点。'
  },

  onLoad: function (options) {
    const { taskId } = options;
    if (!taskId) {
      this.setData({ loading: false, error: '任务ID不能为空' });
      return;
    }
    this.setData({ taskId });
    this.loadPeriodicTaskStats();
  },

  loadPeriodicTaskStats: async function () {
    try {
      this.setData({ loading: true, error: '' });

      const result = await wx.cloud.callFunction({
        name: 'taskFunctions',
        data: {
          action: 'getPeriodicTaskStats',
          data: { taskId: this.data.taskId }
        }
      });

      if (result.result && result.result.code === 0) {
        const {
          taskInfo,
          summary,
          stats,
          recentRecords,
          recentEventRecords,
          monthlyStats
        } = result.result.data;
        const priorityInfo = this.getPriorityInfo(taskInfo.priority);
        const normalizedTaskInfo = this.normalizeTaskInfo(taskInfo || {});
        const normalizedSummary = this.normalizeSummary(summary || stats || {});
        const normalizedMonthlyStats = this.normalizeMonthlyStats(monthlyStats || []);
        const trendMonthlyStats = normalizedMonthlyStats.filter(item => (item.completed + item.missed) > 0).slice(-6);
        const visibleMonthKeys = this.getInitialVisibleMonthKeys(normalizedMonthlyStats);

        this.setData({
          loading: false,
          taskInfo: normalizedTaskInfo,
          summary: normalizedSummary,
          monthlyStats: normalizedMonthlyStats,
          trendMonthlyStats,
          historyRecords: this.generateHistoryRecords(recentEventRecords || [], recentRecords || []),
          priorityColor: priorityInfo.color,
          priorityText: priorityInfo.text,
          visibleMonthKeys,
          canLoadMoreMonths: visibleMonthKeys.length < normalizedMonthlyStats.length
        });

        await this.loadVisibleMonthDetails(visibleMonthKeys);
      } else {
        this.setData({
          loading: false,
          error: result.result?.message || '加载失败'
        });
      }
    } catch (error) {
      console.error('加载周期任务统计失败:', error);
      this.setData({ loading: false, error: '网络错误，请重试' });
    }
  },

  getPriorityInfo: function (priority) {
    const priorityMap = {
      1: { color: '#07c160', text: '不重要不紧急' },
      2: { color: '#ffd01e', text: '紧急不重要' },
      3: { color: '#ff976a', text: '重要不紧急' },
      4: { color: '#ee0a24', text: '重要且紧急' }
    };
    return priorityMap[priority] || { color: '#999', text: '无优先级' };
  },

  normalizeTaskInfo: function (taskInfo) {
    return {
      ...taskInfo,
      startDateText: taskInfo.dueDate ? this.formatDateOnly(taskInfo.dueDate) : '--'
    };
  },

  normalizeSummary: function (summary) {
    return {
      completionRate: summary.completionRate || 0,
      totalDueCount: summary.totalDueCount || summary.totalCount || 0,
      completedDueCount: summary.completedDueCount || summary.completedCount || 0,
      missedDueCount: summary.missedDueCount || summary.incompleteCount || 0,
      currentStreak: summary.currentStreak || 0,
      longestStreak: summary.longestStreak || 0,
      last7Rate: summary.last7Rate || 0,
      last30Rate: summary.last30Rate || 0,
      thisMonthPlanned: summary.thisMonthPlanned || 0,
      thisMonthCompleted: summary.thisMonthCompleted || 0,
      thisMonthMissed: summary.thisMonthMissed || 0,
      lastMissedDate: summary.lastMissedDate ? this.formatDateTime(summary.lastMissedDate) : ''
    };
  },

  normalizeMonthlyStats: function (monthlyStats) {
    return (monthlyStats || []).map(item => ({
      month: item.month,
      label: item.label || this.formatMonthLabel(item.month),
      planned: item.planned || item.total || 0,
      completed: item.completed || 0,
      missed: item.missed || item.overdue || 0,
      future: item.future || 0,
      completionRate: item.completionRate || 0
    }));
  },

  getInitialVisibleMonthKeys: function (monthlyStats) {
    return (monthlyStats || []).slice(-3).map(item => item.month);
  },

  formatMonthLabel: function (monthKey) {
    const [year, month] = String(monthKey).split('-');
    return `${year}年${Number(month)}月`;
  },

  formatDateTime: function (dateValue) {
    const utc8Date = this.toUTC8Date(dateValue);
    const month = String(utc8Date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utc8Date.getUTCDate()).padStart(2, '0');
    const hours = String(utc8Date.getUTCHours()).padStart(2, '0');
    const minutes = String(utc8Date.getUTCMinutes()).padStart(2, '0');
    return `${utc8Date.getUTCFullYear()}-${month}-${day} ${hours}:${minutes}`;
  },

  formatDateOnly: function (dateValue) {
    const utc8Date = this.toUTC8Date(dateValue);
    const month = String(utc8Date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utc8Date.getUTCDate()).padStart(2, '0');
    return `${utc8Date.getUTCFullYear()}-${month}-${day}`;
  },

  toUTC8Date: function (dateValue) {
    const date = new Date(dateValue);
    return new Date(date.getTime() + 8 * 60 * 60 * 1000);
  },

  loadVisibleMonthDetails: async function (monthKeys) {
    if (!monthKeys || monthKeys.length === 0) {
      this.setData({ calendarMonths: [] });
      return;
    }

    const requests = monthKeys.map(month => wx.cloud.callFunction({
      name: 'taskFunctions',
      data: {
        action: 'getPeriodicTaskMonthDetail',
        data: {
          taskId: this.data.taskId,
          month
        }
      }
    }));

    try {
      const results = await Promise.allSettled(requests);
      const monthDetails = results
        .filter(item => item.status === 'fulfilled')
        .map(item => item.value.result)
        .filter(item => item && item.code === 0)
        .map(item => this.generateCalendarMonth(item.data));

      this.setData({
        calendarMonths: monthDetails.sort((a, b) => a.month.localeCompare(b.month))
      });
    } catch (error) {
      console.error('加载月份明细失败:', error);
    }
  },

  generateCalendarMonth: function (monthDetail) {
    const { month, label, days: records } = monthDetail;
    const [year, monthNum] = month.split('-').map(Number);
    const monthIndex = monthNum - 1;
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();
    const recordMap = {};

    (records || []).forEach(record => {
      recordMap[record.date] = record;
    });

    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ day: '', status: -2, date: '' });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const record = recordMap[dateKey];
      days.push({
        day,
        date: dateKey,
        status: record ? record.status : -1,
        source: record ? record.source : ''
      });
    }

    return { month, label, days };
  },

  generateHistoryRecords: function (eventRecords, fallbackRecords) {
    if (eventRecords && eventRecords.length > 0) {
      return eventRecords
        .slice()
        .sort((a, b) => new Date(b.operatedAt) - new Date(a.operatedAt))
        .slice(0, 20)
        .map(record => {
          const operatedAt = record.operatedAt || record.completedAt;
          const dueDate = record.dueDate || record.date;
          const operatorName = record.operatorInfo && record.operatorInfo.nickname
            ? record.operatorInfo.nickname
            : '';
          const eventType = record.eventType === 'uncomplete' ? 'uncomplete' : 'complete';
          const eventLabel = eventType === 'complete' ? '完成' : '取消完成';
          const dueDateText = dueDate ? this.formatDateOnly(dueDate) : '';
          const operatorText = operatorName ? `${operatorName}` : '成员';

          return {
            ...record,
            eventType,
            eventLabel,
            dueDateText,
            operatorName,
            formattedDate: operatedAt ? this.formatDateTime(operatedAt) : '',
            description: dueDateText
              ? `${operatorText}${eventLabel}了 ${dueDateText} 周期点`
              : `${operatorText}${eventLabel}了该周期点`,
            displayStatusClass: eventType === 'complete' ? 'status-completed' : 'status-incomplete'
          };
        });
    }

    return (fallbackRecords || [])
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(record => {
        const formattedDate = this.formatDateOnly(record.date);
        return {
          ...record,
          eventId: `fallback-${record.dateKey || record.date || formattedDate}`,
          eventType: record.status === 1 ? 'complete' : 'incomplete',
          eventLabel: record.status === 1 ? '已完成' : '未完成',
          description: record.status === 1 ? '该周期点当前已完成' : '该周期点当前未完成',
          formattedDate,
          displayStatusClass: record.status === 1 ? 'status-completed' : 'status-incomplete'
        };
      });
  },

  onLoadMoreMonths: async function () {
    const allMonthKeys = this.data.monthlyStats.map(item => item.month);
    const currentVisible = this.data.visibleMonthKeys;
    if (currentVisible.length >= allMonthKeys.length) {
      return;
    }

    const remainCount = allMonthKeys.length - currentVisible.length;
    const nextVisible = allMonthKeys.slice(-Math.min(allMonthKeys.length, currentVisible.length + Math.min(3, remainCount)));

    this.setData({
      visibleMonthKeys: nextVisible,
      canLoadMoreMonths: nextVisible.length < allMonthKeys.length
    });

    await this.loadVisibleMonthDetails(nextVisible);
  },

  onBack: function () {
    wx.navigateBack();
  }
});
