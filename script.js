/* SmartFlow Automation — script.js */

(function () {
  'use strict';

  /* ── Mobile nav toggle ─────────────────────────────── */
  const header = document.querySelector('.header');
  const navLinksEl = document.querySelector('.nav-links');
  const navCta = document.querySelector('.nav-cta');

  // Inject hamburger button dynamically
  const hamburger = document.createElement('button');
  hamburger.className = 'hamburger';
  hamburger.setAttribute('aria-label', 'Toggle menu');
  hamburger.innerHTML = '<span></span><span></span><span></span>';
  document.querySelector('.nav').appendChild(hamburger);

  // Create mobile drawer
  const mobileNav = document.createElement('div');
  mobileNav.className = 'mobile-nav';
  mobileNav.innerHTML = `
    <ul>
      <li><a href="#">Home</a></li>
      <li><a href="#services">Services</a></li>
      <li><a href="#contact">Solutions</a></li>
      <li><a href="#">About Us</a></li>
      <li><a href="#">Resources</a></li>
    </ul>
    <a href="#contact" class="btn btn-primary">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
        <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      Book a Free Call
    </a>
  `;
  header.after(mobileNav);

  hamburger.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('open');
    hamburger.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', open);
  });

  // Close mobile nav when a link is clicked
  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      hamburger.classList.remove('open');
    });
  });

  /* ── Smooth scroll for anchor links ─────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      const headerH = header.offsetHeight;
      const top = target.getBoundingClientRect().top + window.pageYOffset - headerH - 16;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  /* ── Header shadow on scroll ────────────────────────── */
  const updateHeaderShadow = () => {
    if (window.scrollY > 4) {
      header.style.boxShadow = '0 2px 12px rgba(0,0,0,.10)';
    } else {
      header.style.boxShadow = '0 1px 8px rgba(0,0,0,.06)';
    }
  };
  window.addEventListener('scroll', updateHeaderShadow, { passive: true });

  /* ── Intersection observer: fade-in on scroll ────────── */
  const fadeTargets = document.querySelectorAll(
    '.scard, .wstep, .rstat, .trust-logo, .hstat'
  );

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = entry.target.dataset.transform || 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  fadeTargets.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = `opacity .45s ease ${i * 0.06}s, transform .45s ease ${i * 0.06}s`;
    el.dataset.transform = 'translateY(0)';
    observer.observe(el);
  });

})();

/* ================================================================
   SMARTFLOW-BK1 — Booking Module
   Self-contained IIFE. No existing code touched.
   ================================================================ */
(function () {
  'use strict';

  /* ---- Config ---- */
  const GET_SLOTS_URL  = 'https://n8n.srv823907.hstgr.cloud/webhook/smartflow-get-booked-slots';
  const BOOK_SLOT_URL  = 'https://n8n.srv823907.hstgr.cloud/webhook/smartflow-book-slot';
  const SLOT_DURATION  = 30; // minutes
  const START_HOUR     = 9;   // 09:00 AWST
  const END_HOUR_MIN   = 990; // 16:30 in minutes (16*60+30)
  const WINDOW_DAYS    = 60;
  const NOTICE_MS      = 60 * 60 * 1000; // 1 hour
  const AWST_OFFSET_MS = 8 * 3600 * 1000;

  /* ---- State ---- */
  let bookedSlots   = [];
  let calYear       = 0;
  let calMonth      = 0; // 0-indexed
  let selectedDate  = null; // { y, m, d } AWST
  let selectedSlot  = null; // { slot_id, date, time }
  let pendingBooking = null; // set after successful POST

  /* ---- DOM refs ---- */
  const backdrop    = document.getElementById('booking-backdrop');
  const modal       = document.getElementById('booking-modal');
  const closeBtn    = document.getElementById('bk-close-btn');
  const progressBar = document.getElementById('bk-progress-bar');

  const step1       = document.getElementById('bk-step-1');
  const step2       = document.getElementById('bk-step-2');
  const step3       = document.getElementById('bk-step-3');
  const stepSuccess = document.getElementById('bk-step-success');

  const calMonthLbl = document.getElementById('bk-cal-month');
  const calGrid     = document.getElementById('bk-cal-grid');
  const calPrev     = document.getElementById('bk-cal-prev');
  const calNext     = document.getElementById('bk-cal-next');

  const slotsGrid     = document.getElementById('bk-slots-grid');
  const noSlotsMsg    = document.getElementById('bk-no-slots');
  const selDateLabel  = document.getElementById('bk-selected-date-label');
  const backTo1       = document.getElementById('bk-back-to-1');

  const chipLabel     = document.getElementById('bk-chip-label');
  const chipEdit      = document.getElementById('bk-chip-edit');
  const backTo1From3  = document.getElementById('bk-back-to-1-from-3');
  const form          = document.getElementById('bk-form');
  const submitBtn     = document.getElementById('bk-submit-btn');
  const submitText    = submitBtn.querySelector('.bk-submit-text');
  const spinner       = document.getElementById('bk-spinner');
  const errorBanner   = document.getElementById('bk-error-banner');

  const successTitle  = document.getElementById('bk-success-title');
  const successName   = document.getElementById('bk-success-name');
  const successDate   = document.getElementById('bk-success-date');
  const successTime   = document.getElementById('bk-success-time');
  const successClose  = document.getElementById('bk-success-close');
  const confettiWrap  = document.getElementById('bk-confetti');

  /* ---- Helpers ---- */
  function nowAWST() {
    return new Date(Date.now() + AWST_OFFSET_MS);
  }

  function formatMonthYear(y, m) {
    return new Date(y, m, 1).toLocaleString('en-AU', { month: 'long', year: 'numeric' });
  }

  function formatSlotID(y, m, d, h, mn) {
    const pad = n => String(n).padStart(2, '0');
    return `${y}-${pad(m + 1)}-${pad(d)}_${pad(h)}:${pad(mn)}`;
  }

  function formatTimeLabel(h, mn) {
    const period = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(mn).padStart(2, '0')} ${period}`;
  }

  function formatDateLabel(y, m, d) {
    return new Date(y, m, d).toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  // Minimum allowed booking date (today AWST)
  function minBookingDate() {
    const n = nowAWST();
    return { y: n.getUTCFullYear(), m: n.getUTCMonth(), d: n.getUTCDate() };
  }

  // Maximum booking date (today + WINDOW_DAYS AWST)
  function maxBookingDate() {
    const n = new Date(Date.now() + AWST_OFFSET_MS + WINDOW_DAYS * 86400 * 1000);
    return { y: n.getUTCFullYear(), m: n.getUTCMonth(), d: n.getUTCDate() };
  }

  function dateToKey(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // All slots for a day that pass the 1-hr notice check
  function eligibleSlotsForDay(y, m, d) {
    const slots = [];
    const now = Date.now();
    for (let totalMin = START_HOUR * 60; totalMin <= END_HOUR_MIN; totalMin += SLOT_DURATION) {
      const h = Math.floor(totalMin / 60);
      const mn = totalMin % 60;
      const slotUTC = Date.UTC(y, m, d, h - 8, mn); // AWST-8=UTC
      if (slotUTC - now >= NOTICE_MS) {
        slots.push({ h, mn });
      }
    }
    return slots;
  }

  function isDayFullyBooked(y, m, d) {
    const eligible = eligibleSlotsForDay(y, m, d);
    if (eligible.length === 0) return true;
    const prefix = dateToKey(y, m, d) + '_';
    return eligible.every(({ h, mn }) => {
      const id = formatSlotID(y, m, d, h, mn);
      return bookedSlots.includes(id);
    });
  }

  function isDayDisabled(y, m, d) {
    const dt = new Date(y, m, d);
    const dow = dt.getDay(); // 0=Sun, 6=Sat
    if (dow === 0 || dow === 6) return true;
    const min = minBookingDate();
    const max = maxBookingDate();
    if (y < min.y || (y === min.y && m < min.m) || (y === min.y && m === min.m && d < min.d)) return true;
    if (y > max.y || (y === max.y && m > max.m) || (y === max.y && m === max.m && d > max.d)) return true;
    if (isDayFullyBooked(y, m, d)) return true;
    return false;
  }

  /* ---- Calendar rendering ---- */
  function renderCalendar() {
    calMonthLbl.textContent = formatMonthYear(calYear, calMonth);

    // Disable prev if first eligible month
    const today = minBookingDate();
    calPrev.disabled = (calYear === today.y && calMonth === today.m);

    // Disable next if beyond max window
    const max = maxBookingDate();
    const lastEligibleMonth = max.m + (max.y - calYear) * 12;
    calNext.disabled = (calMonth - today.m + (calYear - today.y) * 12 >= lastEligibleMonth - (today.m + (today.y - today.y) * 12));
    // Simpler: disable next if calYear/calMonth >= max year/month
    calNext.disabled = (calYear > max.y || (calYear === max.y && calMonth >= max.m));

    const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
    // Convert to Mon-first: Mon=0, Tue=1, ... Sun=6
    const startOffset = (firstDay === 0) ? 6 : firstDay - 1;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    calGrid.innerHTML = '';

    // Leading empty cells
    for (let i = 0; i < startOffset; i++) {
      const empty = document.createElement('button');
      empty.className = 'bk-day bk-day--empty';
      empty.disabled = true;
      empty.setAttribute('aria-hidden', 'true');
      calGrid.appendChild(empty);
    }

    const today2 = minBookingDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = d;
      const disabled = isDayDisabled(calYear, calMonth, d);
      const isToday = (calYear === today2.y && calMonth === today2.m && d === today2.d);
      const isSelected = selectedDate &&
        selectedDate.y === calYear && selectedDate.m === calMonth && selectedDate.d === d;

      btn.className = 'bk-day' +
        (disabled ? ' bk-day--disabled' : '') +
        (isToday ? ' bk-day--today' : '') +
        (isSelected ? ' bk-day--selected' : '');
      btn.disabled = disabled;
      if (!disabled) {
        btn.addEventListener('click', () => onDayClick(calYear, calMonth, d));
      }
      calGrid.appendChild(btn);
    }
  }

  function onDayClick(y, m, d) {
    selectedDate = { y, m, d };
    renderCalendar();
    goToStep(2, 'forward');
    renderTimeSlots();
  }

  /* ---- Time slot rendering ---- */
  function renderTimeSlots() {
    const { y, m, d } = selectedDate;
    selDateLabel.textContent = formatDateLabel(y, m, d);
    slotsGrid.innerHTML = '';
    noSlotsMsg.hidden = true;

    const eligible = eligibleSlotsForDay(y, m, d);
    const available = eligible.filter(({ h, mn }) => {
      const id = formatSlotID(y, m, d, h, mn);
      return !bookedSlots.includes(id);
    });

    if (available.length === 0) {
      noSlotsMsg.hidden = false;
      return;
    }

    available.forEach(({ h, mn }, idx) => {
      const id   = formatSlotID(y, m, d, h, mn);
      const lbl  = formatTimeLabel(h, mn);
      const btn  = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bk-slot';
      btn.textContent = lbl;
      btn.style.animationDelay = `${idx * 30}ms`;
      const isSelected = selectedSlot && selectedSlot.slot_id === id;
      if (isSelected) btn.classList.add('bk-slot--selected');
      btn.addEventListener('click', () => onSlotClick(id, formatDateLabel(y, m, d), lbl, btn));
      slotsGrid.appendChild(btn);
    });
  }

  function onSlotClick(slot_id, dateLabel, timeLabel, btn) {
    selectedSlot = { slot_id, date: dateLabel, time: timeLabel };
    // Update selected styling
    slotsGrid.querySelectorAll('.bk-slot').forEach(b => b.classList.remove('bk-slot--selected'));
    btn.classList.add('bk-slot--selected');
    // Brief delay so user sees the selection, then advance
    setTimeout(() => {
      chipLabel.textContent = `${dateLabel.split(',')[0]}, ${dateLabel.split(', ').slice(1).join(', ')} · ${timeLabel} AWST`;
      goToStep(3, 'forward');
    }, 160);
  }

  /* ---- Progress bar ---- */
  function setProgress(step) {
    const pct = { 1: 33, 2: 66, 3: 100, success: 100 };
    progressBar.style.width = (pct[step] || 33) + '%';
  }

  /* ---- Step navigation ---- */
  function goToStep(to, direction) {
    const steps = { 1: step1, 2: step2, 3: step3, success: stepSuccess };
    const current = [step1, step2, step3, stepSuccess].find(s => !s.classList.contains('bk-step--hidden'));
    const next = steps[to];
    if (!current || !next) return;

    const outAnim = direction === 'forward' ? 'bk-anim-out-left' : 'bk-anim-out-right';
    const inAnim  = direction === 'forward' ? 'bk-anim-in-right' : 'bk-anim-in-left';

    current.classList.add(outAnim);
    current.addEventListener('animationend', () => {
      current.classList.add('bk-step--hidden');
      current.classList.remove(outAnim);
      next.classList.remove('bk-step--hidden');
      next.classList.add(inAnim);
      next.addEventListener('animationend', () => next.classList.remove(inAnim), { once: true });
      modal.scrollTop = 0;
    }, { once: true });

    setProgress(to);
  }

  /* ---- Open / close ---- */
  function openModal() {
    fetchBookedSlots();
    backdrop.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('bk-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    backdrop.classList.remove('bk-open');
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    // Reset after transition
    setTimeout(() => {
      resetToStep1();
    }, 320);
  }

  function resetToStep1() {
    [step2, step3, stepSuccess].forEach(s => s.classList.add('bk-step--hidden'));
    step1.classList.remove('bk-step--hidden');
    step1.classList.remove('bk-step--hidden');
    form.reset();
    errorBanner.hidden = true;
    errorBanner.textContent = '';
    setProgress(1);
    selectedSlot = null;
    renderCalendar();
  }

  /* ---- Fetch booked slots ---- */
  function fetchBookedSlots() {
    fetch(GET_SLOTS_URL)
      .then(r => r.json())
      .then(data => {
        bookedSlots = Array.isArray(data.booked) ? data.booked : [];
        renderCalendar();
      })
      .catch(() => {
        bookedSlots = [];
        renderCalendar();
      });
  }

  /* ---- Form submission ---- */
  function setSubmitting(yes) {
    submitBtn.disabled = yes;
    submitText.style.display = yes ? 'none' : '';
    spinner.hidden = !yes;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errorBanner.hidden = true;

    const name   = document.getElementById('bk-name').value.trim();
    const email  = document.getElementById('bk-email').value.trim();
    const phone  = document.getElementById('bk-phone').value.trim();
    const agency = document.getElementById('bk-agency').value.trim();
    const message = document.getElementById('bk-message').value.trim();

    // Frontend validation (UX only — server re-validates)
    if (!name || !email || !phone || !agency) {
      showError('Please fill in all required fields.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Please enter a valid email address.');
      return;
    }
    if (!selectedSlot) {
      showError('No time slot selected. Please go back and choose a slot.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(BOOK_SLOT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selectedSlot.slot_id,
          date:    selectedSlot.date,
          time:    selectedSlot.time,
          name, email, phone, agency, message
        })
      });

      const data = await res.json();

      if (res.status === 409 || data.error === 'slot_taken') {
        bookedSlots.push(selectedSlot.slot_id);
        selectedSlot = null;
        showError('That slot was just taken — please pick another time.');
        setSubmitting(false);
        goToStep(1, 'back');
        return;
      }

      if (!res.ok) {
        showError('Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }

      // Success
      pendingBooking = { name, date: selectedSlot.date, time: selectedSlot.time };
      goToStep('success', 'forward');
      animateSuccess(pendingBooking);

    } catch {
      showError('Network error — please check your connection and try again.');
      setSubmitting(false);
    }
  });

  function showError(msg) {
    errorBanner.textContent = msg;
    errorBanner.hidden = false;
    errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---- Success animations ---- */
  function animateSuccess({ name, date, time }) {
    // Populate text
    successName.textContent = `Hi ${name.split(' ')[0]}!`;
    successDate.textContent = `📅 ${date}`;
    successTime.textContent = `⏰ ${time} AWST`;

    // Animate ring + check
    const ring  = document.querySelector('.bk-ring');
    const check = document.querySelector('.bk-check');
    ring.classList.add('bk-animate');
    check.classList.add('bk-animate');

    // Animate title + details
    successTitle.classList.add('bk-animate');
    [successName, successDate, successTime].forEach(el => el.classList.add('bk-animate'));

    // Confetti
    setTimeout(() => spawnConfetti(), 400);
  }

  const CONFETTI_COLORS = ['#2563EB', '#7C3AED', '#059669', '#F59E0B', '#EF4444', '#EC4899'];

  function spawnConfetti() {
    confettiWrap.innerHTML = '';
    for (let i = 0; i < 12; i++) {
      const dot = document.createElement('div');
      dot.className = 'bk-confetti-dot bk-animate';
      const angle = (i / 12) * 360;
      const dist  = 34 + Math.random() * 20;
      const dx = Math.cos((angle * Math.PI) / 180) * dist;
      const dy = Math.sin((angle * Math.PI) / 180) * dist;
      dot.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      dot.style.animationDelay = `${Math.random() * 80}ms`;
      dot.style.setProperty('--dx', `${dx}px`);
      dot.style.setProperty('--dy', `${dy}px`);
      dot.style.transform = `translate(${dx}px, ${dy}px)`;
      // Override animation to use CSS custom properties via keyframe workaround
      dot.style.animation = `bk-confetti-burst 600ms ease-out ${Math.random() * 80}ms both`;
      // Apply final position inline (browser handles from 0,0 via keyframe)
      dot.style.left = `${dx}px`;
      dot.style.top  = `${dy}px`;
      confettiWrap.appendChild(dot);
    }
  }

  /* ---- Month navigation ---- */
  calPrev.addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });

  calNext.addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });

  /* ---- Back buttons ---- */
  backTo1.addEventListener('click', () => goToStep(1, 'back'));
  backTo1From3.addEventListener('click', () => goToStep(1, 'back'));
  chipEdit.addEventListener('click', () => goToStep(1, 'back'));

  /* ---- Close ---- */
  closeBtn.addEventListener('click', closeModal);
  successClose.addEventListener('click', closeModal);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && backdrop.classList.contains('bk-open')) closeModal(); });

  /* ---- Mobile swipe-down to close ---- */
  let touchStartY = 0;
  modal.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
  modal.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (dy > 80 && modal.scrollTop === 0) closeModal();
  }, { passive: true });

  /* ---- Wire up all .book-btn triggers ---- */
  document.querySelectorAll('.book-btn').forEach(btn => {
    btn.addEventListener('click', openModal);
  });

  /* ---- Init calendar ---- */
  (function init() {
    const n = nowAWST();
    calYear  = n.getUTCFullYear();
    calMonth = n.getUTCMonth();
    renderCalendar();
  })();

})();
