(() => {
  const modal = document.getElementById("booking-modal");
  if (!modal) return;

  const calendarEl = document.getElementById("booking-calendar");
  const formViewEl = document.getElementById("booking-form-view");
  const formEl = document.getElementById("booking-slot-form");
  const successEl = document.getElementById("booking-form-success");
  const slotTitleEl = document.getElementById("booking-slot-title");
  const slotMetaEl = document.getElementById("booking-slot-meta");
  const rangeLabelEl = modal.querySelector(".booking-range");
  const viewButtons = modal.querySelectorAll(".booking-view-btn");
  const navButtons = modal.querySelectorAll("[data-nav]");

  const HOUR_START = 8;
  const HOUR_END = 19;
  const HOUR_HEIGHT = 60;

  const DAY_NAMES_SHORT = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
  const DAY_NAMES_LONG = [
    "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle",
  ];
  const MONTH_NAMES = [
    "ledna", "února", "března", "dubna", "května", "června",
    "července", "srpna", "září", "října", "listopadu", "prosince",
  ];

  // Walk-slot template per weekday (0 = Monday … 6 = Sunday).
  // Demo data only — nothing here is persisted or emailed anywhere yet.
  const WEEK_TEMPLATE = [
    [
      { start: "08:00", end: "10:00", title: "Ranní vycházka", capacity: 6, booked: 3 },
      { start: "15:30", end: "17:30", title: "Odpolední vycházka", capacity: 6, booked: 6 },
    ],
    [
      { start: "08:00", end: "10:00", title: "Ranní vycházka", capacity: 6, booked: 2 },
      { start: "10:00", end: "12:00", title: "Dopolední vycházka", capacity: 4, booked: 4 },
    ],
    [
      { start: "15:30", end: "17:30", title: "Odpolední vycházka", capacity: 6, booked: 1 },
    ],
    [
      { start: "08:00", end: "10:00", title: "Ranní vycházka", capacity: 6, booked: 5 },
      { start: "10:00", end: "12:00", title: "Dopolední vycházka", capacity: 4, booked: 2 },
    ],
    [
      { start: "08:00", end: "10:00", title: "Ranní vycházka", capacity: 6, booked: 4 },
      { start: "15:30", end: "17:30", title: "Odpolední vycházka", capacity: 6, booked: 3 },
    ],
    [
      { start: "09:00", end: "12:00", title: "Víkendový výlet", capacity: 8, booked: 5 },
    ],
    [],
  ];

  let currentView = "week";
  let anchorDate = new Date();
  let activeSlot = null;
  let lastFocused = null;

  function parseTime(str) {
    const [h, m] = str.split(":").map(Number);
    return h * 60 + m;
  }

  function formatTime(str) {
    return str;
  }

  function startOfWeek(date) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function daySlots(date) {
    const template = WEEK_TEMPLATE[(date.getDay() + 6) % 7];
    return template.map((slot, i) => ({
      ...slot,
      id: `${date.toDateString()}-${i}`,
      date,
    }));
  }

  function formatRangeLabel() {
    if (currentView === "day") {
      return `${DAY_NAMES_LONG[(anchorDate.getDay() + 6) % 7]} ${anchorDate.getDate()}. ${MONTH_NAMES[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
    }
    const monday = startOfWeek(anchorDate);
    const sunday = addDays(monday, 6);
    if (monday.getMonth() === sunday.getMonth()) {
      return `${monday.getDate()}. – ${sunday.getDate()}. ${MONTH_NAMES[sunday.getMonth()]} ${sunday.getFullYear()}`;
    }
    return `${monday.getDate()}. ${MONTH_NAMES[monday.getMonth()]} – ${sunday.getDate()}. ${MONTH_NAMES[sunday.getMonth()]} ${sunday.getFullYear()}`;
  }

  function buildTimeGutter() {
    const gutter = document.createElement("div");
    gutter.className = "booking-time-gutter";
    for (let h = HOUR_START; h <= HOUR_END; h += 1) {
      const label = document.createElement("div");
      label.className = "booking-time-label";
      label.style.height = `${HOUR_HEIGHT}px`;
      label.textContent = `${h}:00`;
      gutter.appendChild(label);
    }
    return gutter;
  }

  function buildDayColumn(date, { compact } = {}) {
    const col = document.createElement("div");
    col.className = "booking-day-col";
    col.style.height = `${(HOUR_END - HOUR_START + 1) * HOUR_HEIGHT}px`;

    for (let h = HOUR_START; h <= HOUR_END; h += 1) {
      const line = document.createElement("div");
      line.className = "booking-hour-line";
      line.style.top = `${(h - HOUR_START) * HOUR_HEIGHT}px`;
      col.appendChild(line);
    }

    daySlots(date).forEach((slot) => {
      const startMin = parseTime(slot.start);
      const endMin = parseTime(slot.end);
      const top = ((startMin - HOUR_START * 60) / 60) * HOUR_HEIGHT;
      const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
      const isFull = slot.booked >= slot.capacity;

      const block = document.createElement(isFull ? "div" : "button");
      block.className = "booking-slot" + (isFull ? " is-full" : "");
      block.style.top = `${top}px`;
      block.style.height = `${Math.max(height, 34)}px`;
      if (!isFull) {
        block.type = "button";
        block.addEventListener("click", () => openBookingForm(slot));
      }

      const title = document.createElement("span");
      title.className = "booking-slot-name";
      title.textContent = slot.title;

      const meta = document.createElement("span");
      meta.className = "booking-slot-submeta";
      if (isFull) {
        meta.textContent = compact ? "Obsazeno" : `${slot.start}–${slot.end} · Obsazeno`;
      } else {
        meta.textContent = compact
          ? `${slot.start}–${slot.end}`
          : `${slot.start}–${slot.end} · volno ${slot.capacity - slot.booked}/${slot.capacity}`;
      }

      block.appendChild(title);
      block.appendChild(meta);
      col.appendChild(block);
    });

    return col;
  }

  function renderWeek() {
    const monday = startOfWeek(anchorDate);
    const today = new Date();

    const wrap = document.createElement("div");
    wrap.className = "booking-week";

    const headerRow = document.createElement("div");
    headerRow.className = "booking-grid-header";
    const corner = document.createElement("div");
    corner.className = "booking-corner";
    headerRow.appendChild(corner);

    for (let i = 0; i < 7; i += 1) {
      const date = addDays(monday, i);
      const head = document.createElement("div");
      head.className = "booking-day-head" + (isSameDay(date, today) ? " is-today" : "");
      head.innerHTML = `${DAY_NAMES_SHORT[i]} <strong>${date.getDate()}</strong>`;
      headerRow.appendChild(head);
    }
    wrap.appendChild(headerRow);

    const body = document.createElement("div");
    body.className = "booking-grid-body";
    body.appendChild(buildTimeGutter());
    for (let i = 0; i < 7; i += 1) {
      body.appendChild(buildDayColumn(addDays(monday, i), { compact: true }));
    }
    wrap.appendChild(body);

    calendarEl.replaceChildren(wrap);
  }

  function renderDay() {
    const wrap = document.createElement("div");
    wrap.className = "booking-week booking-day-view";

    const headerRow = document.createElement("div");
    headerRow.className = "booking-grid-header";
    const corner = document.createElement("div");
    corner.className = "booking-corner";
    headerRow.appendChild(corner);
    const head = document.createElement("div");
    head.className = "booking-day-head is-today";
    head.innerHTML = `${DAY_NAMES_SHORT[(anchorDate.getDay() + 6) % 7]} <strong>${anchorDate.getDate()}</strong>`;
    headerRow.appendChild(head);
    wrap.appendChild(headerRow);

    const body = document.createElement("div");
    body.className = "booking-grid-body";
    body.appendChild(buildTimeGutter());
    body.appendChild(buildDayColumn(anchorDate));
    wrap.appendChild(body);

    calendarEl.replaceChildren(wrap);
  }

  function renderAgenda() {
    const monday = startOfWeek(anchorDate);
    const list = document.createElement("div");
    list.className = "booking-agenda";
    let any = false;

    for (let i = 0; i < 7; i += 1) {
      const date = addDays(monday, i);
      const slots = daySlots(date);
      if (!slots.length) continue;
      any = true;

      const group = document.createElement("div");
      group.className = "booking-agenda-day";
      const heading = document.createElement("h3");
      heading.textContent = `${DAY_NAMES_LONG[i]} ${date.getDate()}. ${MONTH_NAMES[date.getMonth()]}`;
      group.appendChild(heading);

      slots.forEach((slot) => {
        const isFull = slot.booked >= slot.capacity;
        const row = document.createElement(isFull ? "div" : "button");
        row.className = "booking-agenda-row" + (isFull ? " is-full" : "");
        if (!isFull) {
          row.type = "button";
          row.addEventListener("click", () => openBookingForm(slot));
        }
        row.innerHTML = `
          <span class="booking-agenda-time">${slot.start}–${slot.end}</span>
          <span class="booking-agenda-title">${slot.title}</span>
          <span class="booking-agenda-cap">${isFull ? "Obsazeno" : `volno ${slot.capacity - slot.booked}/${slot.capacity}`}</span>
        `;
        group.appendChild(row);
      });

      list.appendChild(group);
    }

    if (!any) {
      const empty = document.createElement("p");
      empty.className = "booking-agenda-empty";
      empty.textContent = "V tomto týdnu nejsou vypsané žádné vycházky.";
      list.appendChild(empty);
    }

    calendarEl.replaceChildren(list);
  }

  function renderCalendar() {
    rangeLabelEl.textContent = formatRangeLabel();
    if (currentView === "week") renderWeek();
    else if (currentView === "day") renderDay();
    else renderAgenda();
  }

  function setView(view) {
    currentView = view;
    viewButtons.forEach((btn) => {
      const active = btn.dataset.view === view;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    renderCalendar();
  }

  viewButtons.forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = btn.dataset.nav;
      if (dir === "today") {
        anchorDate = new Date();
      } else {
        const step = currentView === "day" ? 1 : 7;
        anchorDate = addDays(anchorDate, dir === "next" ? step : -step);
      }
      renderCalendar();
    });
  });

  function openBookingForm(slot) {
    activeSlot = slot;
    const dayLabel = `${DAY_NAMES_LONG[(slot.date.getDay() + 6) % 7]} ${slot.date.getDate()}. ${MONTH_NAMES[slot.date.getMonth()]}`;
    slotTitleEl.textContent = slot.title;
    slotMetaEl.textContent = `${dayLabel}, ${slot.start}–${slot.end} · volno ${slot.capacity - slot.booked}/${slot.capacity} míst`;

    formEl.hidden = false;
    formEl.reset();
    successEl.hidden = true;
    calendarEl.hidden = true;
    formViewEl.hidden = false;
  }

  function closeBookingForm() {
    formViewEl.hidden = true;
    calendarEl.hidden = false;
    activeSlot = null;
  }

  modal.querySelectorAll("[data-booking-back]").forEach((btn) => {
    btn.addEventListener("click", closeBookingForm);
  });

  formEl?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!activeSlot) return;

    // Frontend-only demo: no server yet, so nothing is actually emailed
    // or persisted. We just bump the in-memory count so the capacity
    // shown in the calendar reflects the booking for this session.
    activeSlot.booked = Math.min(activeSlot.capacity, activeSlot.booked + 1);

    formEl.hidden = true;
    successEl.hidden = false;
  });

  function openModal() {
    lastFocused = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("booking-modal-open");
    anchorDate = new Date();
    setView("week");
    closeBookingForm();
    window.setTimeout(() => {
      modal.querySelector(".booking-modal-close")?.focus();
    }, 0);
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("booking-modal-open");
    lastFocused?.focus();
  }

  document.querySelectorAll("[data-booking-trigger]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openModal();
    });
  });

  modal.querySelectorAll("[data-close-booking]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });
})();
