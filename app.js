import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const colours = ["red", "blue", "green", "yellow", "orange", "purple"];

const stage = document.querySelector("#diceStage");
const history = document.querySelector("#rollHistory");
const rollBtn = document.querySelector("#rollBtn");

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

let rolling = false;

let diceCount = Number(
  localStorage.getItem("ninjaDiceCount") || 4
);

if (!Number.isInteger(diceCount) || diceCount < 1 || diceCount > 6) {
  diceCount = 4;
}

/* ---------------------------------------------------------
   SECURE FRONTEND COLOUR
   Used ONLY while the dice are visually rolling.
   The final result always comes from Supabase.
--------------------------------------------------------- */

function secureColour() {
  const a = new Uint32Array(1);

  const limit =
    Math.floor(4294967296 / colours.length) * colours.length;

  do {
    crypto.getRandomValues(a);
  } while (a[0] >= limit);

  return colours[a[0] % colours.length];
}

/* ---------------------------------------------------------
   DICE RENDERING
--------------------------------------------------------- */

function renderDice(results, rollingState = false) {
  if (!stage) return;

  stage.innerHTML = results
    .map(
      (colour, index) => `
        <div
          class="die ${colour}${rollingState ? " rolling-die" : ""}"
          style="animation-delay:${index * 0.06}s"
          aria-label="${colour} dice showing one"
        >
          <span class="pip"></span>
        </div>
      `
    )
    .join("");

  stage.dataset.count = results.length;
}
/* ---------------------------------------------------------
   SOUND
--------------------------------------------------------- */

function playRollSound() {
  const AudioCtx =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const sounds = Math.max(8, diceCount * 2);

    for (let i = 0; i < sounds; i++) {
      const time = now + i * 0.075;

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "triangle";

      oscillator.frequency.setValueAtTime(
        180 + Math.random() * 320,
        time
      );

      oscillator.frequency.exponentialRampToValueAtTime(
        70,
        time + 0.055
      );

      gain.gain.setValueAtTime(0.0001, time);

      gain.gain.exponentialRampToValueAtTime(
        0.07,
        time + 0.008
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        time + 0.06
      );

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(time);
      oscillator.stop(time + 0.065);
    }

    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 1400);
  } catch (error) {
    console.warn("Roll sound unavailable:", error);
  }
}

/* ---------------------------------------------------------
   PERSONAL HISTORY
--------------------------------------------------------- */

const KEY = "ninjaPersonalRolls";

function getPersonalRolls() {
  try {
    const value = JSON.parse(
      localStorage.getItem(KEY) || "[]"
    );

    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function savePersonalRoll(roll) {
  const rolls = getPersonalRolls();

  rolls.unshift(roll);

  localStorage.setItem(
    KEY,
    JSON.stringify(rolls.slice(0, 20))
  );
}

function dots(results) {
  return results
    .map(
      colour =>
        `<i class="dot ${colour}" aria-hidden="true"></i>`
    )
    .join("");
}

function renderPersonalRolls() {
  if (!history) return;

  const rolls = getPersonalRolls();

  if (!rolls.length) {
    history.innerHTML =
      `<div class="history-empty">
        No rolls yet — your last 20 rolls will appear here.
      </div>`;

    return;
  }

  history.innerHTML = rolls
    .map(roll => {
      const when = roll.created_at
        ? new Date(roll.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          })
        : "Just now";

      const rollColours = Array.isArray(roll.colours)
        ? roll.colours
        : [];

      return `
        <div class="history-item">

          <time>${when}</time>

          <span class="dots">
            ${dots(rollColours)}
          </span>

          <code class="history-code">
            ${roll.code || "NO CODE"}
          </code>

          <button
            class="history-copy"
            data-code="${roll.code || ""}"
            type="button"
          >
            COPY
          </button>

        </div>
      `;
    })
    .join("");
}

/* ---------------------------------------------------------
   DICE SELECTOR
--------------------------------------------------------- */

function updateDiceChoice() {
  document
    .querySelectorAll("#diceCount button")
    .forEach(button => {
      button.classList.toggle(
        "selected",
        Number(button.dataset.count) === diceCount
      );
    });

  if (rollBtn) {
    rollBtn.textContent =
      `✦ ROLL ${diceCount} DICE ✦`;
  }

  const diceStat = document.querySelector("#diceStat");

  if (diceStat) {
    diceStat.textContent = diceCount;
  }
}

/* ---------------------------------------------------------
   SESSION ROLLS
--------------------------------------------------------- */

function playCount() {
  return getPersonalRolls().length;
}

/* ---------------------------------------------------------
   GLOBAL STATS
--------------------------------------------------------- */

async function loadStats() {
  try {
    const { data, error } =
      await db.rpc("roll_stats");

    if (error) throw error;

    const stats = data || {};

    const totalRolls =
      document.querySelector("#totalRolls");

    const rollsToday =
      document.querySelector("#rollsToday");

    if (totalRolls) {
      totalRolls.textContent =
        Number(stats.total || 0).toLocaleString();
    }

    if (rollsToday) {
      rollsToday.textContent =
        Number(stats.today || 0).toLocaleString();
    }

  } catch (error) {
    console.error("Stats error:", error);
  }
}

/* ---------------------------------------------------------
   MAIN ROLL
--------------------------------------------------------- */

rollBtn?.addEventListener("click", async () => {
  if (rolling) return;

  rolling = true;
  rollBtn.disabled = true;
  rollBtn.classList.add("is-rolling");
  rollBtn.textContent = "🎲 ROLLING...";

  const status = document.querySelector("#rollStatus");

  status.classList.remove("success", "error");
  status.textContent = "Rolling your dice...";

  document.querySelector("#code").textContent = "GENERATING...";
  
  stage.classList.add("is-rolling");
  playRollSound();

  // Rapid random preview colours
  const animationStart = Date.now();
  const animationDuration = 1500;

  while (Date.now() - animationStart < animationDuration) {
    renderDice(
      Array.from({ length: diceCount }, secureColour)
        .map(c => c),
      true
    );

    // Gradually slow the colour changes
    const elapsed = Date.now() - animationStart;
    const progress = elapsed / animationDuration;

    const delay =
      progress < 0.55 ? 55 :
      progress < 0.75 ? 80 :
      progress < 0.9 ? 120 :
      180;

    await wait(delay);
  }

  // Ask Supabase for the REAL result
  status.textContent = "Saving verified result…";
  document.querySelector("#code").textContent = "SAVING...";

  const { data, error } = await db.functions.invoke(
    "create-roll",
    {
      body: { diceCount }
    }
  );

  stage.classList.remove("is-rolling");

  const saved =
    data &&
    data.code &&
    Array.isArray(data.colours);

  if (saved) {
    // IMPORTANT:
    // Supabase remains authoritative.
    // We only reveal the result returned by the server.
    renderDice(data.colours);

    document.querySelector("#code").textContent = data.code;

    savePersonalRoll(data);

    status.textContent =
      "✓ Roll complete and saved as a verified result.";

    status.classList.remove("error");
    status.classList.add("success");
  } else {
    document.querySelector("#code").textContent =
      "ROLL FAILED";

    status.textContent =
      "⚠ Roll completed, but the verified result could not be saved.";

    status.classList.remove("success");
    status.classList.add("error");
  }

  document.querySelector("#sessionRolls").textContent =
    playCount();

  rollBtn.disabled = false;
  rollBtn.classList.remove("is-rolling");
  rollBtn.textContent = `✦ ROLL ${diceCount} DICE ✦`;

  rolling = false;

  renderPersonalRolls();
  loadStats();
});
 
/* ---------------------------------------------------------
   COPY MAIN VERIFICATION CODE
--------------------------------------------------------- */

document
  .querySelector("#copyBtn")
  ?.addEventListener(
    "click",
    async () => {

      const code =
        document.querySelector("#code");

      if (!code) return;

      const value =
        code.textContent.trim();

      if (
        !value ||
        value === "ROLL TO GENERATE" ||
        value === "ROLLING…" ||
        value === "SAVING…" ||
        value === "ROLL FAILED"
      ) {
        return;
      }

      try {

        await navigator.clipboard.writeText(value);

        const button =
          document.querySelector("#copyBtn");

        if (!button) return;

        const original =
          button.textContent;

        button.textContent =
          "COPIED ✓";

        setTimeout(() => {
          button.textContent =
            original;
        }, 1200);

      } catch (error) {
        console.warn(
          "Clipboard unavailable:",
          error
        );
      }
    }
  );

/* ---------------------------------------------------------
   PRIVACY BLUR
--------------------------------------------------------- */

const privacyBtn =
  document.querySelector("#privacy");

privacyBtn?.addEventListener(
  "click",
  () => {

    const enabled =
      privacyBtn.classList.toggle("on");

    privacyBtn.setAttribute(
      "aria-pressed",
      String(enabled)
    );

    const label =
      privacyBtn.querySelector("b");

    if (label) {
      label.textContent =
        enabled
          ? "PRIVACY BLUR ON"
          : "PRIVACY BLUR";
    }

    stage?.classList.toggle(
      "privacy-blurred",
      enabled
    );
  }
);

/* ---------------------------------------------------------
   LIVE PLAYERS
--------------------------------------------------------- */

const channel = db.channel(
  "presence",
  {
    config: {
      presence: {
        key: crypto.randomUUID()
      }
    }
  }
);

channel.on(
  "presence",
  { event: "sync" },
  () => {

    const count =
      Object.keys(
        channel.presenceState()
      ).length;

    const activePlayers =
      document.querySelector("#activePlayers");

    const onlineStat =
      document.querySelector("#onlineStat");

    if (activePlayers) {
      activePlayers.textContent =
        count;
    }

    if (onlineStat) {
      onlineStat.textContent =
        count;
    }
  }
);

channel.subscribe(
  async status => {

    if (status === "SUBSCRIBED") {

      await channel.track({
        online_at:
          new Date().toISOString()
      });

    }

  }
);

/* ---------------------------------------------------------
   PICK SCORE
--------------------------------------------------------- */

const SCORE_KEY =
  "ninjaPickScore";

const scoreValue =
  document.querySelector("#scoreValue");

const plus =
  document.querySelector("#scorePlus");

const minus =
  document.querySelector("#scoreMinus");

const plus10 =
  document.querySelector("#scorePlus10");

const minus10 =
  document.querySelector("#scoreMinus10");

const reset =
  document.querySelector("#scoreReset");

let pickScore =
  Number(
    localStorage.getItem(SCORE_KEY) || 0
  );

if (!Number.isFinite(pickScore)) {
  pickScore = 0;
}

function updateScore() {

  if (!scoreValue) return;

  scoreValue.textContent =
    pickScore > 0
      ? `+${pickScore}`
      : pickScore;

  scoreValue.classList.toggle(
    "positive",
    pickScore > 0
  );

  scoreValue.classList.toggle(
    "negative",
    pickScore < 0
  );

  localStorage.setItem(
    SCORE_KEY,
    pickScore
  );
}

plus?.addEventListener(
  "click",
  () => {
    pickScore++;
    updateScore();
  }
);

minus?.addEventListener(
  "click",
  () => {
    pickScore--;
    updateScore();
  }
);

plus10?.addEventListener(
  "click",
  () => {
    pickScore += 10;
    updateScore();
  }
);

minus10?.addEventListener(
  "click",
  () => {
    pickScore -= 10;
    updateScore();
  }
);

reset?.addEventListener(
  "click",
  () => {
    pickScore = 0;
    updateScore();
  }
);

updateScore();

/* ---------------------------------------------------------
   QUICK VERIFY
--------------------------------------------------------- */

const qInput =
  document.querySelector("#quickVerifyCode");

const qBtn =
  document.querySelector("#quickVerifyBtn");

const qOut =
  document.querySelector("#quickVerifyResult");

qBtn?.addEventListener(
  "click",
  async () => {

    const value =
      (qInput?.value || "")
        .trim()
        .toUpperCase();

    if (!value) {

      if (qOut) {
        qOut.textContent =
          "Enter a verification code first.";
      }

      return;
    }

    if (qOut) {
      qOut.textContent =
        "Checking…";
    }

    try {

      const { data, error } =
        await db.rpc(
          "verify_roll",
          {
            p_code: value
          }
        );

      if (error) {
        throw error;
      }

      const row =
        Array.isArray(data)
          ? data[0]
          : null;

      if (!row) {

        if (qOut) {
          qOut.textContent =
            "No verified roll was found with that code.";
        }

        return;
      }

      if (qOut) {

        qOut.innerHTML = `
          ✓ VERIFIED
          <span class="dots">
            ${
              dots(
                Array.isArray(row.colours)
                  ? row.colours
                  : []
              )
            }
          </span>
        `;
      }

    } catch (error) {

      console.error(
        "Verification error:",
        error
      );

      if (qOut) {
        qOut.textContent =
          "Could not check this code right now.";
      }
    }
  }
);

/* ---------------------------------------------------------
   DICE COUNT SELECTOR
--------------------------------------------------------- */

document
  .querySelectorAll("#diceCount button")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        if (rolling) return;

        const selected =
          Number(button.dataset.count);

        if (
          !Number.isInteger(selected) ||
          selected < 1 ||
          selected > 6
        ) {
          return;
        }

        diceCount = selected;

        localStorage.setItem(
          "ninjaDiceCount",
          diceCount
        );

        updateDiceChoice();

        renderDice(
          Array.from(
            { length: diceCount },
            secureColour
          )
        );
      }
    );
  });

/* ---------------------------------------------------------
   THEMES
--------------------------------------------------------- */

const themes = [
  "classic",
  "grid",
  "space",
  "cyber",
  "forest",
  "sunset",
  "dark",
  "ocean"
];

function setTheme(theme) {

  if (!themes.includes(theme)) {
    theme = "classic";
  }

  document.body.className =
    `ninja-home theme-${theme}`;

  localStorage.setItem(
    "ninjaTheme",
    theme
  );

  document
    .querySelectorAll(".theme-option")
    .forEach(button => {

      const active =
        button.dataset.theme === theme;

      button.classList.toggle(
        "active",
        active
      );

      const icon =
        button.querySelector("i");

      if (icon) {
        icon.textContent =
          active ? "✓" : "○";
      }
    });
}

const savedTheme =
  localStorage.getItem(
    "ninjaTheme"
  ) || "classic";

setTheme(savedTheme);

document
  .querySelectorAll(".theme-option")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {
        setTheme(
          button.dataset.theme
        );
      }
    );
  });

document
  .querySelector("#randomTheme")
  ?.addEventListener(
    "click",
    () => {

      const random =
        themes[
          Math.floor(
            Math.random() * themes.length
          )
        ];

      setTheme(random);
    }
  );

/* ---------------------------------------------------------
   HISTORY COPY
--------------------------------------------------------- */

document.addEventListener(
  "click",
  async event => {

    const button =
      event.target.closest(
        ".history-copy"
      );

    if (!button) return;

    const value =
      button.dataset.code;

    if (!value) return;

    try {

      await navigator.clipboard.writeText(
        value
      );

      button.textContent =
        "COPIED ✓";

      setTimeout(() => {
        button.textContent =
          "COPY";
      }, 1000);

    } catch (error) {

      console.warn(
        "History clipboard unavailable:",
        error
      );
    }
  }
);

/* ---------------------------------------------------------
   INITIALISE
--------------------------------------------------------- */

updateDiceChoice();

renderDice(
  Array.from(
    { length: diceCount },
    secureColour
  )
);

renderPersonalRolls();

const sessionRolls =
  document.querySelector(
    "#sessionRolls"
  );

if (sessionRolls) {
  sessionRolls.textContent =
    playCount();
}

loadStats();
