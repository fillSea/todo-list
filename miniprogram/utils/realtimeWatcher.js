function uniqueListIds(listIds) {
  return Array.from(new Set((listIds || []).filter(Boolean)));
}

function chunkList(list, size) {
  const chunks = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
}

function extractEvents(snapshot) {
  const docs = snapshot && Array.isArray(snapshot.docs) ? snapshot.docs : [];
  const docChanges = snapshot && Array.isArray(snapshot.docChanges) ? snapshot.docChanges : [];

  if (docChanges.length > 0) {
    return docChanges.map(change => change.doc || change.data || change).filter(Boolean);
  }

  return docs;
}

function createListVersionWatcher(options = {}) {
  const {
    listIds = [],
    getListIds,
    onChange,
    onError,
    debounceMs = 300,
    chunkSize = 20
  } = options;

  let watchers = [];
  let readyCount = 0;
  let timer = null;
  let currentListIds = uniqueListIds(listIds);
  let pendingEvents = [];

  function stop() {
    watchers.forEach(watcher => {
      if (watcher && typeof watcher.close === 'function') {
        watcher.close();
      }
    });
    watchers = [];
    readyCount = 0;
    pendingEvents = [];

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function schedule(snapshot) {
    pendingEvents = pendingEvents.concat(extractEvents(snapshot));

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      const events = pendingEvents;
      pendingEvents = [];
      timer = null;

      if (typeof onChange === 'function') {
        onChange(events, snapshot);
      }
    }, debounceMs);
  }

  function start(nextListIds) {
    stop();

    const idsSource = nextListIds || (typeof getListIds === 'function' ? getListIds() : currentListIds);
    currentListIds = uniqueListIds(idsSource);

    if (currentListIds.length === 0) {
      return;
    }

    const db = wx.cloud.database();
    const _ = db.command;
    const chunks = chunkList(currentListIds, chunkSize);

    chunks.forEach(ids => {
      const watcher = db.collection('list_versions')
        .where({ listId: _.in(ids) })
        .watch({
          onChange(snapshot) {
            if (snapshot.type === 'init') {
              readyCount += 1;
              return;
            }

            if (readyCount < chunks.length) {
              readyCount += 1;
              return;
            }

            schedule(snapshot);
          },
          onError(err) {
            stop();
            if (typeof onError === 'function') {
              onError(err);
            }
          }
        });
      watchers.push(watcher);
    });
  }

  return {
    start,
    stop,
    restart: start
  };
}

module.exports = {
  createListVersionWatcher
};
