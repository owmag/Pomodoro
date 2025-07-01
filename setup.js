(() => {
    let setupStage = 0; // 0 = work time, 1 = short break, 2 = long break
    const timerEl = document.getElementById("timer");
    const startBtn = document.getElementById("startBtn");
    const logEl = document.getElementById("log");
    const body = document.body;
  
    let workDuration = 25; // minutes
    let shortBreakDuration = 5;
    let longBreakDuration = 15;
  
    let scrollCooldown = false; // throttle scroll speed
  
    // Initial background green on launch
    body.style.backgroundColor = "#148F00";
  
    function updateTimerDisplay(minutes) {
      timerEl.textContent = `${minutes.toString().padStart(2, "0")}:00:00`;
    }
  
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
  
    function saveSetupAndFinish() {
        chrome.storage.local.set(
          {
            userWorkDuration: workDuration,
            userShortBreak: shortBreakDuration,
            userLongBreak: longBreakDuration,
            setupComplete: true,
          },
          () => {
            addLog("Setup complete and saved.");
            setTimeout(() => {
              if (typeof initTimer === "function") {
                initTimer(); // ⚡️ seamless handover to timer.js logic
              } else {
                console.error("initTimer not found!");
              }
            }, 300);
          }
        );
      }
      
  
    function handleSetupScroll(event) {
      if (scrollCooldown) return;
      scrollCooldown = true;
      setTimeout(() => (scrollCooldown = false), 150); // 150ms cooldown
  
      const delta = Math.sign(event.deltaY);
  
      if (setupStage === 0) {
        workDuration = Math.min(60, Math.max(1, workDuration - delta));
        updateTimerDisplay(workDuration);
      } else if (setupStage === 1) {
        shortBreakDuration = Math.min(60, Math.max(1, shortBreakDuration - delta));
        updateTimerDisplay(shortBreakDuration);
      } else if (setupStage === 2) {
        longBreakDuration = Math.min(60, Math.max(1, longBreakDuration - delta));
        updateTimerDisplay(longBreakDuration);
      }
    }
  
    function handleSetupClick() {
      if (setupStage === 0) {
        addLog(`work time set to ${workDuration} minutes`);
        body.style.backgroundColor = "#CC0022"; // red after 1st click
        setTimeout(() => {
          addLog("scroll to adjust short break");
        }, 160);
        setupStage++;
        updateTimerDisplay(shortBreakDuration);
        startBtn.textContent = "set";
      } else if (setupStage === 1) {
        addLog(`short break set to ${shortBreakDuration} minutes`);
        body.style.backgroundColor = "#2191FB"; // blue after 2nd click
        setTimeout(() => {
          addLog("scroll to adjust long break");
        }, 160);
        setupStage++;
        updateTimerDisplay(longBreakDuration);
        startBtn.textContent = "set";
      } else if (setupStage === 2) {
        addLog(`long break set to ${longBreakDuration} minutes`);
        body.style.backgroundColor = "#CC0022"; // back to red after 3rd click
        // Display work time again, but now button text changes to start
        updateTimerDisplay(workDuration);
        startBtn.textContent = "start";
  
        // Save setup after slight delay
        setTimeout(() => {
          saveSetupAndFinish();
        }, 300);
      }
    }
  
    // Initial launch logs and setup with delay between first two logs
    addLog("Extension launched");
    setTimeout(() => {
      addLog("scroll to adjust work time");
    }, 160);
  
    updateTimerDisplay(workDuration);
    startBtn.textContent = "set";
  
    document.addEventListener("wheel", handleSetupScroll);
    startBtn.addEventListener("click", handleSetupClick);
  })();
  