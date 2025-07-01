function findTimerTab(tabs) {
  const timerUrl = chrome.runtime.getURL('timer.html');
  console.log("Looking for timer tab at URL starting with:", timerUrl);
  tabs.forEach(tab => console.log(`Tab id: ${tab.id}, url: ${tab.url}`));
  const found = tabs.find(tab => tab.url && tab.url.startsWith(timerUrl));
  if (found) {
    console.log("Found existing Pomodoro tab:", found.id);
  } else {
    console.log("No existing Pomodoro tab found.");
  }
  return found;
}

function activateTab(tab) {
  chrome.tabs.update(tab.id, { active: true }, () => {
    if (chrome.runtime.lastError) {
      console.error("Failed to activate tab:", chrome.runtime.lastError.message);
    } else {
      console.log("Tab activated:", tab.id);
    }
    chrome.windows.update(tab.windowId, { focused: true }, () => {
      if (chrome.runtime.lastError) {
        console.error("Failed to focus window:", chrome.runtime.lastError.message);
      } else {
        console.log("Window focused:", tab.windowId);
      }
    });
  });
}

chrome.action.onClicked.addListener(() => {
  const timerUrl = chrome.runtime.getURL('timer.html');
  console.log("Extension icon clicked.");
  chrome.tabs.query({ url: `${timerUrl}*` }, (tabs) => {
    const timerTab = findTimerTab(tabs);
    if (timerTab) {
      console.log("Activating existing timer tab.");
      activateTab(timerTab);
    } else {
      console.log("Creating new timer tab.");
      chrome.tabs.create({ url: timerUrl }, (tab) => {
        console.log("New timer tab created:", tab.id);
      });
    }
  });
});

chrome.notifications.onClicked.addListener(() => {
  const timerUrl = chrome.runtime.getURL('timer.html');
  console.log("Notification clicked.");
  chrome.tabs.query({ url: `${timerUrl}*` }, (tabs) => {
    const timerTab = findTimerTab(tabs);
    if (timerTab) {
      console.log("Activating existing timer tab from notification.");
      activateTab(timerTab);
    } else {
      console.log("Creating new timer tab from notification.");
      chrome.tabs.create({ url: timerUrl }, (tab) => {
        console.log("New timer tab created from notification:", tab.id);
      });
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "notify") {
    console.log("Background received message:", message);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon-128.png',
      title: 'Pomodoro Timer',
      message: 'Time is up! Click to return',
      priority: 2
    }, (id) => {
      console.log("Notification created with ID:", id);
    });
  }
});

function getMsUntilNextMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0); // next midnight (start of tomorrow)
  return midnight.getTime() - now.getTime();
}

function scheduleMidnightAlarm() {
  chrome.alarms.clear("dailyMidnightReset", () => {
    const msUntilMidnight = getMsUntilNextMidnight();
    chrome.alarms.create("dailyMidnightReset", {
      when: Date.now() + msUntilMidnight,
      periodInMinutes: 1440 // repeat every 24 hours
    });
    console.log(`🔔 Alarm scheduled to fire in ${msUntilMidnight} ms (at midnight)`);
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "dailyMidnightReset") {
    console.log("🔔 Midnight alarm triggered");
    chrome.storage.local.get(["lastResetDate"], (data) => {
      const todayISO = new Date().toISOString().slice(0, 10);
      if (data.lastResetDate !== todayISO) {
        chrome.storage.local.set({ lastResetDate: todayISO }, () => {
          chrome.storage.local.set({
            weeklyTotalWorkMs: (new Date().getDay() === 1) ? 0 : undefined,
            totalWorkMs: 0,
            totalBreakMs: 0,
            overtimeWorkMs: 0,
            overtimeBreakMs: 0,
            completeWorkBlocks: 0,
            completeBreakBlocks: 0
          }, () => {
            console.log("✅ MIDNIGHT RESET complete (via background alarm)");
          });
        });
      } else {
        console.log("⏭ Already reset today");
      }
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  scheduleMidnightAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleMidnightAlarm();
});

// Also schedule the alarm immediately when service worker loads
scheduleMidnightAlarm();
