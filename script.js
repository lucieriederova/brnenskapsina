const header = document.querySelector(".site-header");
const toggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelectorAll(".site-nav a");
const form = document.querySelector(".booking-form");

toggle?.addEventListener("click", () => {
  const isOpen = header.classList.toggle("nav-open");
  toggle.setAttribute("aria-expanded", String(isOpen));
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    header.classList.remove("nav-open");
    toggle?.setAttribute("aria-expanded", "false");
  });
});

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  if (!button) return;

  const originalText = button.textContent;
  button.textContent = "Poptávka připravena";
  button.disabled = true;

  window.setTimeout(() => {
    button.textContent = originalText;
    button.disabled = false;
  }, 2200);
});

/* Scroll-reveal animations */
const revealEls = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window && revealEls.length) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );
  revealEls.forEach((el) => revealObserver.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("is-visible"));
}

/* Sticky header state, scroll progress bar, back-to-top button */
const progressBar = document.querySelector(".scroll-progress-bar");
const backToTop = document.querySelector(".back-to-top");

let scrollTicking = false;
function onScroll() {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;

  header?.classList.toggle("is-scrolled", scrollTop > 12);
  if (progressBar) progressBar.style.transform = `scaleX(${progress})`;
  backToTop?.classList.toggle("is-visible", scrollTop > window.innerHeight * 0.6);

  scrollTicking = false;
}

window.addEventListener(
  "scroll",
  () => {
    if (!scrollTicking) {
      window.requestAnimationFrame(onScroll);
      scrollTicking = true;
    }
  },
  { passive: true }
);
onScroll();

backToTop?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* Active nav-link highlighting while scrolling */
const navSectionMap = new Map();
document.querySelectorAll('.site-nav a[href^="#"]:not(.nav-cta)').forEach((link) => {
  const section = document.getElementById(link.getAttribute("href").slice(1));
  if (section) navSectionMap.set(section, link);
});

if ("IntersectionObserver" in window && navSectionMap.size) {
  const navObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        navSectionMap.get(entry.target)?.classList.toggle("is-active", entry.isIntersecting);
      });
    },
    { rootMargin: "-40% 0px -50% 0px" }
  );
  navSectionMap.forEach((_, section) => navObserver.observe(section));
}

/* Subtle mouse-parallax on the hero */
const hero = document.querySelector(".hero");
const wantsMotion =
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
  window.matchMedia("(hover: hover)").matches;

if (hero && wantsMotion) {
  hero.addEventListener("mousemove", (event) => {
    const rect = hero.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    hero.style.setProperty("--mx", x.toFixed(3));
    hero.style.setProperty("--my", y.toFixed(3));
  });
  hero.addEventListener("mouseleave", () => {
    hero.style.setProperty("--mx", 0);
    hero.style.setProperty("--my", 0);
  });
}

/* Rotating Brno district tags around the pickup illustration */
const pickupTags = document.querySelectorAll(".step-pickup-tag");

if (pickupTags.length) {
  const brnoDistricts = [
    "Bystrc", "Komín", "Židenice", "Bohunice", "Starý Lískovec",
    "Nový Lískovec", "Kníničky", "Jundrov", "Žabovřesky", "Královo Pole",
    "Řečkovice", "Medlánky", "Ořešín", "Ivanovice", "Jehnice",
    "Útěchov", "Maloměřice", "Slatina", "Tuřany", "Chrlice",
    "Vinohrady", "Žebětín", "Bosonohy", "Kohoutovice", "Černovice",
    "Brno-střed", "Brno-sever", "Brno-jih", "Brno-východ",
  ];

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  pickupTags.forEach((tag, slotIndex) => {
    let districtIndex = slotIndex;
    tag.textContent = brnoDistricts[districtIndex % brnoDistricts.length];
    setTimeout(() => tag.classList.add("is-visible"), 20);

    if (reduceMotion) return;

    setInterval(() => {
      tag.classList.remove("is-visible");
      setTimeout(() => {
        districtIndex += pickupTags.length;
        tag.textContent = brnoDistricts[districtIndex % brnoDistricts.length];
        tag.classList.add("is-visible");
      }, 480);
    }, 2600 + slotIndex * 350);
  });
}

/* Slide photo / tracker / phone through the GPS carousel */
const gpsBlock = document.querySelector(".step-gps");

if (gpsBlock) {
  const track = gpsBlock.querySelector(".step-gps-track");
  const caption = gpsBlock.querySelector(".step-gps-caption");
  const labels = ["Denní fotka", "GPS tracker", "Živá poloha", "Denní fotka"];
  const slideCount = labels.length;
  let gpsIndex = 0;

  const goTo = (i) => {
    track.style.transform = `translateX(-${i * (100 / slideCount)}%)`;
    caption.textContent = labels[i];
  };

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setInterval(() => {
      gpsIndex += 1;
      goTo(gpsIndex);
      if (gpsIndex === slideCount - 1) {
        setTimeout(() => {
          track.style.transition = "none";
          gpsIndex = 0;
          goTo(0);
          void track.offsetWidth;
          track.style.transition = "";
        }, 720);
      }
    }, 2800);
  } else {
    caption.textContent = labels[0];
  }
}

