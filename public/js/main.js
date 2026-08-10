/* ============================================
   Aaideology — Main JavaScript with Scroll Reveal
   ============================================ */

// ==================== XSS PROTECTION ====================
// All text that comes from the admin-editable content API (job titles,
// section text, values/services/industries copy, poster captions, etc.)
// is inserted into the page via innerHTML for layout flexibility. Without
// escaping, a "<script>" saved anywhere in the admin panel — whether by a
// malicious admin, a compromised admin session, or just an accidental paste
// from a rich text source — would execute for every visitor. Every dynamic
// string below is passed through escapeHtml() first.
// Admin-editable "color" fields get interpolated directly into a style=""
// attribute (e.g. style="background: ${color}15;"). escapeHtml alone isn't
// enough there — a value like `red" onmouseover="alert(1)` would still
// break out of the attribute. Only allow values that actually look like a
// CSS color; anything else is dropped.
const SAFE_CSS_COLOR = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)|[a-zA-Z]{3,20})$/;
function sanitizeCssColor(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return SAFE_CSS_COLOR.test(trimmed) ? trimmed : '';
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==================== SCROLL REVEAL ====================
// This drives every "fade/slide in on scroll" motion on the site: any
// element with a .reveal / .reveal-left / .reveal-right / .reveal-scale /
// .reveal-stagger class starts hidden (see style.css) and animates in once
// it enters the viewport.
//
// IMPORTANT: content that's loaded from the admin panel (dynamic sections,
// jobs, posters, etc.) is added to the page *after* this script first runs,
// via async fetch calls. A plain one-time querySelectorAll would only catch
// elements that already existed at page-load and silently miss everything
// added later — which is exactly why newly added sections' headings used to
// never appear (they were permanently stuck at opacity:0). The
// MutationObserver below watches the whole page forever and registers any
// reveal element the instant it's inserted, no matter when or how.
const REVEAL_SELECTOR = '.reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-stagger';

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('active');
      revealObserver.unobserve(entry.target); // animate in once, then stop watching
    }
  });
}, { root: null, rootMargin: '0px 0px -60px 0px', threshold: 0.12 });

function observeReveal(el) {
  if (el.classList.contains('active')) return;
  revealObserver.observe(el);
}

function registerRevealElements(root = document) {
  root.querySelectorAll(REVEAL_SELECTOR).forEach(observeReveal);
}

// Register everything present at initial load
registerRevealElements();

// Safety net: on some fast/cached loads the browser can report a scroll
// position where an element is already inside the viewport before the
// IntersectionObserver has attached, which would otherwise leave it stuck
// at opacity:0 forever. This sweeps once on load (and again after dynamic
// content mounts) and force-activates anything already visible.
function activateAlreadyVisible(root = document) {
  root.querySelectorAll(REVEAL_SELECTOR).forEach(el => {
    if (el.classList.contains('active')) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      el.classList.add('active');
      revealObserver.unobserve(el);
    }
  });
}
window.addEventListener('load', () => activateAlreadyVisible());

// Watch for anything added later (dynamic sections, jobs, posters, etc.)
const revealMutationObserver = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return; // only element nodes
      if (node.matches && node.matches(REVEAL_SELECTOR)) observeReveal(node);
      registerRevealElements(node);
    });
  });
});
revealMutationObserver.observe(document.body, { childList: true, subtree: true });

// ==================== NAVBAR SCROLL ====================
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) navbar.classList.add('scrolled');
  else navbar.classList.remove('scrolled');
});

// ==================== MOBILE MENU ====================
const mobileToggle = document.getElementById('mobileToggle');
const navLinks = document.getElementById('navLinks');
mobileToggle?.addEventListener('click', () => {
  navLinks.classList.toggle('mobile-open');
});
// Auto-close the mobile menu as soon as a section link is tapped, so the
// menu doesn't stay open covering the section the visitor just chose.
navLinks?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('mobile-open');
  });
});

// ==================== WHATSAPP FLOAT BUTTON ====================
const whatsappFloat = document.getElementById('whatsappFloat');
if (whatsappFloat) {
  const toggleWhatsappVisibility = () => {
    if (window.scrollY > 300) whatsappFloat.classList.add('visible');
    else whatsappFloat.classList.remove('visible');
  };
  window.addEventListener('scroll', toggleWhatsappVisibility);
  toggleWhatsappVisibility();
}

// ==================== ANIMATED COUNTERS ====================
function animateCounters() {
  const counters = document.querySelectorAll('.stat-number[data-target]');

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const counter = entry.target;
        const target = parseInt(counter.getAttribute('data-target'));
        const suffix = counter.textContent.replace(/[0-9]/g, '');
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        const updateCounter = () => {
          current += step;
          if (current < target) {
            counter.textContent = Math.floor(current) + suffix;
            requestAnimationFrame(updateCounter);
          } else {
            counter.textContent = target + suffix;
          }
        };

        updateCounter();
        counterObserver.unobserve(counter);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(c => counterObserver.observe(c));
}

// ==================== ICON SVGs ====================
function getIconSvg(name, color) {
  const icons = {
    'search': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
    'folder': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    'user-plus': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
    'credit-card': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    'scale': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="m12 22 4-4"/><path d="m12 22-4-4"/><path d="M12 16V2"/><path d="m16 6-4-4-4 4"/></svg>`,
    'shield-check': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 12 15 16 10"/></svg>`,
    'book-open': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    'users': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    'shield': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    'star': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    'zap': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    'heart': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    'award': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`,
    'handshake': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    'building': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="1"/><line x1="9" y1="6" x2="9" y2="6"/><line x1="15" y1="6" x2="15" y2="6"/><line x1="9" y1="10" x2="9" y2="10"/><line x1="15" y1="10" x2="15" y2="10"/></svg>`,
    'target': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    'clock': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    'compass': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
    'office-building': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="1"/><line x1="8" y1="6" x2="8" y2="6"/><line x1="16" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/></svg>`,
    'layers': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>`,
    'dollar-sign': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    'heart-pulse': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/><path d="M9 12h1.5l1-2 2 4 1-2H17"/></svg>`,
    'shopping-cart': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`
  };
  return icons[name] || icons['search'];
}

// ==================== INDUSTRIES ACCORDION ====================
function toggleIndustryCard(idx) {
  const rolesEl = document.getElementById(`industryRoles${idx}`);
  if (!rolesEl) return;
  const card = rolesEl.closest('.industry-card');
  if (!card) return;
  const isOpen = card.classList.contains('is-open');
  // Close any other open cards (accordion-style, one at a time)
  document.querySelectorAll('.industry-card.is-open').forEach(c => {
    if (c !== card) {
      c.classList.remove('is-open');
      const t = c.querySelector('.industry-toggle');
      if (t) t.textContent = '+';
    }
  });
  card.classList.toggle('is-open', !isOpen);
  const toggle = document.getElementById(`industryToggle${idx}`);
  if (toggle) toggle.textContent = isOpen ? '+' : '−';
}

// ==================== LOAD CONTENT ====================
async function loadContent() {
  try {
    const res = await fetch('/api/content');
    const data = await res.json();

    if (data.hero) {
      const home = document.getElementById('home');
      if (home) home.style.display = data.hero.visible === false ? 'none' : '';
      document.getElementById('heroHeadline').textContent = data.hero.headline;
      document.getElementById('heroSubheadline').textContent = data.hero.subheadline;
      document.getElementById('heroCta').textContent = data.hero.ctaText;
      document.getElementById('heroCta').href = data.hero.ctaLink;
    }

    if (data.stats) {
      const statsBar = document.getElementById('statsBar');
      if (statsBar) {
        statsBar.style.display = data.stats.visible === false ? 'none' : '';
        if (data.stats.items && data.stats.items.length) {
          statsBar.innerHTML = data.stats.items.map(s => `
            <div class="stat-item">
              <div class="stat-icon">${getIconSvg(s.icon, '#fff')}</div>
              <div class="stat-number" data-target="${Number(s.number) || 0}">0${escapeHtml(s.suffix || '')}</div>
              <div class="stat-label">${escapeHtml(s.label)}</div>
            </div>
          `).join('');
        }
      }
    }

    if (data.about) {
      const about = document.getElementById('about');
      if (about) about.style.display = data.about.visible === false ? 'none' : '';
      document.getElementById('aboutTag').textContent = data.about.tag;
      document.getElementById('aboutTitle').textContent = data.about.title;
      // NOTE: this one field is intentionally rendered as rich text (the
      // admin panel's About description supports basic tags like <strong>),
      // so it is NOT escaped. It is only ever settable by an authenticated
      // admin — treat it as a trusted-input field, same as the other
      // admin-only write endpoints protected by requireAdmin + CSRF.
      document.getElementById('aboutDesc').innerHTML = data.about.description;
      document.getElementById('companyBackground').textContent = data.about.companyBackground;
      document.getElementById('ourMission').textContent = data.about.mission;
      if (data.about.image) document.getElementById('aboutImage').src = data.about.image;
    }

    if (data.values) {
      const valuesSection = document.getElementById('values');
      if (valuesSection) valuesSection.style.display = data.values.visible === false ? 'none' : '';
      if (data.values.tag) document.getElementById('valuesTag').textContent = data.values.tag;
      if (data.values.title) document.getElementById('valuesTitle').textContent = data.values.title;
      const valuesGrid = document.getElementById('valuesGrid');
      if (valuesGrid && data.values.items && data.values.items.length) {
        valuesGrid.innerHTML = data.values.items.map(v => `
          <div class="value-card">
            <div class="value-icon-wrapper" style="background: ${sanitizeCssColor(v.color) || '#3b82f6'}15;">
              ${getIconSvg(v.icon, sanitizeCssColor(v.color) || '#3b82f6')}
            </div>
            <h4>${escapeHtml(v.title)}</h4>
            <p>${escapeHtml(v.description)}</p>
          </div>
        `).join('');
      }
    }

    if (data.services) {
      const servicesSection = document.getElementById('services');
      if (servicesSection) servicesSection.style.display = data.services.visible === false ? 'none' : '';
      document.getElementById('servicesTag').textContent = data.services.tag;
      document.getElementById('servicesTitle').textContent = data.services.title;
      document.getElementById('servicesSubtitle').textContent = data.services.subtitle;
    }

    if (data.industries) {
      const industriesSection = document.getElementById('industries');
      if (industriesSection) industriesSection.style.display = data.industries.visible === false ? 'none' : '';
      if (data.industries.tag) document.getElementById('industriesTag').textContent = data.industries.tag;
      if (data.industries.title) document.getElementById('industriesTitle').textContent = data.industries.title;
      if (data.industries.subtitle) document.getElementById('industriesSubtitle').textContent = data.industries.subtitle;
      const industriesGrid = document.getElementById('industriesGrid');
      if (industriesGrid && data.industries.items && data.industries.items.length) {
        industriesGrid.innerHTML = data.industries.items.map((i, idx) => {
          const roles = Array.isArray(i.roles)
            ? i.roles.filter(Boolean)
            : (typeof i.roles === 'string' ? i.roles.split('\n').map(r => r.trim()).filter(Boolean) : []);
          const hasRoles = roles.length > 0;
          return `
          <div class="industry-card${hasRoles ? ' is-expandable' : ''}" ${hasRoles ? `onclick="toggleIndustryCard(${idx})"` : ''}>
            <div class="industry-card-head">
              <div class="industry-icon">
                ${getIconSvg(i.icon, 'currentColor')}
              </div>
              <h4>${escapeHtml(i.title)}</h4>
              ${hasRoles ? `<span class="industry-toggle" id="industryToggle${idx}">+</span>` : ''}
            </div>
            ${hasRoles ? `
              <div class="industry-roles" id="industryRoles${idx}">
                <ul>
                  ${roles.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `;
        }).join('');
      }
    }

    if (data.serviceList) {
      const grid = document.getElementById('servicesGrid');
      grid.innerHTML = data.serviceList.map(s => {
        const color = sanitizeCssColor(s.color) || '#3b82f6';
        return `
        <div class="service-card" style="--card-color: ${color}; --icon-bg: ${color}15;">
          <div class="service-icon" style="color: ${color}; background: ${color}15;">
            ${getIconSvg(s.icon, color)}
          </div>
          <h4>${escapeHtml(s.title)}</h4>
          <p>${escapeHtml(s.description)}</p>
          <a href="#contact" class="learn-more">Learn More ↓</a>
        </div>
      `;
      }).join('');
    }

    if (data.contact) {
      const contactSection = document.getElementById('contact');
      if (contactSection) contactSection.style.display = data.contact.visible === false ? 'none' : '';
      const contactTag = document.getElementById('contactTag');
      if (contactTag && data.contact.tag) contactTag.textContent = data.contact.tag;
      const contactTitle = document.getElementById('contactTitle');
      if (contactTitle && data.contact.title) contactTitle.textContent = data.contact.title;
      const contactSubtitle = document.getElementById('contactSubtitle');
      if (contactSubtitle && data.contact.subtitle) contactSubtitle.textContent = data.contact.subtitle;
      document.getElementById('contactEmail').textContent = data.contact.email;
      document.getElementById('contactPhone').textContent = data.contact.phone;
      document.getElementById('contactAddress').textContent = data.contact.address;

      // Populate footer contact dynamically from the same data
      const footerContact = document.getElementById('footerContact');
      if (footerContact) {
        const emails = (data.contact.email || '').split(',').map(e => e.trim()).filter(Boolean);
        const phones = (data.contact.phone || '').split(',').map(p => p.trim()).filter(Boolean);
        let footerHtml = '<h4>Contact</h4>';
        if (emails.length) {
          footerHtml += '<div class="footer-contact-label">Email</div><div class="footer-contact-links">';
          emails.forEach(em => {
            footerHtml += `<a href="mailto:${escapeHtml(em)}">${escapeHtml(em)}</a>`;
          });
          footerHtml += '</div>';
        }
        if (phones.length) {
          footerHtml += '<div class="footer-contact-label">Phone</div><div class="footer-contact-links">';
          phones.forEach(ph => {
            const telHref = ph.replace(/[\s()-]/g, '');
            footerHtml += `<a href="tel:${escapeHtml(telHref)}">${escapeHtml(ph)}</a>`;
          });
          footerHtml += '</div>';
        }
        footerContact.innerHTML = footerHtml;
      }
    }

    if (data.footer) {
      document.getElementById('footerCopyright').textContent = data.footer.copyright;
    }

    setTimeout(() => activateAlreadyVisible(), 100);

    // Stats bar HTML was just replaced above, so (re)wire up the counter
    // animation now that the elements actually exist in the DOM.
    animateCounters();

  } catch (err) {
    console.error('Failed to load content:', err);
  }
}

// ==================== LOAD JOBS ====================
let cachedJobs = []; // Shared between loadJobs() and openJobDetailModal()

async function loadJobs() {
  try {
    const res = await fetch('/api/jobs');
    const jobs = await res.json();
    cachedJobs = jobs;
    const grid = document.getElementById('jobsGrid');

    if (jobs.length === 0) {
      grid.innerHTML = '<p class="no-jobs">No job openings at the moment. Check back soon!</p>';
      return;
    }

    grid.innerHTML = jobs.map(job => `
      <div class="job-card">
        <h4 class="job-title">${escapeHtml(job.title)}</h4>
        <div class="job-meta">
          ${job.type ? `<span class="job-type">💼 ${escapeHtml(job.type)}</span>` : ''}
          ${job.salary ? `<span class="job-salary">💰 ${escapeHtml(job.salary)}</span>` : ''}
          ${job.location ? `<span class="job-location">📍 ${escapeHtml(job.location)}</span>` : ''}
        </div>
        ${job.summary ? `<p class="job-summary">${escapeHtml(job.summary)}</p>` : ''}
        <div class="job-tags">
          ${(job.tags || []).map(t => `<span class="job-tag">${escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="job-card-buttons">
          <button class="btn-secondary job-detail-btn" data-job-id="${escapeHtml(String(job._id || job.id))}">View Details</button>
          <button class="btn-primary job-apply-btn" data-job-title="${escapeHtml(job.title)}">Apply Now</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load jobs:', err);
  }
}

// Delegated click handler avoids ever building an inline onclick="" string
// out of admin-controlled job titles (attribute-context injection risk).
document.addEventListener('click', (e) => {
  const applyBtn = e.target.closest('.job-apply-btn');
  if (applyBtn) return openApplyModal(applyBtn.dataset.jobTitle || '');

  const detailBtn = e.target.closest('.job-detail-btn');
  if (detailBtn) return openJobDetailModal(detailBtn.dataset.jobId);
});

// ==================== LOAD POSTERS ====================
async function loadPosters() {
  try {
    const res = await fetch('/api/posters');
    const posters = await res.json();
    const container = document.getElementById('postersContainer');

    if (posters.length === 0) {
      container.innerHTML = '<p class="no-posters">No updates yet. Stay tuned!</p>';
      return;
    }

    container.innerHTML = posters.map(p => `
      <div class="poster-item">
        <img src="${encodeURI(p.url || '')}" alt="${escapeHtml(p.originalName)}" loading="lazy">
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load posters:', err);
  }
}

// ==================== LOAD REVIEWS ====================
function renderStars(rating) {
  const r = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += i <= r ? '★' : '<span class="star-empty">★</span>';
  }
  return html;
}

function renderReviewCards(list) {
  const LONG_REVIEW_LIMIT = 220;
  return list.map(r => {
    const isLong = r.text.length > LONG_REVIEW_LIMIT;
    return `
    <div class="review-card${isLong ? ' is-long' : ''}">
      <div class="review-stars">${renderStars(r.rating)}</div>
      <p class="review-text">${escapeHtml(r.text)}</p>
      <div class="review-author">— ${escapeHtml(r.name)}</div>
      ${isLong ? `<button type="button" class="review-toggle" onclick="const c=this.closest('.review-card'); c.classList.toggle('expanded'); this.textContent = c.classList.contains('expanded') ? 'Read less' : 'Read more';">Read more</button>` : ''}
    </div>
  `;
  }).join('');
}

async function loadReviews() {
  try {
    const res = await fetch('/api/reviews');
    const reviews = await res.json();
    const candidateGrid = document.getElementById('reviewsGridCandidates');
    const clientGrid = document.getElementById('reviewsGridClients');
    if (!candidateGrid && !clientGrid) return;

    // Reviews are only ever shown here once an admin has approved them
    // (the API already filters to approved:true). Older reviews saved
    // before the candidate/client split default to "candidate".
    const candidateReviews = reviews.filter(r => (r.type || 'candidate') === 'candidate');
    const clientReviews = reviews.filter(r => r.type === 'client');

    if (candidateGrid) {
      candidateGrid.innerHTML = candidateReviews.length
        ? renderReviewCards(candidateReviews)
        : '<p class="no-reviews">No candidate reviews yet. Be the first to share your experience!</p>';
    }
    if (clientGrid) {
      clientGrid.innerHTML = clientReviews.length
        ? renderReviewCards(clientReviews)
        : '<p class="no-reviews">No client reviews yet. Be the first to share your experience!</p>';
    }
  } catch (err) {
    console.error('Failed to load reviews:', err);
  }
}

document.getElementById('reviewForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = Object.fromEntries(new FormData(e.target));
  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Review submitted for approval!', 'success');
      e.target.reset();
    } else {
      showToast(data.error || 'Something went wrong', 'error');
    }
  } catch (err) {
    showToast('Failed to submit. Please try again.', 'error');
  }
});

// ==================== LOAD HERO IMAGE ====================
async function loadHeroImage() {
  try {
    const res = await fetch('/api/hero-image');
    const data = await res.json();
    if (data.exists) {
      const heroBg = document.getElementById('heroBg');
      heroBg.style.backgroundImage = `url(${data.url})`;
      heroBg.classList.add('has-image');
    }
  } catch (err) {
    console.error('Failed to load hero image:', err);
  }
}

// ==================== MODALS ====================
function openApplyModal(position = '') {
  const modal = document.getElementById('applyModal');
  modal.classList.add('active');
  if (position) {
    const posInput = modal.querySelector('[name="position"]');
    if (posInput) posInput.value = position;
  }
  document.body.style.overflow = 'hidden';
}

function closeApplyModal() {
  document.getElementById('applyModal').classList.remove('active');
  document.body.style.overflow = '';
}

function openHireModal() {
  document.getElementById('hireModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeHireModal() {
  document.getElementById('hireModal').classList.remove('active');
  document.body.style.overflow = '';
}

// ==================== JOB DETAIL MODAL ====================
function textToList(text) {
  if (!text) return '';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return `<p>${escapeHtml(text)}</p>`;
  return '<ul>' + lines.map(l => `<li>${escapeHtml(l)}</li>`).join('') + '</ul>';
}

function openJobDetailModal(jobId) {
  const job = cachedJobs.find(j => String(j._id || j.id) === String(jobId));
  if (!job) return;

  const metaItems = [
    job.department ? `<span class="job-detail-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="1"/><line x1="8" y1="6" x2="8" y2="6"/><line x1="16" y1="6" x2="16" y2="6"/></svg>${escapeHtml(job.department)}</span>` : '',
    job.location ? `<span class="job-detail-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${escapeHtml(job.location)}</span>` : '',
    job.type ? `<span class="job-detail-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>${escapeHtml(job.type)}</span>` : '',
    job.experience ? `<span class="job-detail-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${escapeHtml(job.experience)}</span>` : '',
    job.salary ? `<span class="job-detail-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>${escapeHtml(job.salary)}</span>` : ''
  ].filter(Boolean).join('');

  const tags = (job.tags || []).length
    ? `<div class="job-detail-tags">${job.tags.map(t => `<span class="job-tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';

  const sections = [
    job.description ? `<div class="job-detail-section"><h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Job Description</h4>${textToList(job.description)}</div>` : '',
    job.responsibilities ? `<div class="job-detail-section"><h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>Responsibilities</h4>${textToList(job.responsibilities)}</div>` : '',
    job.requirements ? `<div class="job-detail-section"><h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>Requirements</h4>${textToList(job.requirements)}</div>` : '',
    job.qualifications ? `<div class="job-detail-section"><h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>Qualifications</h4>${textToList(job.qualifications)}</div>` : '',
    job.benefits ? `<div class="job-detail-section"><h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>Benefits</h4>${textToList(job.benefits)}</div>` : ''
  ].filter(Boolean).join('');

  const noDetails = !sections;

  document.getElementById('jobDetailContent').innerHTML = `
    <div class="job-detail-header">
      <button class="modal-close" onclick="closeJobDetailModal()" aria-label="Close">×</button>
      <h2>${escapeHtml(job.title)}</h2>
      ${metaItems ? `<div class="job-detail-meta">${metaItems}</div>` : ''}
      ${tags}
    </div>
    <div class="job-detail-body">
      ${sections || '<p style="color: var(--ink-soft); font-style: italic;">Detailed description coming soon. Apply now to express your interest!</p>'}
      <div class="job-detail-actions">
        <button class="btn-primary" onclick="closeJobDetailModal(); openApplyModal('${escapeHtml(job.title).replace(/'/g, "\\'")}')">Apply for this Position</button>
      </div>
    </div>
  `;

  document.getElementById('jobDetailModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeJobDetailModal() {
  document.getElementById('jobDetailModal').classList.remove('active');
  document.body.style.overflow = '';
}

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
});

// ==================== FORMS ====================
document.getElementById('applyForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  try {
    const res = await fetch('/api/apply', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      showToast('Application submitted successfully!', 'success');
      e.target.reset();
      closeApplyModal();
    } else {
      showToast(data.error || 'Something went wrong', 'error');
    }
  } catch (err) {
    showToast('Failed to submit. Please try again.', 'error');
  }
});

document.getElementById('hireForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const submitBtn = document.getElementById('hireSubmitBtn');

  // Client-side validation
  const fd = Object.fromEntries(new FormData(form));
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_RE = /^[+]?[\d\s\-().]{7,20}$/;

  if (!fd.companyName || !fd.contactName || !fd.email || !fd.phone || !fd.jobTitle || !fd.positions || !fd.jobDescription) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }
  if (!EMAIL_RE.test(fd.email.trim())) {
    showToast('Please enter a valid email address.', 'error');
    return;
  }
  if (!PHONE_RE.test(fd.phone.trim())) {
    showToast('Please enter a valid phone number.', 'error');
    return;
  }

  // Prevent duplicate submission
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const res = await fetch('/api/hire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fd)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Hiring request submitted successfully! We will contact you soon.', 'success');
      form.reset();
      closeHireModal();
    } else {
      showToast(data.error || 'Something went wrong', 'error');
    }
  } catch (err) {
    showToast('Failed to submit. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Hiring Request';
  }
});

document.getElementById('contactForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = Object.fromEntries(new FormData(e.target));
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Message sent successfully!', 'success');
      e.target.reset();
    } else {
      showToast(data.error || 'Something went wrong', 'error');
    }
  } catch (err) {
    showToast('Failed to send. Please try again.', 'error');
  }
});

// ==================== TOAST ====================
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 4000);
}



// ==================== INIT ====================
// Note: admin-added dynamic sections + navbar sync are handled by the
// loadDynamicSections() script at the bottom of index.html (it needs to run
// after all static sections exist in the DOM to insert/position correctly).
document.addEventListener('DOMContentLoaded', () => {
  loadContent();
  loadJobs();
  loadPosters();
  loadReviews();
  loadHeroImage();
});