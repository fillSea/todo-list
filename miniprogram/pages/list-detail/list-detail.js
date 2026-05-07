const app = getApp();
const {
    isTaskOverdueByDate,
    getTaskSeriesGroupId
} = require('../../utils/taskDisplay');

// 调试模式开关 - 设置为 true 使用伪造数据
const DEBUG_MODE = false;

// 伪造数据 - 用于调试
const MOCK_DATA = {
    // 当前用户openid
    currentUserId: 'user_001',

    // 伪造清单数据
    listInfo: {
        _id: 'list_001',
        name: '工作任务',
        description: '日常工作任务清单，包含项目开发、会议、文档编写等任务',
        isShared: true,
        visibility: 1,
        color: '#1976D2',
        creatorId: 'user_001',
        createdAt: '2024-03-10T08:00:00Z',
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
    },

    // 伪造成员数据
    members: [
        {
            _id: 'member_001',
            userId: 'user_001',
            role: 1,
            nickname: '张三',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1'
        },
        {
            _id: 'member_002',
            userId: 'user_002',
            role: 2,
            nickname: '李四',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2'
        },
        {
            _id: 'member_003',
            userId: 'user_003',
            role: 3,
            nickname: '王五',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=3'
        }
    ],

    // 伪造任务数据
    tasks: [
        {
            _id: 'task_001',
            title: '完成项目需求文档',
            description: '编写详细的需求分析文档',
            status: 0,
            priority: 4,
            dueDate: new Date(Date.now() + 86400000).toISOString(), // 明天
            categoryId: 'cat_001',
            categoryName: '工作',
            categoryColor: '#1976D2',
            creatorId: 'user_001',
            createdAt: '2024-03-14T10:00:00Z'
        },
        {
            _id: 'task_002',
            title: '周例会汇报',
            description: '准备周报并在会议上汇报',
            status: 0,
            priority: 3,
            dueDate: new Date(Date.now() + 172800000).toISOString(), // 后天
            categoryId: 'cat_001',
            categoryName: '工作',
            categoryColor: '#1976D2',
            creatorId: 'user_001',
            createdAt: '2024-03-14T09:00:00Z'
        },
        {
            _id: 'task_003',
            title: '代码审查',
            description: '审查团队成员提交的代码',
            status: 1,
            priority: 2,
            dueDate: new Date(Date.now() - 86400000).toISOString(), // 昨天
            categoryId: 'cat_001',
            categoryName: '工作',
            categoryColor: '#1976D2',
            creatorId: 'user_002',
            createdAt: '2024-03-13T14:00:00Z'
        },
        {
            _id: 'task_004',
            title: '更新技术文档',
            description: '更新API接口文档',
            status: 0,
            priority: 1,
            dueDate: new Date(Date.now() + 432000000).toISOString(), // 5天后
            categoryId: 'cat_002',
            categoryName: '文档',
            categoryColor: '#4CAF50',
            creatorId: 'user_001',
            createdAt: '2024-03-13T11:00:00Z'
        },
        {
            _id: 'task_005',
            title: '修复登录bug',
            description: '用户反馈的登录问题需要修复',
            status: 0,
            priority: 4,
            dueDate: new Date(Date.now() - 172800000).toISOString(), // 2天前（已逾期）
            categoryId: 'cat_003',
            categoryName: 'Bug修复',
            categoryColor: '#F44336',
            creatorId: 'user_002',
            createdAt: '2024-03-12T16:00:00Z'
        },
        {
            _id: 'task_006',
            title: '优化数据库查询',
            description: '优化慢查询，提升系统性能',
            status: 1,
            priority: 3,
            dueDate: new Date(Date.now() - 432000000).toISOString(), // 5天前
            categoryId: 'cat_001',
            categoryName: '工作',
            categoryColor: '#1976D2',
            creatorId: 'user_001',
            createdAt: '2024-03-11T10:00:00Z'
        }
    ]
};

Page({
    data: {
        // 清单ID
        listId: '',

        // 清单信息
        listInfo: {},

        // 成员列表
        members: [],

        // 任务列表
        taskList: [],
        filteredTasks: [],

        // 任务筛选
        taskFilter: 'all',

        // 加载状态
        isLoading: false,
        isRefreshing: false,
        isLoadingMore: false,
        hasMore: true,

        // 分页参数
        page: 1,
        pageSize: 20,

        // 权限
        canEdit: false,
        canDelete: false,
        canManageMembers: false,
        canAddTask: false,
        myRole: null,

        // 操作菜单
        showActionSheet: false,
        actionSheetActions: [],

        // 任务操作菜单
        showTaskActionSheet: false,
        taskActionSheetActions: [],
        selectedTaskId: null,
        selectedTask: null,

        // 删除确认
        showDeleteDialog: false,
        deleteScope: 'single',
        deleteDialogTitle: '确认删除',
        deleteDialogMessage: '删除后无法恢复，确定要删除此任务吗？',

        // 状态栏高度
        statusBarHeight: 0,

        // 自定义导航高度
        navBarHeight: 44,
        headerSideWidth: 88,

        // 头部高度
        headerHeight: 44,

        // 进度
        completedCount: 0,
        progressPercent: 0,
        progressColor: '#4CAF50',

        // 空状态
        emptyTitle: '暂无任务',
        emptyDesc: '点击右下角按钮添加第一个任务',

        // 用户信息
        userInfo: null
    },

    onLoad: function (options) {
        const { statusBarHeight, navBarHeight, headerSideWidth } = this.getCustomNavMetrics();
        const { id } = options;
        if (!id) {
            wx.showToast({
                title: '清单ID不能为空',
                icon: 'none'
            });
            wx.navigateBack();
            return;
        }

        this.setData({
            statusBarHeight,
            navBarHeight,
            headerSideWidth,
            headerHeight: statusBarHeight + navBarHeight,
            listId: id,
            userInfo: wx.getStorageSync('userInfo')
        });

        // 加载清单详情
        this.loadListDetail();
    },

    getCustomNavMetrics() {
        const systemInfo = wx.getSystemInfoSync();
        const statusBarHeight = systemInfo.statusBarHeight || 0;
        const menuButton = typeof wx.getMenuButtonBoundingClientRect === 'function'
            ? wx.getMenuButtonBoundingClientRect()
            : null;
        const navBarHeight = menuButton && menuButton.height
            ? menuButton.height + Math.max((menuButton.top - statusBarHeight) * 2, 0)
            : 44;
        const capsuleWidth = menuButton && systemInfo.windowWidth
            ? Math.max(systemInfo.windowWidth - menuButton.left, 0)
            : 0;
        const actionAreaWidth = 88;

        return {
            statusBarHeight,
            navBarHeight,
            headerSideWidth: Math.max(80, actionAreaWidth, capsuleWidth + 8)
        };
    },

    onShow: function () {
        // 页面显示时刷新数据
        if (this.data.listId) {
            this.loadListDetail(false);
        }
    },

    // 加载清单详情
    async loadListDetail(showLoading = true) {
        if (showLoading) {
            this.setData({ isLoading: true });
        }

        try {
            const { listId } = this.data;

            if (DEBUG_MODE) {
                // 调试模式：使用伪造数据
                await this.simulateDelay(500);

                // 检查当前用户权限
                const myMemberInfo = MOCK_DATA.members.find(m => m.userId === MOCK_DATA.currentUserId);
                const myRole = myMemberInfo ? myMemberInfo.role : null;

                // 处理清单数据
                const listInfo = {
                    ...MOCK_DATA.listInfo,
                    createTimeText: this.formatDate(MOCK_DATA.listInfo.createdAt)
                };

                // 处理任务数据
                const taskList = MOCK_DATA.tasks.map(task => this.processTaskData(task));
                const filteredByPeriodic = this.filterPeriodicTasks(taskList);

                // 计算进度
                const completedCount = filteredByPeriodic.filter(t => t.status === 1).length;
                const progressPercent = filteredByPeriodic.length > 0 ? Math.round((completedCount / filteredByPeriodic.length) * 100) : 0;

                this.setData({
                    listInfo,
                    members: MOCK_DATA.members,
                    taskList: filteredByPeriodic,
                    myRole,
                    canEdit: myRole === 1 || myRole === 2,
                    canDelete: myRole === 1,
                    canManageMembers: myRole === 1,
                    canAddTask: myRole === 1 || myRole === 2,
                    completedCount,
                    progressPercent,
                    progressColor: this.getProgressColor(progressPercent),
                    isLoading: false,
                    isRefreshing: false
                });

                // 应用任务筛选
                this.applyTaskFilter();
            } else {
                // 生产模式：调用云函数
                const result = await wx.cloud.callFunction({
                    name: 'listFunctions',
                    data: {
                        action: 'getListDetail',
                        data: { listId }
                    }
                });

                if (result.result && result.result.code === 0) {
                    const { listInfo, members, tasks, myRole } = result.result.data;

                    // 处理数据
                    const processedListInfo = {
                        ...listInfo,
                        createTimeText: this.formatDate(listInfo.createdAt)
                    };

                    const taskList = tasks.map(task => this.processTaskData(task));
                    const filteredByPeriodic = this.filterPeriodicTasks(taskList);
                    const completedCount = filteredByPeriodic.filter(t => t.status === 1).length;
                    const progressPercent = filteredByPeriodic.length > 0 ? Math.round((completedCount / filteredByPeriodic.length) * 100) : 0;

                    this.setData({
                        listInfo: processedListInfo,
                        members,
                        taskList: filteredByPeriodic,
                        myRole,
                        canEdit: myRole === 1 || myRole === 2,
                        canDelete: myRole === 1,
                        canManageMembers: myRole === 1,
                        canAddTask: myRole === 1 || myRole === 2,
                        completedCount,
                        progressPercent,
                        progressColor: this.getProgressColor(progressPercent),
                        isLoading: false,
                        isRefreshing: false
                    });

                    this.applyTaskFilter();
                } else {
                    throw new Error(result.result?.message || '加载失败');
                }
            }
        } catch (error) {
            console.error('加载清单详情失败:', error);
            wx.showToast({
                title: '加载失败，请重试',
                icon: 'none'
            });
            this.setData({
                isLoading: false,
                isRefreshing: false
            });
        }
    },

    // 处理任务数据
    processTaskData(task) {
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const isOverdue = isTaskOverdueByDate(task);

        // 格式化截止时间：MM-DD HH:mm
        let dueTimeText = '';
        if (dueDate) {
            const month = String(dueDate.getMonth() + 1).padStart(2, '0');
            const day = String(dueDate.getDate()).padStart(2, '0');
            const hours = String(dueDate.getHours()).padStart(2, '0');
            const minutes = String(dueDate.getMinutes()).padStart(2, '0');
            dueTimeText = `${month}-${day} ${hours}:${minutes}`;
        }

        return {
            ...task,
            dueDateText: dueDate ? this.formatDate(dueDate) : '',
            dueTimeText,
            isOverdue
        };
    },

    // 过滤周期任务：同任务界面逻辑
    // 只显示今天及之前的周期任务；如果今天的已完成，则显示未来最近的一个
    filterPeriodicTasks(taskList) {
        // 按周期系列分组，找到每个系列最近的未完成且未过期实例
        const nearestPeriodicByGroup = {};
        taskList
            .filter(task => task.repeatType > 0 && task.status === 0 && !task.isOverdue)
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .forEach(task => {
                const groupId = getTaskSeriesGroupId(task);
                if (!nearestPeriodicByGroup[groupId]) {
                    nearestPeriodicByGroup[groupId] = task._id;
                }
            });

        return taskList.filter(task => {
            // 已完成的任务都显示
            if (task.status === 1) return true;

            // 非周期任务都显示
            if (!task.repeatType || task.repeatType === 0) return true;

            // 周期任务：已过期的都显示，未过期的每个系列只显示最近的一个
            if (task.isOverdue) return true;

            const groupId = getTaskSeriesGroupId(task);
            return task._id === nearestPeriodicByGroup[groupId];
        });
    },

    // 获取进度条颜色
    getProgressColor(percent) {
        if (percent >= 80) return '#4CAF50';
        if (percent >= 50) return '#FF9800';
        return '#F44336';
    },

    // 应用任务筛选
    applyTaskFilter() {
        const { taskList, taskFilter } = this.data;

        let filtered = taskList;
        switch (taskFilter) {
            case 'pending':
                filtered = taskList.filter(t => t.status === 0);
                break;
            case 'completed':
                filtered = taskList.filter(t => t.status === 1);
                break;
            default:
                filtered = taskList;
        }

        this.setData({
            filteredTasks: filtered,
            emptyTitle: this.getEmptyTitle(taskFilter),
            emptyDesc: this.getEmptyDesc(taskFilter)
        });
    },

    // 获取空状态标题
    getEmptyTitle(filter) {
        switch (filter) {
            case 'pending':
                return '没有待完成的任务';
            case 'completed':
                return '没有已完成的任务';
            default:
                return '暂无任务';
        }
    },

    // 获取空状态描述
    getEmptyDesc(filter) {
        switch (filter) {
            case 'pending':
                return '太棒了！所有任务都已完成';
            case 'completed':
                return '还没有完成的任务，加油！';
            default:
                return '点击右下角按钮添加第一个任务';
        }
    },

    // 模拟网络延迟
    simulateDelay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // 格式化日期
    formatDate(timestamp) {
        if (!timestamp) return '';

        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        // 小于1分钟
        if (diff < 60000) {
            return '刚刚';
        }
        // 小于1小时
        if (diff < 3600000) {
            return Math.floor(diff / 60000) + '分钟前';
        }
        // 小于24小时
        if (diff < 86400000) {
            return Math.floor(diff / 3600000) + '小时前';
        }
        // 小于7天
        if (diff < 604800000) {
            return Math.floor(diff / 86400000) + '天前';
        }

        // 超过7天显示日期
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // ==================== 导航操作 ====================

    // 返回上一页
    onBack() {
        wx.navigateBack();
    },

    // 编辑清单
    onEditList() {
        const { listId, listInfo } = this.data;
        wx.navigateTo({
            url: `/pages/list-edit/list-edit?id=${listId}`
        });
    },

    // 更多操作
    onMoreActions() {
        const { canDelete, canManageMembers, listInfo } = this.data;

        let actions = [
            { name: '查看操作记录', type: 'operations' }
        ];

        if (canManageMembers && listInfo.isShared) {
            actions.push({ name: '管理成员', type: 'members' });
        }

        if (canDelete) {
            actions.push({ name: '删除清单', type: 'delete', color: '#ee0a24' });
        }

        this.setData({
            showActionSheet: true,
            actionSheetActions: actions
        });
    },

    // 选择操作菜单
    onActionSheetSelect(e) {
        const action = e.detail;
        const type = action.type || action.name;
        const { listId } = this.data;

        this.setData({ showActionSheet: false });

        switch (type) {
            case 'operations':
            case '查看操作记录':
                wx.navigateTo({
                    url: `/pages/operations/operations?listId=${listId}`
                });
                break;
            case 'members':
            case '管理成员':
                wx.navigateTo({
                    url: `/pages/list-members/list-members?listId=${listId}`
                });
                break;
            case 'delete':
            case '删除清单':
                this.onDeleteList();
                break;
        }
    },

    // 关闭操作菜单
    onActionSheetClose() {
        this.setData({ showActionSheet: false });
    },

    // 删除清单
    onDeleteList() {
        wx.showModal({
            title: '确认删除',
            content: '删除清单后，其中的所有任务也会被删除，此操作不可恢复，是否继续？',
            confirmColor: '#ee0a24',
            success: (res) => {
                if (res.confirm) {
                    this.confirmDeleteList();
                }
            }
        });
    },

    // 确认删除清单
    async confirmDeleteList() {
        const { listId } = this.data;

        wx.showLoading({ title: '删除中...' });

        try {
            if (DEBUG_MODE) {
                await this.simulateDelay(500);
                wx.showToast({
                    title: '删除成功',
                    icon: 'success'
                });
                setTimeout(() => {
                    wx.navigateBack();
                }, 1500);
            } else {
                const result = await wx.cloud.callFunction({
                    name: 'listFunctions',
                    data: {
                        action: 'deleteList',
                        data: { listId }
                    }
                });

                if (result.result && result.result.code === 0) {
                    wx.showToast({
                        title: '删除成功',
                        icon: 'success'
                    });
                    setTimeout(() => {
                        wx.navigateBack();
                    }, 1500);
                } else {
                    throw new Error(result.result?.message || '删除失败');
                }
            }
        } catch (error) {
            console.error('删除清单失败:', error);
            wx.showToast({
                title: error.message || '删除失败',
                icon: 'none'
            });
        } finally {
            wx.hideLoading();
        }
    },

    // 添加成员
    onAddMember() {
        const { listId } = this.data;
        wx.navigateTo({
            url: `/pages/list-invite/list-invite?listId=${listId}`
        });
    },

    // ==================== 任务筛选 ====================

    // 切换任务筛选
    onTaskFilterChange(e) {
        const filter = e.currentTarget.dataset.filter;
        if (filter === this.data.taskFilter) return;

        this.setData({ taskFilter: filter }, () => {
            this.applyTaskFilter();
        });
    },

    // ==================== 任务操作 ====================

    // 点击任务
    onTaskClick(e) {
        const taskId = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: `/pages/task-detail/task-detail?id=${taskId}`
        });
    },

    // 切换任务状态
    async onTaskStatusChange(e) {
        const { id, status } = e.currentTarget.dataset;
        const newStatus = status === 1 ? 0 : 1;

        // 权限检查：查看者不能修改任务状态
        if (!this.data.canEdit) {
            wx.showToast({
                title: '您没有编辑权限',
                icon: 'none'
            });
            return;
        }

        // 如果是将已过期任务标记为完成，先弹出确认框
        let confirmedOverdue = false;
        if (newStatus === 1) {
            const task = this.data.taskList.find(t => t._id === id);
            if (task && task.isOverdue) {
                const res = await new Promise(resolve => {
                    wx.showModal({
                        title: '提示',
                        content: '该任务已过期，确认要标记为已完成吗？',
                        confirmText: '确认完成',
                        cancelText: '取消',
                        success: resolve
                    });
                });
                if (!res.confirm) return;
                confirmedOverdue = true;
            }
        }

        try {
            if (DEBUG_MODE) {
                await this.simulateDelay(300);

                const taskList = this.data.taskList.map(task => {
                    if (task._id === id) {
                        return { ...task, status: newStatus };
                    }
                    return task;
                });

                const completedCount = taskList.filter(t => t.status === 1).length;
                const progressPercent = taskList.length > 0 ? Math.round((completedCount / taskList.length) * 100) : 0;

                this.setData({
                    taskList,
                    completedCount,
                    progressPercent,
                    progressColor: this.getProgressColor(progressPercent)
                });

                this.applyTaskFilter();

                wx.showToast({
                    title: newStatus === 1 ? '任务已完成' : '任务已恢复',
                    icon: 'none'
                });
            } else {
                const result = await wx.cloud.callFunction({
                    name: 'taskFunctions',
                    data: {
                        action: 'toggleTaskStatus',
                        data: {
                            taskId: id,
                            status: newStatus,
                            confirmCompleteOverdue: confirmedOverdue || undefined
                        }
                    }
                });

                // 云函数返回错误
                if (result.result && result.result.code !== 0) {
                    wx.showToast({
                        title: result.result.message || '操作失败',
                        icon: 'none'
                    });
                    return;
                }

                const resultData = result.result && result.result.data;

                // 非当天的周期任务，提示用户
                if (resultData && resultData.needConfirmCompleteNotToday) {
                    wx.showModal({
                        title: '提示',
                        content: resultData.confirmMessage || '只能完成当天的周期任务',
                        confirmText: '知道了',
                        showCancel: false
                    });
                    return;
                }

                // 取消完成周期任务，需要确认
                if (resultData && resultData.needConfirmUncheck) {
                    const confirmMessage = resultData.confirmMessage || '取消完成此任务不会影响后续的周期任务，是否确认？';
                    wx.showModal({
                        title: '提示',
                        content: confirmMessage,
                        confirmText: '确认',
                        cancelText: '取消',
                        success: async (res) => {
                            if (res.confirm) {
                                try {
                                    const confirmResult = await wx.cloud.callFunction({
                                        name: 'taskFunctions',
                                        data: {
                                            action: 'toggleTaskStatus',
                                            data: {
                                                taskId: id,
                                                status: newStatus,
                                                confirmUncheck: true
                                            }
                                        }
                                    });
                                    if (confirmResult.result && confirmResult.result.code === 0) {
                                        app.clearTaskCaches();
                                        this.loadListDetail(false);
                                        wx.showToast({ title: '已取消完成', icon: 'success' });
                                    }
                                } catch (error) {
                                    console.error('操作失败:', error);
                                }
                            }
                        }
                    });
                    return;
                }

                // 正常完成，刷新列表
                app.clearTaskCaches();
                this.loadListDetail(false);

                wx.showToast({
                    title: newStatus === 1 ? '任务已完成' : '任务已恢复',
                    icon: 'none'
                });
            }
        } catch (error) {
            console.error('更新任务状态失败:', error);
            wx.showToast({
                title: '操作失败',
                icon: 'none'
            });
        }
    },

    // 任务操作菜单
    onTaskActions(e) {
        e.stopPropagation();

        const taskId = e.currentTarget.dataset.id;
        const { canEdit } = this.data;

        let actions = [
            { name: '查看详情', type: 'view' }
        ];

        if (canEdit) {
            actions.push(
                { name: '编辑任务', type: 'edit' },
                { name: '删除任务', type: 'delete', color: '#ee0a24' }
            );
        }

        this.setData({
            showTaskActionSheet: true,
            taskActionSheetActions: actions,
            selectedTaskId: taskId,
            selectedTask: this.data.taskList.find(task => task._id === taskId) || null
        });
    },

    // 选择任务操作
    onTaskActionSheetSelect(e) {
        const action = e.detail;
        const type = action.type || action.name;
        const { selectedTaskId, listId } = this.data;

        this.setData({ showTaskActionSheet: false });

        switch (type) {
            case 'view':
            case '查看详情':
                wx.navigateTo({
                    url: `/pages/task-detail/task-detail?id=${selectedTaskId}`
                });
                break;
            case 'edit':
            case '编辑任务':
                wx.navigateTo({
                    url: `/pages/task-edit/task-edit?id=${selectedTaskId}&listId=${listId}`
                });
                break;
            case 'delete':
            case '删除任务':
                this.openDeleteDialog();
                break;
        }
    },

    openDeleteDialog() {
        const { selectedTask } = this.data;
        if (selectedTask && selectedTask.repeatType > 0) {
            wx.showActionSheet({
                itemList: ['删除本次', '删除整个周期'],
                success: (res) => {
                    const deleteScope = res.tapIndex === 0 ? 'single' : 'series';
                    this.showDeleteConfirm(deleteScope);
                }
            });
            return;
        }

        this.showDeleteConfirm('single');
    },

    showDeleteConfirm(deleteScope) {
        const { selectedTask } = this.data;
        const isSeries = deleteScope === 'series';
        this.setData({
            deleteScope,
            showDeleteDialog: true,
            deleteDialogTitle: isSeries ? '确认删除整个周期' : '确认删除',
            deleteDialogMessage: isSeries
                ? '确定删除整个周期任务吗？该周期下所有任务实例将一并删除。'
                : (selectedTask && selectedTask.repeatType > 0
                    ? '确定删除本次任务吗？后续周期任务将保留。'
                    : '删除后无法恢复，确定要删除此任务吗？')
        });
    },

    // 关闭任务操作菜单
    onTaskActionSheetClose() {
        this.setData({ showTaskActionSheet: false });
    },

    // 关闭删除弹窗
    onDeleteDialogClose() {
        this.setData({ showDeleteDialog: false });
    },

    // 确认删除任务
    async onDeleteConfirm() {
        const { selectedTaskId, deleteScope } = this.data;

        this.setData({ showDeleteDialog: false });

        wx.showLoading({ title: '删除中...' });

        try {
            if (DEBUG_MODE) {
                await this.simulateDelay(300);

                // 更新本地数据
                const taskList = this.data.taskList.filter(task => task._id !== selectedTaskId);
                const completedCount = taskList.filter(t => t.status === 1).length;
                const progressPercent = taskList.length > 0 ? Math.round((completedCount / taskList.length) * 100) : 0;

                this.setData({
                    taskList,
                    completedCount,
                    progressPercent,
                    progressColor: this.getProgressColor(progressPercent)
                });

                this.applyTaskFilter();

                wx.showToast({
                    title: '删除成功',
                    icon: 'success'
                });
            } else {
                const result = await wx.cloud.callFunction({
                    name: 'taskFunctions',
                    data: {
                        action: 'deleteTask',
                        data: { taskId: selectedTaskId, deleteScope }
                    }
                });

                if (result.result && result.result.code === 0) {
                    app.clearTaskCaches();
                    this.loadListDetail(false);
                    wx.showToast({
                        title: '删除成功',
                        icon: 'success'
                    });
                } else {
                    throw new Error(result.result?.message || '删除失败');
                }
            }
        } catch (error) {
            console.error('删除任务失败:', error);
            wx.showToast({
                title: '删除失败',
                icon: 'none'
            });
        } finally {
            wx.hideLoading();
        }
    },

    // 添加任务
    onAddTask() {
        const { listId } = this.data;
        wx.navigateTo({
            url: `/pages/task-edit/task-edit?listId=${listId}`
        });
    },

    // ==================== 下拉刷新 & 上拉加载 ====================

    // 下拉刷新
    onRefresh() {
        this.setData({
            isRefreshing: true,
            page: 1,
            hasMore: true
        }, () => {
            this.loadListDetail(false);
        });
    },

    // 上拉加载更多
    onLoadMore() {
        if (this.data.isLoadingMore || !this.data.hasMore) return;

        this.setData({
            isLoadingMore: true,
            page: this.data.page + 1
        }, () => {
            // 这里可以实现分页加载更多任务的逻辑
            setTimeout(() => {
                this.setData({
                    isLoadingMore: false,
                    hasMore: false
                });
            }, 500);
        });
    }
});
