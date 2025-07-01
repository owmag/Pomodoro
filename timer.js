const timerEl = document.getElementById("timer");
const startBtn = document.getElementById("startBtn");
const messageEl = document.getElementById("message");
const bugleSound = document.getElementById("bugle");
const bellSound = document.getElementById("bell");
const logEl = document.getElementById("log");
const tallyEl = document.getElementById("tally");
const body = document.body;
const gracePeriod = 10 * 1000;
const now = new Date();

let setupStage = 0;
let workDuration = 25;
let shortBreakDuration = 5;
let longBreakDuration = 15;
let scrollCooldown = false;

let totalTime = 25 * 60 * 1000;
let weeklyTotalWorkMs;
let timeLeft = totalTime;
let timer;
let isRunning = false;
let isWorkTime = true;
let firstStart = true;
let startTime, expectedEnd;
let overtimeTimer;
let pomodoroCount = 0;

let totalWorkMs = 0;
let totalBreakMs = 0;
let overtimeWorkMs = 0;
let overtimeBreakMs = 0;
let completeWorkBlocks = 0;
let completeBreakBlocks = 0;


let lastSessionEnd = 0;
let alarmTime = 0;
let lastCheckedDate = new Date().toISOString().slice(0, 10);


let originalTitle = document.title;
let flashInterval;

// Hold previous logHtml to avoid clearing log when re-entering setup
let previousLogHtml = "";

// Load existing logHtml on page load
chrome.storage.local.get(["logHtml"], (data) => {
  if (data.logHtml) {
    previousLogHtml = data.logHtml;
    logEl.innerHTML = previousLogHtml;
    logEl.scrollTop = logEl.scrollHeight;
  }
});



document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["setupComplete", "skipLaunchLog", "logHtml"], (data) => {
    console.log("setupComplete on load:", data.setupComplete, "skipLaunchLog:", data.skipLaunchLog);
    
    if (data.logHtml){
      previousLogHtml = data.logHtml;
      logEl.innerHTML = previousLogHtml;
      logEl.scrollTop = logEl.scrollHeight;
    }
    if (!data.skipLaunchLog) {  // Only log if skipLaunchLog is NOT set
      addLog("extension launched");
    } else {
      // reset the flag so future real reloads log launch
      chrome.storage.local.set({ skipLaunchLog: false });
    }

    if (!data.setupComplete) {
      initSetup();
    } else {
      initTimer();
    }
  });
});


function addLog(message) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB").replace(/\//g, "/");
  const timeStr = now.toTimeString().slice(0, 5);
  const logEntry = `${dateStr} - ${timeStr} - ${message}`;
  const div = document.createElement("div");
  div.textContent = logEntry;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

function updateTimerDisplay(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  const milliseconds = Math.floor((ms % 1000) / 10)
    .toString()
    .padStart(2, "0");
  timerEl.textContent = `${minutes}:${seconds}:${milliseconds}`;
}

function initSetup(skipLaunch = false) {
  setTimeout(() => addLog("scroll to adjust work time"), 160);
  timerEl.textContent = `${workDuration.toString().padStart(2, "0")}:00:00`;
  startBtn.textContent = "set";
  document.addEventListener("wheel", handleSetupScroll);
  startBtn.addEventListener("click", handleSetupClick);
}


function handleSetupScroll(event) {
  if (scrollCooldown) return;
  scrollCooldown = true;
  setTimeout(() => (scrollCooldown = false), 150);
  const delta = Math.sign(event.deltaY);

  if (setupStage === 0) {
    workDuration = Math.min(60, Math.max(1, workDuration - delta));
    timerEl.textContent = `${workDuration.toString().padStart(2, "0")}:00:00`;
  } else if (setupStage === 1) {
    shortBreakDuration = Math.min(60, Math.max(1, shortBreakDuration - delta));
    timerEl.textContent = `${shortBreakDuration
      .toString()
      .padStart(2, "0")}:00:00`;
  } else if (setupStage === 2) {
    longBreakDuration = Math.min(60, Math.max(1, longBreakDuration - delta));
    timerEl.textContent = `${longBreakDuration
      .toString()
      .padStart(2, "0")}:00:00`;
  }
}

function handleSetupClick() {
  if (setupStage === 0) {
    addLog(`work time set to ${workDuration} minutes`);

    setTimeout(() => addLog("scroll to adjust short break"), 160);
    setupStage++;
    timerEl.textContent = `${shortBreakDuration
      .toString()
      .padStart(2, "0")}:00:00`;
    startBtn.textContent = "set";
  } else if (setupStage === 1) {
    addLog(`short break set to ${shortBreakDuration} minutes`);

    setTimeout(() => addLog("scroll to adjust long break"), 160);
    setupStage++;
    timerEl.textContent = `${longBreakDuration
      .toString()
      .padStart(2, "0")}:00:00`;
    startBtn.textContent = "set";
  } else if (setupStage === 2) {
    addLog(`long break set to ${longBreakDuration} minutes`);
    setTimeout(() => {
      addLog("Cmd+I (Mac) or Ctrl+I (Windows) to re-enter setup mode");
    }, 160);
    timerEl.textContent = `${workDuration.toString().padStart(2, "0")}:00:00`;
    startBtn.textContent = "start";
    setTimeout(() => {
      chrome.storage.local.set(
        {
          userWorkDuration: workDuration,
          userShortBreak: shortBreakDuration,
          userLongBreak: longBreakDuration,
          setupComplete: true,
          logHtml: logEl.innerHTML, // Save current log
          
        },
        () => {
          // Remove setup event listeners to avoid duplication if initSetup runs again
          document.removeEventListener("wheel", handleSetupScroll);
          startBtn.removeEventListener("click", handleSetupClick);
          initTimer();
        }
      );
    }, 300);
  }
}

function getTodayString() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}


function initTimer() {
  // Reset any setup event listeners just in case
  document.removeEventListener("wheel", handleSetupScroll);
  startBtn.removeEventListener("click", handleSetupClick);

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
      addLog("Entered setup mode via " + (e.metaKey ? "Cmd+I (Mac)" : "Ctrl+I (Windows)"));
      
      // Save the updated log HTML so it persists after reload
      chrome.storage.local.set({ 
        
        setupComplete: false,
        skipLaunchLog: true,
        logHtml: logEl.innerHTML,
        
      }, () => {
        // Now reload the page after saving
        setTimeout(() => {
          location.reload();
        }, 200); // small delay so saving finishes
      });
    }
  });
  
  

  chrome.storage.local.get(
    [
      "logHtml",
      "completeWorkBlocks",
      "completeBreakBlocks",
      "overtimeWorkMs",
      "overtimeBreakMs",
      "totalWorkMs",
      "totalBreakMs",
      "weeklyTotalWorkMs",
      "userWorkDuration",
      "userShortBreak",
      "userLongBreak",
    ],
    (data) => {
      if (data.completeWorkBlocks !== undefined)
        completeWorkBlocks = data.completeWorkBlocks;
      if (data.completeBreakBlocks !== undefined)
        completeBreakBlocks = data.completeBreakBlocks;
      if (data.totalWorkMs !== undefined) totalWorkMs = data.totalWorkMs;
      if (data.totalBreakMs !== undefined) totalBreakMs = data.totalBreakMs;
      if (data.overtimeWorkMs !== undefined)
        overtimeWorkMs = data.overtimeWorkMs;
      if (data.overtimeBreakMs !== undefined)
        overtimeBreakMs = data.overtimeBreakMs;

      if (data.userWorkDuration !== undefined) {
        workDuration = data.userWorkDuration;
      }
      if (data.userShortBreak !== undefined) {
        shortBreakDuration = data.userShortBreak;
      }
      if (data.userLongBreak !== undefined) {
        longBreakDuration = data.userLongBreak;
      }

      if (isWorkTime) {
        totalTime = workDuration * 60 * 1000;
      } else {
        totalTime = (pomodoroCount % 4 === 0
          ? longBreakDuration
          : shortBreakDuration) * 60 * 1000;
      }
      timeLeft = totalTime;
      updateTimerDisplay(timeLeft);
      
      weeklyTotalWorkMs = Number(data.weeklyTotalWorkMs) || 0;
      console.log("weeklyTotalWorkMs after loading:", weeklyTotalWorkMs);

      updateTally();
      logEl.scrollTop = logEl.scrollHeight;
      console.log("weeklyTotalWorkMs loaded:", weeklyTotalWorkMs);

      // ✅ Move this INSIDE so it's guaranteed to hook after storage finishes loading
      startBtn.addEventListener("click", startTimer);
    }
  );

  function saveState() {
    const state = {
      totalTime,
      timeLeft,
      isWorkTime,
      totalWorkMs,
      totalBreakMs,
      overtimeWorkMs,
      overtimeBreakMs,
      completeWorkBlocks,
      completeBreakBlocks,
      logHtml: logEl.innerHTML,
      pomodoroCount,
      weeklyTotalWorkMs,
    };
    chrome.storage.local.set(state);
  }

  function resetAtMidnight() {
    const now = new Date();
    const isoDate = now.toISOString().slice(0, 10);
    const dateParts = isoDate.split("-");
    const today = `${dateParts[2]}/${dateParts[1]}/${dateParts[0].slice(2)}`;
    console.log("✅ MIDNIGHT RESET TRIGGERED");
    
    const isMonday = now.getDay() === 1; // Monday = 1
  
    if (isMonday) {
      weeklyTotalWorkMs = 0;
    }
  
    // Reset all per-day stats
    pomodoroCount = 0;
    totalWorkMs = 0;
    totalBreakMs = 0;
    overtimeWorkMs = 0;
    overtimeBreakMs = 0;
    completeWorkBlocks = 0;
    completeBreakBlocks = 0;
  
    
    logEl.scrollTop = logEl.scrollHeight;
    timerEl.textContent = `${workDuration.toString().padStart(2, "0")}:00:00`;
  
    if (isMonday) {
      document.getElementById("dailySummary").textContent = "";
    }
  
    // Save everything at once
    chrome.storage.local.set({
      lastResetDate: isoDate,
      weeklyTotalWorkMs: isMonday ? 0 : weeklyTotalWorkMs,
      totalWorkMs: 0,
      totalBreakMs: 0,
      overtimeWorkMs: 0,
      overtimeBreakMs: 0,
      completeWorkBlocks: 0,
      completeBreakBlocks: 0,
      
    });
  
    saveState()
    updateTally();
  }
  

    // At init, check reset once
  chrome.storage.local.get(["lastResetDate"], (data) => {
  const todayStr = getTodayString();

  if (!data.lastResetDate) {
    // First-ever launch — store today's date but don't reset anything
    chrome.storage.local.set({ lastResetDate: todayStr });
  } else if (data.lastResetDate !== todayStr) {
    // Only reset if date has changed (but only on Mondays, see below)
    const dayOfWeek = new Date().getDay(); // 0 = Sunday, 1 = Monday, ...
    if (dayOfWeek === 1) {
      resetAtMidnight();
      chrome.storage.local.set({ lastResetDate: todayStr });
    }
  }
});
  

  setInterval(() => {
    const today = getTodayString();
    chrome.storage.local.get(["lastResetDate"], (data) => {
      const lastResetDate = data.lastResetDate;
      if (lastResetDate !== today) {
        resetAtMidnight();
        chrome.storage.local.set({ lastResetDate: today });
      }
    });
  }, 10000);


  function formatDuration(ms) {
    if (ms <= 0) return "";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let result = "";
    if (hours > 0) result += ` ${hours} hour${hours !== 1 ? "s" : ""}`;
    if (minutes > 0) result += ` ${minutes} minute${minutes !== 1 ? "s" : ""}`;
    if (seconds > 0) result += ` ${seconds} second${seconds !== 1 ? "s" : ""}`;

    return result.trim();
  }

  function updateTally() {
    let output = "";
    const summaryEl = document.getElementById("dailySummary");
    const weekStartDate = getWeekStartDate();
    if (completeBreakBlocks > 0)
      output += `complete break blocks: ${completeBreakBlocks}\n`;
    if (completeWorkBlocks > 0)
      output += `complete work blocks: ${completeWorkBlocks}\n`;

    if (overtimeBreakMs > 0)
      output += `overtime break: ${formatDuration(overtimeBreakMs)}\n`;
    if (overtimeWorkMs > 0)
      output += `overtime work: ${formatDuration(overtimeWorkMs)}\n`;

    const totalWorkIncludingOvertime = totalWorkMs + overtimeWorkMs;
    const totalBreakIncludingOvertime = totalBreakMs + overtimeBreakMs;

    if (totalBreakIncludingOvertime > 0)
      output += `total break time: ${formatDuration(
        totalBreakIncludingOvertime
      )}\n`;
    if (totalWorkIncludingOvertime > 0)
      output += `total work time: ${formatDuration(
        totalWorkIncludingOvertime
      )}\n`;

    tallyEl.innerHTML = output.trim().replace(/\n/g, "<br>");
    const formattedWeekWork = formatDuration(weeklyTotalWorkMs);
    summaryEl.textContent = formattedWeekWork
      ? `week starting ${weekStartDate} work time: ${formattedWeekWork}`
      : "";
    saveState();
  }

  function getWeekStartDate() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when Sunday
    const monday = new Date(now.setDate(diff));

    const localDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
    const dayStr = String(localDate.getDate()).padStart(2, "0");
    const monthStr = String(localDate.getMonth() + 1).padStart(2, "0");
    const yearStr = String(localDate.getFullYear()).slice(2);

    return `${dayStr}/${monthStr}/${yearStr}`;
}

  function logOvertime() {
    if (!lastSessionEnd) return;
    const now = Date.now();
    const overtime = now - lastSessionEnd - gracePeriod;
    if (overtime > 0) {
      if (isWorkTime) {
        overtimeBreakMs += overtime;
      } else {
        overtimeWorkMs += overtime;
      }
    }
  }

  function startFlashingTitle(msg) {
    let visible = false;
    flashInterval = setInterval(() => {
      document.title = visible ? msg : originalTitle;
      visible = !visible;
    }, 800);
  }

  function stopFlashingTitle() {
    clearInterval(flashInterval);
    document.title = originalTitle;
  }

  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    const milliseconds = Math.floor((ms % 1000) / 10)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${seconds}:${milliseconds}`;
  }

  function updateTimer() {
    const now = Date.now();
    timeLeft = expectedEnd - now;

    if (timeLeft <= 0) {
      clearInterval(timer);
      isRunning = false;

      const actualSessionMs = expectedEnd - startTime;

      if (isWorkTime) {
        bellSound.play();
        addLog(`${workDuration || 25} minutes work complete`);
        totalWorkMs += actualSessionMs;
        weeklyTotalWorkMs += actualSessionMs;
        completeWorkBlocks++;
        pomodoroCount++; // increment after work session ends
      } else {
        bugleSound.play();
        const breakType =
          pomodoroCount % 4 === 0
            ? `${longBreakDuration || 15} minutes long break complete`
            : `${shortBreakDuration || 5} minutes short break complete`;
        addLog(breakType);
        totalBreakMs += actualSessionMs;
        completeBreakBlocks++;
      }

      updateTally();

      // Switch session type & duration
      isWorkTime = !isWorkTime;

      if (isWorkTime) {
        totalTime = (workDuration || 25) * 60 * 1000;
      } else {
        totalTime =
          pomodoroCount % 4 === 0
            ? (longBreakDuration || 15) * 60 * 1000
            : (shortBreakDuration || 5) * 60 * 1000;
      }

      timeLeft = totalTime;
      timerEl.textContent = formatTime(timeLeft);

      startFlashingTitle("Time's up!");
      startBtn.disabled = false;

      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: "notify" }, () => {
          if (chrome.runtime.lastError) {
            // silently ignore
          }
        });
      }

      alarmTime = Date.now();
      overtimeTimer = setInterval(() => {
        const overtimeNow = Date.now() - alarmTime - gracePeriod;
        if (overtimeNow > 0) {
          if (isWorkTime) {
            overtimeBreakMs += 1000;
          } else {
            overtimeWorkMs += 1000;
            weeklyTotalWorkMs += 1000;
          }
        }
        updateTally();
      }, 1000);
    } else {
      timerEl.textContent = formatTime(timeLeft);
    }
  }

  function startTimer() {
    if (!isRunning) {
      clearInterval(overtimeTimer);
      logOvertime();
      messageEl.textContent = "";
      stopFlashingTitle();

      chrome.storage.local.get(
        ["userWorkDuration", "userShortBreak", "userLongBreak"],
        (data) => {
          const workMs = (data.userWorkDuration || workDuration) * 60 * 1000;
          const shortBreakMs =
            (data.userShortBreak || shortBreakDuration) * 60 * 1000;
          const longBreakMs =
            (data.userLongBreak || longBreakDuration) * 60 * 1000;

          if (isWorkTime) {
            totalTime = workMs;
          } else {
            totalTime = pomodoroCount % 4 === 0 ? longBreakMs : shortBreakMs;
          }
          timeLeft = totalTime;

          isRunning = true;
          startBtn.disabled = true;

          startTime = Date.now();
          expectedEnd = startTime + timeLeft;
          timer = setInterval(updateTimer, 10);

          document.body.style.backgroundColor = isWorkTime
            ? "#148f00"
            : "#cc0022";

          if (firstStart) {
            bugleSound.currentTime = 0.8;
            bugleSound.play();
            firstStart = false;
          }

          if (isWorkTime) {
            addLog(
              `${data.userWorkDuration || workDuration} minutes work started`
            );
          } else {
            const breakType =
              pomodoroCount % 4 === 0
                ? `${
                    data.userLongBreak || longBreakDuration
                  } minutes long break started`
                : `${
                    data.userShortBreak || shortBreakDuration
                  } minutes short break started`;
            addLog(breakType);
          }

          saveState();
        }
      );
    }
  }
  window._forceMidnightReset = resetAtMidnight;

}

window._forceMidnightReset = () => {
  if (typeof resetAtMidnight === "function") {
    resetAtMidnight();
  } else {
    console.warn("resetAtMidnight not available (not inside initTimer scope)");
  }
};

