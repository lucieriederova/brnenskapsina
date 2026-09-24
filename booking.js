(() => {
  const modal = document.getElementById("booking-modal");
  if (!modal) return;

  const calendarEl = document.getElementById("booking-calendar");
  const formViewEl = document.getElementById("booking-form-view");
  const formEl = document.getElementById("booking-slot-form");
  const successEl = document.getElementById("booking-form-success");
  const slotTitleEl = document.getElementById("booking-slot-title");
  const slotMetaEl = document.getElementById("booking-slot-meta");
  const slotErrorEl = document.getElementById("booking-slot-error");
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

  let currentView = "week";
  let anchorDate = new Date();
  let activeSlot = null;
  let lastFocused = null;

  // Real availability comes from the server (/api/availability) so capacity
  // is shared across everyone visiting the site, not just this browser tab.
  const slotsByDate = new Map(); // dateKey -> slots for that date
  const loadedRanges = new Set(); // "startKey_endKey" already fetched
  let renderSeq = 0;

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function parseTime(str) {
    const [h, m] = str.split(":").map(Number);
    return h * 60 + m;
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

  function visibleRange() {
    if (currentView === "day") return { start: anchorDate, end: anchorDate };
    const monday = startOfWeek(anchorDate);
    return { start: monday, end: addDays(monday, 6) };
  }

  function invalidateAvailabilityCache() {
    slotsByDate.clear();
    loadedRanges.clear();
  }

  async function ensureRangeLoaded(startDate, endDate) {
    const startKey = dateKey(startDate);
    const endKey = dateKey(endDate);
    const rangeKey = `${startKey}_${endKey}`;
    if (loadedRanges.has(rangeKey)) return;

    const res = await fetch(`/api/availability?start=${startKey}&end=${endKey}`);
    if (!res.ok) throw new Error("availability_failed");
    const data = await res.json();

    data.slots.forEach((slot) => {
      const list = slotsByDate.get(slot.date) || [];
      list.push(slot);
      slotsByDate.set(slot.date, list);
    });
    loadedRanges.add(rangeKey);
  }

  function daySlots(date) {
    const key = dateKey(date);
    const list = slotsByDate.get(key) || [];
    return list.map((slot, i) => ({
      ...slot,
      id: `${key}-${i}`,
      dateStr: key,
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

  function showCalendarStatus(message, { error = false, retry = false } = {}) {
    const wrap = document.createElement("div");
    wrap.className = "booking-calendar-status" + (error ? " is-error" : "");
    const p = document.createElement("p");
    p.textContent = message;
    wrap.appendChild(p);
    if (retry) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "button primary";
      btn.textContent = "Zkusit znovu";
      btn.addEventListener("click", () => renderCalendar());
      wrap.appendChild(btn);
    }
    calendarEl.replaceChildren(wrap);
  }

  async function renderCalendar() {
    rangeLabelEl.textContent = formatRangeLabel();
    const mySeq = ++renderSeq;
    const { start, end } = visibleRange();

    showCalendarStatus("Načítám dostupné termíny…");

    try {
      await ensureRangeLoaded(start, end);
    } catch (err) {
      if (mySeq !== renderSeq) return;
      showCalendarStatus("Nepodařilo se načíst termíny. Zkuste to prosím znovu.", { error: true, retry: true });
      return;
    }
    if (mySeq !== renderSeq) return;

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
    if (slotErrorEl) {
      slotErrorEl.hidden = true;
      slotErrorEl.textContent = "";
    }
    successEl.hidden = true;
    calendarEl.hidden = true;
    formViewEl.hidden = false;
    modal.classList.add("is-form-view");
  }

  function closeBookingForm() {
    formViewEl.hidden = true;
    calendarEl.hidden = false;
    activeSlot = null;
    modal.classList.remove("is-form-view");
    renderCalendar();
  }

  modal.querySelectorAll("[data-booking-back]").forEach((btn) => {
    btn.addEventListener("click", closeBookingForm);
  });

  formEl?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeSlot) return;

    const submitBtn = formEl.querySelector('button[type="submit"]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Odesílám…";
    if (slotErrorEl) {
      slotErrorEl.hidden = true;
      slotErrorEl.textContent = "";
    }

    const data = new FormData(formEl);
    const payload = {
      kind: "slot",
      slotDate: activeSlot.dateStr,
      slotStart: activeSlot.start,
      slotEnd: activeSlot.end,
      dogName: data.get("dog-name"),
      breed: data.get("breed"),
      name: data.get("name"),
      phone: data.get("phone"),
      email: data.get("email"),
      note: data.get("note"),
    };

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 201) {
        invalidateAvailabilityCache();
        formEl.hidden = true;
        successEl.hidden = false;
      } else if (res.status === 409) {
        invalidateAvailabilityCache();
        if (slotErrorEl) {
          slotErrorEl.textContent = "Tento termín je mezitím obsazený. Vraťte se prosím do kalendáře a vyberte jiný.";
          slotErrorEl.hidden = false;
        }
      } else {
        if (slotErrorEl) {
          slotErrorEl.textContent = "Něco se nepovedlo. Zkuste to prosím znovu, nebo nám napište na brnenskapsina@gmail.com.";
          slotErrorEl.hidden = false;
        }
      }
    } catch (err) {
      if (slotErrorEl) {
        slotErrorEl.textContent = "Nepodařilo se odeslat — zkontrolujte připojení a zkuste to znovu.";
        slotErrorEl.hidden = false;
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });

  function openModal() {
    lastFocused = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("booking-modal-open");
    anchorDate = new Date();
    const isNarrow = window.matchMedia("(max-width: 640px)").matches;
    setView(isNarrow ? "agenda" : "week");
    formViewEl.hidden = true;
    calendarEl.hidden = false;
    activeSlot = null;
    modal.classList.remove("is-form-view");
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
    if (trigger.tagName !== "A" && trigger.tagName !== "BUTTON") {
      trigger.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openModal();
        }
      });
    }
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
