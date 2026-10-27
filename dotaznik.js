(() => {
  const formEl = document.getElementById("questionnaire-form");
  const slotEl = document.getElementById("questionnaire-slot");
  const statusEl = document.getElementById("questionnaire-status");
  if (!formEl || !slotEl) return;

  const token = new URLSearchParams(window.location.search).get("t");
  const CONTACT = "Napište nám prosím na brnenskapsina@gmail.com.";

  function formatDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return `${d}. ${m}. ${y}`;
  }

  // Pickup happens before the walk starts, so offer 15-minute steps from
  // 90 minutes before the slot's start until 30 minutes after it.
  function fillPickupTimes(slotStart) {
    const select = formEl.elements.pickupTime;
    const [h, m] = slotStart.split(":").map(Number);
    const start = h * 60 + m;
    const pad = (n) => String(n).padStart(2, "0");
    for (let t = start - 90; t <= start + 30; t += 15) {
      const option = document.createElement("option");
      option.textContent = `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
      select.appendChild(option);
    }
  }

  function showStatus(message, error) {
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", error);
    statusEl.hidden = false;
  }

  function showDone() {
    formEl.hidden = true;
    slotEl.textContent = "Děkujeme, dotazník máme! Projdeme ho a pošleme vám na e-mail QR kód k platbě.";
  }

  async function load() {
    if (!token) {
      slotEl.textContent = `Odkaz na dotazník není úplný. Otevřete ho prosím z e-mailu s rezervací, nebo ${CONTACT.toLowerCase()}`;
      return;
    }
    try {
      const res = await fetch(`/api/questionnaire?t=${encodeURIComponent(token)}`);
      if (res.status === 404) {
        slotEl.textContent = `Tuto rezervaci jsme nenašli. ${CONTACT}`;
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (data.submitted) {
        showDone();
        return;
      }
      const { slot, prefill } = data;
      fillPickupTimes(slot.start);
      slotEl.textContent = `${slot.title}, ${formatDate(slot.date)} ${slot.start}–${slot.end}. Vyplnění zabere asi 5 minut.`;
      Object.entries(prefill).forEach(([name, value]) => {
        if (value && formEl.elements[name]) formEl.elements[name].value = value;
      });
      formEl.hidden = false;
    } catch (err) {
      slotEl.textContent = `Dotazník se nepodařilo načíst. Zkuste stránku obnovit, případně ${CONTACT.toLowerCase()}`;
    }
  }

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitBtn = formEl.querySelector('button[type="submit"]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Odesílám…";
    statusEl.hidden = true;

    const payload = Object.fromEntries(new FormData(formEl));
    payload.token = token;

    try {
      const res = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 201 || res.status === 409) {
        showDone();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (res.status === 400) {
        showStatus("Vyplňte prosím všechna povinná pole.", true);
      } else {
        showStatus(`Něco se nepovedlo. Zkuste to prosím znovu. ${CONTACT}`, true);
      }
    } catch (err) {
      showStatus("Nepodařilo se odeslat — zkontrolujte připojení a zkuste to znovu.", true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });

  load();
})();
