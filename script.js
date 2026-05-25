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
