# Project Shape

- This repo is a WeChat Mini Program with Tencent Cloud Functions, not a normal web app. Real roots are `miniprogram/` and `cloudfunctions/` from `project.config.json`.
- The root `README.md` is still the cloud quickstart template and is not a reliable architecture guide.
- `cloudfunctions/quickstartFunctions/` is template leftover code; current business logic lives in `taskFunctions`, `listFunctions`, `profileFunctions`, and `categoryFunctions`.

# Run And Verify

- Primary development flow is through WeChat DevTools. Root `package.json` has no usable build/lint/test scripts; `npm test` is only a failing placeholder.
- `project.config.json` sets `packNpmManually: true`. If root npm dependencies change, rebuild npm in WeChat DevTools so `miniprogram/miniprogram_npm/` updates.
- Cloud env is hardcoded in `miniprogram/app.js` as `cloud1-0g144inb6530ffb6`. If a feature appears to hit the wrong backend, check this first.

# Architecture

- App bootstrap is `miniprogram/app.js`; page registration and global Vant components are in `miniprogram/app.json`.
- Tab pages are `pages/index/index`, `pages/calendar/calendar`, `pages/checklist/checklist`, and `pages/profile/profile`.
- Cloud function boundaries:
  - `taskFunctions`: task CRUD, filtering, search, batch ops, reminders, periodic task generation, timer handlers.
  - `listFunctions`: list CRUD, membership, invite links, WeChat invites, applications, approvals, operations log.
  - `profileFunctions`: registration/profile, dashboard stats, notifications, notification settings, test-data actions.
  - `categoryFunctions`: category CRUD.

# Data And Workflow Gotchas

- Core collections verified in code: `users`, `tasks`, `lists`, `list_members`, `categories`, `notifications`, `operations`, `list_invites`.
- Login state is local-storage driven: `userInfo`, `isLoggedIn`, `loginTime`. `app.js` expires login after 30 days and syncs profile from `profileFunctions`.
- Category/task caches are real behavior, not just optimization: `cachedCategories`, `cachedTasks`, `cachedTasksTime`, plus month-scoped `calendarTasks_${year}_${month}` in calendar page. If backend fields change, update cache readers/writers too.
- Several pages have `DEBUG_MODE` and `MOCK_DATA` branches (`checklist`, `list-detail`, `list-invite-accept`, etc.). Do not fix only the mock path or only the cloud path.
- Periodic task behavior is duplicated across frontend and backend. `taskFunctions` generates future instances, while pages like `index` and list stats only show the nearest unfinished non-overdue instance per series. Changes to recurring-task rules usually require both sides.
- Task due dates are stored with an explicit `+08:00` assumption in `taskFunctions.createTask`/update flow. Be careful when changing date parsing or comparing day boundaries.
- List permissions use numeric roles: `1` creator, `2` editor, `3` viewer. `verifyListPermission` and list-member UI both rely on this mapping.
- Invite/application flow uses `list_invites` with status codes: `0` pending, `1` accepted, `2` rejected, `3` expired, `4` pending approval. `needApproval` invites transition from invite acceptance into application approval, not direct membership.
- `profileFunctions` exposes test-data actions (`insertTestData`, `clearTestData`, `insertNotificationTestData`) without normal openid checks. Avoid calling or modifying them casually when working on production flows.
