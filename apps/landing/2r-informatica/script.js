document.documentElement.classList.add('js');

const header = document.querySelector('.site-header');
const navToggle = document.querySelector('.nav-toggle');
const mainNav = document.querySelector('.main-nav');
const navLinks = document.querySelectorAll('.main-nav a');
const revealElements = document.querySelectorAll('.reveal');

function updateHeader() {
  header?.classList.toggle('scrolled', window.scrollY > 24);
}

window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

function setMenu(open) {
  if (!navToggle || !mainNav) return;

  mainNav.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  document.body.classList.toggle('menu-open', open);
}

navToggle?.addEventListener('click', () => {
  const isOpen = mainNav?.classList.contains('open') ?? false;
  setMenu(!isOpen);
});

navLinks.forEach((link) => {
  link.addEventListener('click', () => setMenu(false));
});

document.addEventListener('click', (event) => {
  if (!mainNav?.classList.contains('open')) return;
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (mainNav.contains(target) || navToggle?.contains(target)) return;
  setMenu(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenu(false);
});

const observer = 'IntersectionObserver' in window
  ? new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          currentObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12 }
    )
  : null;

if (observer) {
  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add('is-visible'));
}

const contactForm = document.querySelector('.contact-form');
const formStatus = document.querySelector('.form-status');

if (contactForm && formStatus) {
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    formStatus.textContent = '';

    if (!contactForm.checkValidity()) {
      contactForm.reportValidity();
      return;
    }

    formStatus.textContent = 'Solicitação pronta para integração com o canal de atendimento.';
    contactForm.reset();
  });
}
