/* ============================================
   Control Garage – Officina Meccatronica
   Main Script – Enhanced
   ============================================ */

(function () {
  'use strict';

  /* ============================================
     Reduced Motion Detection
     ============================================ */
  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================================
     Utility: wait for DOM + scripts ready
     ============================================ */
  function onReady(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  /* ============================================
     Reduced Motion Fallback
     Make all animated elements immediately visible
     ============================================ */
  function applyReducedMotionFallback() {
    var selectors = [
      '.hero-title', '.hero-subtitle', '.hero-accent-line',
      '#heroContent', '.garage-door',
      '.reveal-up',
      '.menu-card', '.pricing-card', '.info-block',
      '.stat-number', '.nav-cta'
    ];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    });
  }

  /* ============================================
     IntersectionObserver Fallback
     Used when GSAP is not available
     ============================================ */
  function initIntersectionFallback() {
    if (typeof IntersectionObserver === 'undefined') {
      document.querySelectorAll('.reveal-up, .menu-card, .pricing-card, .info-block').forEach(function (el) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'none';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    document.querySelectorAll('.reveal-up, .menu-card, .pricing-card, .info-block').forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      observer.observe(el);
    });
  }

  /* ============================================
     Page Loader
     ============================================ */
  function initLoader() {
    var loader = document.getElementById('pageLoader');
    if (!loader) return;

    var bar = document.createElement('div');
    bar.className = 'loader-bar';
    var fill = document.createElement('div');
    fill.className = 'loader-bar-fill';
    bar.appendChild(fill);
    var inner = loader.querySelector('.loader-inner');
    if (inner) inner.appendChild(bar);

    setTimeout(function () {
      loader.classList.add('hidden');
      loader.addEventListener('transitionend', function () {
        loader.remove();
      }, { once: true });
      initAnimations();
    }, 1800);
  }

  /* ============================================
     Lenis Smooth Scroll
     ============================================ */
  function initLenis() {
    if (typeof Lenis === 'undefined') return null;

    var lenis = new Lenis({
      duration: 1.0,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      orientation: 'vertical',
      smoothWheel: true,
    });

    var lenisRafId;

    function raf(time) {
      lenis.raf(time);
      lenisRafId = requestAnimationFrame(raf);
    }
    lenisRafId = requestAnimationFrame(raf);

    if (typeof ScrollTrigger !== 'undefined') {
      lenis.on('scroll', ScrollTrigger.update);
      ScrollTrigger.scrollerProxy(document.documentElement, {
        scrollTop: function (value) {
          if (arguments.length) {
            lenis.scrollTo(value, { immediate: true });
          }
          return lenis.scroll;
        },
        getBoundingClientRect: function () {
          return {
            top: 0,
            left: 0,
            width: window.innerWidth,
            height: window.innerHeight,
          };
        },
      });
    }

    // Pause Lenis when page is hidden to save CPU
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        cancelAnimationFrame(lenisRafId);
      } else {
        lenisRafId = requestAnimationFrame(raf);
      }
    });

    return lenis;
  }

  /* ============================================
     Navbar Scroll Detection + CTA Scale
     ============================================ */
  function initNavbar() {
    var navbar = document.getElementById('navbar');
    if (!navbar) return;

    var navCta = navbar.querySelector('.nav-cta');
    var lastScrollY = 0;
    var ctaScaled = false;

    function onScroll() {
      var sy = window.scrollY;

      if (sy > 60) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }

      // Subtle nav-cta scale pulse when user first scrolls down
      if (navCta && typeof gsap !== 'undefined' && !prefersReducedMotion) {
        if (sy > 200 && !ctaScaled) {
          ctaScaled = true;
          gsap.fromTo(navCta,
            { scale: 1 },
            { scale: 1.07, duration: 0.25, ease: 'back.out(2)', yoyo: true, repeat: 1 }
          );
        } else if (sy <= 60) {
          ctaScaled = false;
        }
      }

      lastScrollY = sy;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ============================================
     Mobile Nav Toggle
     ============================================ */
  function initMobileNav() {
    var toggle = document.getElementById('navToggle');
    var links = document.getElementById('navLinks');
    if (!toggle || !links) return;

    toggle.addEventListener('click', function () {
      var isOpen = links.classList.contains('open');
      links.classList.toggle('open');
      toggle.classList.toggle('active');
      toggle.setAttribute('aria-expanded', String(!isOpen));
    });

    links.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        links.classList.remove('open');
        toggle.classList.remove('active');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ============================================
     Stats Counter Animation
     ============================================ */
  function animateCounter(element, target, duration) {
    var prefix = element.getAttribute('data-prefix') || '';
    var suffix = element.getAttribute('data-suffix') || '';
    function format(val) {
      return prefix + Math.round(val).toLocaleString('it-IT') + suffix;
    }
    if (typeof gsap === 'undefined') {
      element.textContent = format(target);
      return;
    }
    var obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration: duration || 2,
      ease: 'power2.out',
      onUpdate: function () {
        element.textContent = format(obj.val);
      },
    });
  }

  /* ============================================
     Garage Intro (removed – hero shows immediately)
     ============================================ */
  function initGarageIntro() {
    // No-op: garage door animation removed
  }

  /* ============================================
     Scroll Animations (GSAP ScrollTrigger)
     ============================================ */
  function initScrollAnimations() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      initIntersectionFallback();
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    // Generic reveal-up elements
    gsap.utils.toArray('.reveal-up').forEach(function (el) {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.75,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          once: true,
        },
      });
    });

    // Service cards with slight rotation + stagger
    var menuCards = gsap.utils.toArray('.menu-card');
    if (menuCards.length) {
      gsap.to(menuCards, {
        opacity: 1,
        y: 0,
        rotateX: 0,
        rotation: 0,
        duration: 0.75,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: {
          trigger: '.menu-grid',
          start: 'top 80%',
          once: true,
        },
      });
    }

    // Pricing cards with stagger
    var pricingCards = gsap.utils.toArray('.pricing-card');
    if (pricingCards.length) {
      gsap.to(pricingCards, {
        opacity: 1,
        y: 0,
        duration: 0.75,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: {
          trigger: '.pricing-grid',
          start: 'top 80%',
          once: true,
        },
      });
    }

    // Info blocks
    var infoBlocks = gsap.utils.toArray('.info-block');
    if (infoBlocks.length) {
      gsap.to(infoBlocks, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.2,
        scrollTrigger: {
          trigger: '.info-grid',
          start: 'top 80%',
          once: true,
        },
      });
    }

    // Stats counter animation
    var statNumbers = document.querySelectorAll('.stat-number[data-target]');
    if (statNumbers.length) {
      var statsTriggered = false;
      ScrollTrigger.create({
        trigger: statNumbers[0].closest('section') || statNumbers[0],
        start: 'top 80%',
        once: true,
        onEnter: function () {
          if (statsTriggered) return;
          statsTriggered = true;
          statNumbers.forEach(function (el) {
            var raw = el.getAttribute('data-target');
            var target = parseFloat(raw.replace(/[^0-9.]/g, ''));
            if (!isNaN(target)) {
              animateCounter(el, target, 2);
            }
          });
        },
      });
    }

    // About section gear parallax
    var aboutGear = document.querySelector('.about-gear, .about-icon, .section-gear');
    if (aboutGear) {
      gsap.to(aboutGear, {
        y: -40,
        ease: 'none',
        scrollTrigger: {
          trigger: aboutGear.closest('section') || aboutGear,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.5,
        },
      });
    }

    // Section heading parallax
    gsap.utils.toArray('.section-heading, .section-title h2').forEach(function (el) {
      gsap.to(el, {
        y: -20,
        ease: 'none',
        scrollTrigger: {
          trigger: el.closest('section') || el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 2,
        },
      });
    });
  }

  /* ============================================
     Hero Scroll Hint Animation
     Fluid dot that travels down, fades, then resets
     ============================================ */
  function initScrollHint() {
    var dot = document.querySelector('.scroll-dot, .scroll-hint-dot');
    if (!dot || typeof gsap === 'undefined' || prefersReducedMotion) return;

    function playScrollHint() {
      gsap.timeline({ repeat: -1, repeatDelay: 0.6 })
        .fromTo(dot,
          { y: 0, opacity: 0 },
          { y: 22, opacity: 1, duration: 0.45, ease: 'power2.in' }
        )
        .to(dot, { y: 38, opacity: 0, duration: 0.45, ease: 'power2.out' });
    }

    playScrollHint();
  }

  /* ============================================
     Three.js Spark Particle System
     Metal sparks flying around the hero
     ============================================ */
  function initSparkParticles() {
    var canvas = document.getElementById('sparkCanvas');
    if (!canvas) return;

    if (prefersReducedMotion) {
      canvas.style.display = 'none';
      return;
    }

    try {
      if (typeof THREE === 'undefined') throw new Error('Three.js not loaded');

      var isMobile = /Mobi|Android/i.test(navigator.userAgent);
      var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2));
      renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(70, canvas.offsetWidth / canvas.offsetHeight, 0.1, 1000);
      camera.position.z = 5;

      // Mouse tracking for particle repulsion
      var mouse = { x: 0, y: 0 };
      var mouseLerp = { x: 0, y: 0 };
      window.addEventListener('mousemove', function (e) {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
      }, { passive: true });

      var PARTICLE_COUNT = 220;
      var positions = new Float32Array(PARTICLE_COUNT * 3);
      var colors = new Float32Array(PARTICLE_COUNT * 3);
      var sizes = new Float32Array(PARTICLE_COUNT);
      var baseSizes = new Float32Array(PARTICLE_COUNT);
      var velocities = new Float32Array(PARTICLE_COUNT * 3);
      var twinklePhase = new Float32Array(PARTICLE_COUNT);

      function getSpread() {
        var aspect = canvas.offsetWidth / canvas.offsetHeight;
        return { x: 4 * aspect, y: 5 };
      }

      function resetParticle(i) {
        var spread = getSpread();
        positions[i * 3] = (Math.random() - 0.5) * spread.x * 2;
        positions[i * 3 + 1] = -spread.y - Math.random() * 2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
        velocities[i * 3] = (Math.random() - 0.5) * 0.01;
        velocities[i * 3 + 1] = 0.006 + Math.random() * 0.014;
        velocities[i * 3 + 2] = Math.random() * Math.PI * 2;
        twinklePhase[i] = Math.random() * Math.PI * 2;

        var heat = Math.random();
        if (heat < 0.35) {
          colors[i * 3] = 0.72 + Math.random() * 0.15;
          colors[i * 3 + 1] = 0.53 + Math.random() * 0.12;
          colors[i * 3 + 2] = 0.04;
        } else if (heat < 0.7) {
          colors[i * 3] = 1.0;
          colors[i * 3 + 1] = 0.84 + Math.random() * 0.1;
          colors[i * 3 + 2] = 0.0;
        } else if (heat < 0.9) {
          colors[i * 3] = 1.0;
          colors[i * 3 + 1] = 0.95 + Math.random() * 0.05;
          colors[i * 3 + 2] = 0.5 + Math.random() * 0.3;
        } else {
          colors[i * 3] = 1.0;
          colors[i * 3 + 1] = 1.0;
          colors[i * 3 + 2] = 0.85 + Math.random() * 0.15;
        }

        baseSizes[i] = 3 + Math.random() * 8;
        sizes[i] = baseSizes[i];
      }

      for (var i = 0; i < PARTICLE_COUNT; i++) {
        resetParticle(i);
        positions[i * 3 + 1] = (Math.random() - 0.5) * getSpread().y * 2;
      }

      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      var material = new THREE.PointsMaterial({
        size: 0.1,
        sizeAttenuation: true,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
      });

      var particles = new THREE.Points(geometry, material);
      scene.add(particles);

      var light1 = new THREE.PointLight(0xFFD700, 1.0, 8);
      light1.position.set(0, -2, 2);
      scene.add(light1);
      var light2 = new THREE.PointLight(0xB8860B, 0.7, 6);
      light2.position.set(-2, -1, 2);
      scene.add(light2);
      var light3 = new THREE.PointLight(0xFFD700, 0.5, 6);
      light3.position.set(2, -1.5, 2);
      scene.add(light3);

      var frameId;
      var time = 0;
      var REPEL_RADIUS = 1.2;
      var REPEL_STRENGTH = 0.03;

      function animate() {
        frameId = requestAnimationFrame(animate);
        time += 0.016;

        mouseLerp.x += (mouse.x - mouseLerp.x) * 0.08;
        mouseLerp.y += (mouse.y - mouseLerp.y) * 0.08;

        var posAttr = geometry.attributes.position;
        var sizeAttr = geometry.attributes.size;
        var spread = getSpread();
        var mx = mouseLerp.x * spread.x;
        var my = mouseLerp.y * spread.y;

        for (var j = 0; j < PARTICLE_COUNT; j++) {
          positions[j * 3 + 1] += velocities[j * 3 + 1];
          var phase = velocities[j * 3 + 2];
          positions[j * 3] += Math.sin(time * 1.5 + phase) * 0.01;

          // Mouse repulsion
          var dx = positions[j * 3] - mx;
          var dy = positions[j * 3 + 1] - my;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < REPEL_RADIUS && dist > 0.01) {
            var force = (REPEL_RADIUS - dist) / REPEL_RADIUS * REPEL_STRENGTH;
            positions[j * 3] += (dx / dist) * force;
            positions[j * 3 + 1] += (dy / dist) * force;
          }

          // Twinkle
          sizes[j] = baseSizes[j] * (1 + Math.sin(time * 3.5 + twinklePhase[j]) * 0.35);

          if (positions[j * 3 + 1] > spread.y + 0.5) resetParticle(j);
        }

        posAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;

        light1.intensity = 1.0 + Math.sin(time * 2.0) * 0.25;
        light2.intensity = 0.7 + Math.sin(time * 1.5 + 1) * 0.15;
        light3.intensity = 0.5 + Math.sin(time * 2.5 + 2) * 0.12;

        renderer.render(scene, camera);
      }

      animate();

      function onResize() {
        var hero = canvas.parentElement;
        if (!hero) return;
        var w = hero.offsetWidth;
        var h = hero.offsetHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }

      window.addEventListener('resize', onResize, { passive: true });

      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          cancelAnimationFrame(frameId);
        } else {
          animate();
        }
      });

    } catch (err) {
      // Three.js failed – degrade gracefully
    }
  }

  /* ============================================
     Custom Cursor
     ============================================ */
  function initCustomCursor() {
    if (prefersReducedMotion) return;
    if ('ontouchstart' in window) return;

    var dot = document.getElementById('cursorDot');
    var ring = document.getElementById('cursorRing');
    if (!dot || !ring) return;

    var mouseX = -200, mouseY = -200;
    var ringX = -200, ringY = -200;
    var rafId;

    var HOVER_SELECTORS = 'a, button, .btn, .menu-card, .nav-toggle, .social-links a, .badge';

    window.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }, { passive: true });

    document.addEventListener('mouseleave', function () {
      dot.style.opacity = '0';
      ring.style.opacity = '0';
    });

    document.addEventListener('mouseenter', function () {
      dot.style.opacity = '';
      ring.style.opacity = '';
    });

    document.addEventListener('mousedown', function () {
      ring.classList.add('click');
    });

    document.addEventListener('mouseup', function () {
      ring.classList.remove('click');
    });

    // Hover state via event delegation
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest(HOVER_SELECTORS)) {
        dot.classList.add('hover');
        ring.classList.add('hover');
      }
    });

    document.addEventListener('mouseout', function (e) {
      if (e.target.closest(HOVER_SELECTORS)) {
        dot.classList.remove('hover');
        ring.classList.remove('hover');
      }
    });

    function loop() {
      // Dot follows exactly
      dot.style.left = mouseX + 'px';
      dot.style.top = mouseY + 'px';

      // Ring lerps with factor 0.15
      ringX += (mouseX - ringX) * 0.15;
      ringY += (mouseY - ringY) * 0.15;
      ring.style.left = ringX + 'px';
      ring.style.top = ringY + 'px';

      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    // Pause when tab hidden
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
      } else {
        rafId = requestAnimationFrame(loop);
      }
    });
  }

  /* ============================================
     Magnetic Buttons
     ============================================ */
  function initMagneticButtons() {
    if (prefersReducedMotion) return;
    if ('ontouchstart' in window) return;

    var MAGNETIC_SELECTORS = '.btn, .nav-cta, .social-links a';
    var RADIUS = 100;
    var STRENGTH = 0.3;

    document.querySelectorAll(MAGNETIC_SELECTORS).forEach(function (el) {
      el.classList.add('magnetic-wrap');

      el.addEventListener('mousemove', function (e) {
        var rect = el.getBoundingClientRect();
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 2;
        var dx = e.clientX - centerX;
        var dy = e.clientY - centerY;
        var dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < RADIUS) {
          var tx = dx * STRENGTH;
          var ty = dy * STRENGTH;
          el.style.transform = 'translate(' + tx + 'px, ' + ty + 'px)';
        }
      });

      el.addEventListener('mouseleave', function () {
        el.style.transform = 'translate(0, 0)';
      });
    });
  }

  /* ============================================
     Smooth anchor scrolling
     ============================================ */
  function initAnchorLinks() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var href = anchor.getAttribute('href');
        if (href === '#') return;
        var target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  /* ============================================
     3D Tilt Cards
     ============================================ */
  function initTiltCards() {
    if (prefersReducedMotion) return;
    // Skip on touch-only devices
    if (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;

    var cards = document.querySelectorAll('.menu-card');
    cards.forEach(function (card) {
      var inner = card.querySelector('.menu-card-inner');
      var glare = card.querySelector('.card-glare');
      if (!inner) return;

      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var cx = rect.width / 2;
        var cy = rect.height / 2;

        var rotateY = ((x - cx) / cx) * 12;
        var rotateX = -((y - cy) / cy) * 12;

        inner.style.transform = 'rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';

        if (glare) {
          var glareX = (x / rect.width) * 100;
          var glareY = (y / rect.height) * 100;
          card.style.setProperty('--glare-x', glareX + '%');
          card.style.setProperty('--glare-y', glareY + '%');
        }
      });

      card.addEventListener('mouseleave', function () {
        inner.style.transition = 'transform 0.5s ease';
        inner.style.transform = 'rotateX(0deg) rotateY(0deg)';
        setTimeout(function () {
          inner.style.transition = 'transform 0.1s ease';
        }, 500);
      });
    });
  }

  /* ============================================
     Scroll Text Reveal
     ============================================ */
  function initTextReveal() {
    if (prefersReducedMotion) return;
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    var headings = document.querySelectorAll('.section-heading');
    headings.forEach(function (heading) {
      // Split heading HTML by <br> tags into separate lines
      var rawHTML = heading.innerHTML;
      var lines = rawHTML.split(/<br\s*\/?>/i);

      // Replace heading content with wrapped lines
      heading.innerHTML = lines.map(function (lineHTML) {
        return '<span class="text-reveal-line"><span class="text-reveal-inner">' + lineHTML.trim() + '</span></span>';
      }).join('');

      var inners = heading.querySelectorAll('.text-reveal-inner');

      gsap.fromTo(inners,
        { y: '110%' },
        {
          y: '0%',
          duration: 1,
          ease: 'power4.out',
          stagger: 0.15,
          scrollTrigger: {
            trigger: heading,
            start: 'top 85%',
            once: true,
          },
        }
      );
    });
  }

  /* ============================================
     Scroll Progress Bar
     ============================================ */
  function initScrollProgress() {
    var bar = document.getElementById('scrollProgress');
    if (!bar) return;

    window.addEventListener('scroll', function () {
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      var pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      bar.style.width = pct + '%';
    }, { passive: true });
  }

  /* ============================================
     Section Glow Parallax Reveals
     ============================================ */
  function initSectionGlows() {
    if (typeof IntersectionObserver === 'undefined') return;

    // Activate section background glows on scroll entry
    var glowObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, { threshold: 0.2 });

    document.querySelectorAll('.section-bg-glow').forEach(function (el) {
      glowObserver.observe(el);
    });

    // Animate section-line decorators
    var lineObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          lineObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });

    document.querySelectorAll('.section-line').forEach(function (el) {
      lineObserver.observe(el);
    });

    // GSAP scrub-based parallax on glow layers
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined' && !prefersReducedMotion) {
      document.querySelectorAll('.section-bg-glow').forEach(function (el) {
        var section = el.closest('section');
        if (!section) return;
        gsap.fromTo(el,
          { y: 30 },
          {
            y: -30,
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1.5,
            },
          }
        );
      });
    }
  }

  /* ============================================
     Main init – runs after loader
     ============================================ */
  function initAnimations() {
    if (prefersReducedMotion) {
      applyReducedMotionFallback();
      var door = document.getElementById('garageDoor');
      if (door) door.style.display = 'none';
      initLenis();
      initSparkParticles();
      initSectionGlows();
      return;
    }

    initLenis();
    initGarageIntro();
    initScrollAnimations();
    initSparkParticles();
    initScrollHint();
    initTiltCards();
    initTextReveal();
    initSectionGlows();
  }

  /* ============================================
     Booking Form (Supabase)
     ============================================ */
  function initBookingForm() {
    var form = document.getElementById('bookingForm');
    if (!form) return;

    var sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

    // Anti-bot: record when the form was loaded
    var formLoadedAt = Date.now();


    // Cloudflare Turnstile (load only if configured)
    var turnstileToken = '';
    if (CONFIG.TURNSTILE_SITE_KEY) {
      var container = document.getElementById('turnstileContainer');
      if (container) container.style.display = '';
      var script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
      script.async = true;
      document.head.appendChild(script);
      window.onTurnstileLoad = function() {
        if (window.turnstile) {
          window.turnstile.render('#turnstileWidget', {
            sitekey: CONFIG.TURNSTILE_SITE_KEY,
            callback: function(token) { turnstileToken = token; },
            'expired-callback': function() { turnstileToken = ''; },
            theme: 'dark'
          });
        }
      };
    }

    var MONTH_NAMES = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
    var DAY_NAMES = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

    var currentStep = 1;
    var selectedService = null;
    var selectedDate = null;
    var selectedFascia = null;
    var selectedOra = null;
    var isSubmitting = false;
    var calMonth = new Date().getMonth();
    var calYear = new Date().getFullYear();
    var services = [];
    var settings = null;
    var disponibilita = {};
    var giorniChiusi = {};

    var btnNext = document.getElementById('bookBtnNext');
    var btnBack = document.getElementById('bookBtnBack');
    var btnSubmit = document.getElementById('bookBtnSubmit');

    // Load services and settings from Supabase
    function loadData() {
      Promise.all([
        sb.from('servizi').select('*').eq('attivo', true).order('ordine', { ascending: true }),
        sb.from('impostazioni').select('*').eq('id', 1).single()
      ]).then(function(results) {
        if (results[0].data) services = results[0].data;
        if (results[1].data) settings = results[1].data;
        renderServices();
        updateFasciaTimes();
      }).catch(function() {
        // Fallback: show a message
        var opts = document.getElementById('serviceOptions');
        if (opts) opts.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;grid-column:1/-1">Caricamento servizi...</p>';
      });
    }

    function renderServices() {
      var container = document.getElementById('serviceOptions');
      container.innerHTML = '';
      services.forEach(function(svc) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'service-option';
        btn.setAttribute('data-service-id', svc.id);
        btn.innerHTML = '<span class="service-option-radio"></span>' + escapeHtml(svc.nome);
        btn.addEventListener('click', function() {
          document.querySelectorAll('.service-option').forEach(function(el) { el.classList.remove('selected'); });
          btn.classList.add('selected');
          selectedService = svc;
        });
        container.appendChild(btn);
      });
    }

    function updateFasciaTimes() {
      if (!settings) return;
      var mt = document.getElementById('fasciaMattinaTime');
      var pt = document.getElementById('fasciaPomeriggioTime');
      if (mt) mt.textContent = settings.orario_mattina_inizio.slice(0,5) + ' \u2013 ' + settings.orario_mattina_fine.slice(0,5);
      if (pt) pt.textContent = settings.orario_pomeriggio_inizio.slice(0,5) + ' \u2013 ' + settings.orario_pomeriggio_fine.slice(0,5);
    }

    // Calendar
    function loadDisponibilita() {
      var start = new Date(calYear, calMonth, 1);
      var end = new Date(calYear, calMonth + 1, 0);
      var startStr = formatDateISO(start);
      var endStr = formatDateISO(end);

      var pDispo = sb.rpc('get_disponibilita', { data_inizio: startStr, data_fine: endStr });
      var pChiusi = sb.from('giorni_chiusi').select('data, motivo')
        .gte('data', startStr).lte('data', endStr);

      Promise.all([pDispo, pChiusi])
        .then(function(results) {
          disponibilita = {};
          if (results[0].data) {
            results[0].data.forEach(function(r) {
              if (!disponibilita[r.giorno]) disponibilita[r.giorno] = {};
              var slotKey = r.slot_ora ? r.slot_ora.slice(0, 5) : r.fascia;
              disponibilita[r.giorno][slotKey] = parseInt(r.conteggio);
            });
          }
          giorniChiusi = {};
          if (results[1].data) {
            results[1].data.forEach(function(g) {
              giorniChiusi[g.data] = g.motivo || 'Chiuso';
            });
          }
          renderCalendar();
        })
        .catch(function() { renderCalendar(); });
    }

    function renderCalendar() {
      var grid = document.getElementById('bookCalGrid');
      var title = document.getElementById('bookCalTitle');
      title.textContent = MONTH_NAMES[calMonth] + ' ' + calYear;
      grid.innerHTML = '';

      DAY_NAMES.forEach(function(d) {
        var el = document.createElement('div');
        el.className = 'booking-cal-dayheader';
        el.textContent = d;
        grid.appendChild(el);
      });

      var firstDay = new Date(calYear, calMonth, 1);
      var lastDay = new Date(calYear, calMonth + 1, 0);
      var startDow = (firstDay.getDay() + 6) % 7;
      var today = new Date();
      today.setHours(0,0,0,0);

      for (var i = 0; i < startDow; i++) {
        var empty = document.createElement('div');
        empty.className = 'booking-cal-day empty';
        grid.appendChild(empty);
      }

      var duration = settings ? (settings.durata_slot || 30) : 30;
      var mattStartParts = settings ? settings.orario_mattina_inizio.split(':') : ['08','00'];
      var mattEndParts = settings ? settings.orario_mattina_fine.split(':') : ['12','00'];
      var pomStartParts = settings ? settings.orario_pomeriggio_inizio.split(':') : ['14','00'];
      var pomEndParts = settings ? settings.orario_pomeriggio_fine.split(':') : ['18','00'];
      var allMattSlots = generateTimeSlots(parseInt(mattStartParts[0]), parseInt(mattStartParts[1]), parseInt(mattEndParts[0]), parseInt(mattEndParts[1]), duration);
      var allPomSlots = generateTimeSlots(parseInt(pomStartParts[0]), parseInt(pomStartParts[1]), parseInt(pomEndParts[0]), parseInt(pomEndParts[1]), duration);

      for (var d = 1; d <= lastDay.getDate(); d++) {
        var date = new Date(calYear, calMonth, d);
        var dateStr = formatDateISO(date);
        var dow = (date.getDay() + 6) % 7; // 0=Mon, 6=Sun
        var isSunday = dow === 6;
        var isSaturday = dow === 5;
        var isPast = date < today;

        var cell = document.createElement('div');
        cell.className = 'booking-cal-day';
        cell.textContent = d;

        var isChiuso = !!giorniChiusi[dateStr];
        var dayDisabled = isPast || isSunday || isChiuso;
        if (settings && isSunday && settings.domenica_aperto) dayDisabled = isPast || isChiuso;
        if (settings && !settings.sabato_aperto && isSaturday) dayDisabled = true;

        // Check if all slots are booked
        var dispo = disponibilita[dateStr] || {};
        var onlyMorning = (isSaturday && settings && settings.sabato_solo_mattina) || (isSunday && settings && settings.domenica_solo_mattina);
        var slotsToCheck = onlyMorning ? allMattSlots : allMattSlots.concat(allPomSlots);
        var allFull = slotsToCheck.length > 0 && slotsToCheck.every(function(s) { return dispo[s] && dispo[s] >= 1; });
        if (allFull && !isPast && !isSunday && !isChiuso) dayDisabled = true;

        if (dayDisabled) {
          cell.classList.add('disabled');
          if (isChiuso) {
            cell.classList.add('chiuso');
            cell.title = giorniChiusi[dateStr];
          }
          if (allFull && !isPast && !isSunday && !isChiuso) cell.classList.add('full');
        } else {
          cell.classList.add('available');
          cell.setAttribute('data-date', dateStr);
          cell.addEventListener('click', function() {
            var dt = this.getAttribute('data-date');
            selectedDate = dt;
            selectedFascia = null;
            selectedOra = null;
            document.querySelectorAll('.booking-cal-day').forEach(function(el) { el.classList.remove('selected'); });
            this.classList.add('selected');
            showSlotSelector(dt);
          });
        }

        if (dateStr === formatDateISO(today)) cell.classList.add('today');
        if (selectedDate === dateStr) cell.classList.add('selected');

        grid.appendChild(cell);
      }
    }

    function generateTimeSlots(startH, startM, endH, endM, duration) {
      var slots = [];
      var h = startH, m = startM;
      while (h < endH || (h === endH && m < endM)) {
        var timeStr = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        slots.push(timeStr);
        m += duration;
        if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
      }
      return slots;
    }

    function showSlotSelector(dateStr) {
      var selector = document.getElementById('slotSelector');
      selector.style.display = 'block';

      var date = new Date(dateStr);
      var dow = (date.getDay() + 6) % 7;
      var isSaturday = dow === 5;
      var isSunday = dow === 6;
      var duration = settings ? (settings.durata_slot || 30) : 30;

      // Check if this is today (to disable past time slots)
      var now = new Date();
      var todayStr = formatDateISO(now);
      var isToday = dateStr === todayStr;
      var currentHour = now.getHours();
      var currentMin = now.getMinutes();

      // Parse times
      var mattStart = settings ? settings.orario_mattina_inizio.split(':') : ['08','00'];
      var mattEnd = settings ? settings.orario_mattina_fine.split(':') : ['12','00'];
      var pomStart = settings ? settings.orario_pomeriggio_inizio.split(':') : ['14','00'];
      var pomEnd = settings ? settings.orario_pomeriggio_fine.split(':') : ['18','00'];

      var mattSlots = generateTimeSlots(parseInt(mattStart[0]), parseInt(mattStart[1]), parseInt(mattEnd[0]), parseInt(mattEnd[1]), duration);
      var pomSlots = generateTimeSlots(parseInt(pomStart[0]), parseInt(pomStart[1]), parseInt(pomEnd[0]), parseInt(pomEnd[1]), duration);

      // Get booked slots for this date
      var dispo = disponibilita[dateStr] || {};
      var bookedSlots = {};
      Object.keys(dispo).forEach(function(key) {
        bookedSlots[key] = dispo[key];
      });

      // Render morning slots
      var gridMatt = document.getElementById('slotGridMattina');
      gridMatt.innerHTML = '';
      mattSlots.forEach(function(time) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'slot-btn';
        btn.textContent = time;
        btn.setAttribute('data-time', time);
        btn.setAttribute('data-fascia', 'mattina');

        var slotParts = time.split(':');
        var slotH = parseInt(slotParts[0]);
        var slotM = parseInt(slotParts[1]);
        var isPastSlot = isToday && (slotH < currentHour || (slotH === currentHour && slotM <= currentMin));

        if (isPastSlot || (bookedSlots[time] && bookedSlots[time] >= 1)) {
          btn.classList.add('disabled');
        } else {
          btn.addEventListener('click', function() { selectSlot(this); });
        }

        if (selectedOra === time) btn.classList.add('selected');
        gridMatt.appendChild(btn);
      });

      // Render afternoon slots
      var gridPom = document.getElementById('slotGridPomeriggio');
      var pomTitle = document.getElementById('slotPomeriggioTitle');
      gridPom.innerHTML = '';

      var hidePomeriggio = (isSaturday && settings && settings.sabato_solo_mattina) || (isSunday && settings && settings.domenica_solo_mattina);
      if (hidePomeriggio) {
        pomTitle.style.display = 'none';
        gridPom.style.display = 'none';
      } else {
        pomTitle.style.display = '';
        gridPom.style.display = '';
        pomSlots.forEach(function(time) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'slot-btn';
          btn.textContent = time;
          btn.setAttribute('data-time', time);
          btn.setAttribute('data-fascia', 'pomeriggio');

          var slotParts = time.split(':');
          var slotH = parseInt(slotParts[0]);
          var slotM = parseInt(slotParts[1]);
          var isPastSlot = isToday && (slotH < currentHour || (slotH === currentHour && slotM <= currentMin));

          if (isPastSlot || (bookedSlots[time] && bookedSlots[time] >= 1)) {
            btn.classList.add('disabled');
          } else {
            btn.addEventListener('click', function() { selectSlot(this); });
          }

          if (selectedOra === time) btn.classList.add('selected');
          gridPom.appendChild(btn);
        });
      }
    }

    function selectSlot(btn) {
      document.querySelectorAll('.slot-btn').forEach(function(b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      selectedOra = btn.getAttribute('data-time');
      selectedFascia = btn.getAttribute('data-fascia');
    }

    // Calendar nav (bounded: current month to 3 months ahead)
    document.getElementById('bookCalPrev').addEventListener('click', function() {
      var now = new Date();
      if (calYear === now.getFullYear() && calMonth === now.getMonth()) return;
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      loadDisponibilita();
    });
    document.getElementById('bookCalNext').addEventListener('click', function() {
      var maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + 3);
      if (calYear > maxDate.getFullYear() || (calYear === maxDate.getFullYear() && calMonth >= maxDate.getMonth())) return;
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      loadDisponibilita();
    });

    // Step navigation
    function goToStep(step) {
      currentStep = step;
      document.querySelectorAll('.booking-panel').forEach(function(p) { p.classList.remove('active'); });
      document.getElementById('bookingStep' + step).classList.add('active');

      document.querySelectorAll('.booking-step').forEach(function(s) {
        var sNum = parseInt(s.getAttribute('data-step'));
        s.classList.remove('active', 'done');
        if (sNum === step) s.classList.add('active');
        if (sNum < step) s.classList.add('done');
      });

      btnBack.style.display = step > 1 ? '' : 'none';
      btnNext.style.display = step < 3 ? '' : 'none';
      btnSubmit.style.display = step === 3 ? '' : 'none';

      if (step === 2) loadDisponibilita();
    }

    function shakeElement(el) {
      el.classList.add('shake');
      el.addEventListener('animationend', function() {
        el.classList.remove('shake');
      }, { once: true });
    }

    function flashValidation(selector) {
      document.querySelectorAll(selector).forEach(function(el) {
        el.classList.add('validation-highlight');
        setTimeout(function() { el.classList.remove('validation-highlight'); }, 1500);
      });
    }

    btnNext.addEventListener('click', function() {
      if (currentStep === 1) {
        if (!selectedService) {
          shakeElement(btnNext);
          flashValidation('.service-option');
          return;
        }
        goToStep(2);
      } else if (currentStep === 2) {
        if (!selectedDate || !selectedOra) {
          shakeElement(btnNext);
          if (!selectedDate) {
            flashValidation('.booking-calendar');
          } else if (!selectedOra) {
            flashValidation('.slot-selector');
          }
          return;
        }
        goToStep(3);
      }
    });

    btnBack.addEventListener('click', function() {
      if (currentStep > 1) goToStep(currentStep - 1);
    });

    // Submit
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      if (isSubmitting) return;

      var nome = document.getElementById('bookNome').value.trim();
      var email = document.getElementById('bookEmail').value.trim();
      var telefono = document.getElementById('bookTelefono').value.trim();
      var auto = document.getElementById('bookAuto').value.trim();
      var kmAuto = document.getElementById('bookKmAuto').value.trim();
      var note = document.getElementById('bookNote').value.trim();
      var consent = document.getElementById('bookConsent').checked;

      if (!consent) {
        alert('Devi acconsentire al trattamento dei dati personali per procedere.');
        return;
      }

      if (!nome || !email || !auto || !selectedService || !selectedDate || !selectedOra) return;

      // Controlla che la data non sia nel passato (tab aperta a lungo)
      var now = new Date();
      now.setHours(0,0,0,0);
      if (new Date(selectedDate) < now) {
        alert('La data selezionata non e\' piu\' disponibile. Scegli un\'altra data.');
        goToStep(2);
        return;
      }

      // Validazione email
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        alert('Inserisci un indirizzo email valido.');
        return;
      }

      // Validazione telefono (se inserito)
      if (telefono) {
        var telClean = telefono.replace(/[\s\-\.]/g, '');
        if (!/^\+?[0-9]{8,15}$/.test(telClean)) {
          alert('Inserisci un numero di telefono valido.');
          return;
        }
      }

      // Anti-bot: honeypot check
      var honeypot = document.getElementById('bookWebsite');
      if (honeypot && honeypot.value) {
        // Bot detected — show fake success
        form.style.display = 'none';
        document.querySelector('.booking-steps').style.display = 'none';
        document.getElementById('bookingSuccess').style.display = 'block';
        return;
      }


      // Turnstile check (if configured)
      if (CONFIG.TURNSTILE_SITE_KEY && !turnstileToken) {
        alert('Attendi il completamento della verifica anti-bot e riprova.');
        return;
      }

      isSubmitting = true;
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Invio in corso...';

      sb.functions.invoke('create-booking', {
        body: {
          servizio_id: selectedService.id,
          nome: nome,
          email: email,
          telefono: telefono || null,
          auto: auto,
          km_auto: kmAuto || null,
          note: note || null,
          data: selectedDate,
          fascia_oraria: selectedFascia,
          ora: selectedOra + ':00',
          cf_turnstile_token: turnstileToken || '',
          _hp_website: (honeypot && honeypot.value) || '',
          _form_loaded_at: formLoadedAt,
          service_name: selectedService.nome,
          business_name: CONFIG.BUSINESS_NAME,
          business_phone: CONFIG.BUSINESS_PHONE,
          business_address: CONFIG.BUSINESS_ADDRESS
        }
      }).then(function(res) {
        if (res.error) throw res.error;
        if (res.data && res.data.error) throw new Error(res.data.error);

        // Show success
        form.style.display = 'none';
        document.querySelector('.booking-steps').style.display = 'none';
        document.getElementById('bookingSuccess').style.display = 'block';
      }).catch(function(err) {
        console.error('Booking error:', err);
        isSubmitting = false;
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Conferma Prenotazione';
        var msg = (err && err.message) || '';
        if (msg.indexOf('gia una prenotazione') !== -1) {
          alert('Hai gia\' una prenotazione per questa data. Contattaci per modificarla.');
        } else if (msg.indexOf('Slot non disponibile') !== -1) {
          alert('Questo slot non e\' piu\' disponibile. Prova un altro orario.');
        } else if (msg.indexOf('Giorno chiuso') !== -1) {
          alert('L\'officina e\' chiusa in questa data. Scegli un altro giorno.');
        } else if (msg.indexOf('troppo veloce') !== -1) {
          alert('Invio troppo veloce. Riprova tra qualche secondo.');
        } else if (msg.indexOf('anti-bot') !== -1) {
          alert('Verifica anti-bot fallita. Ricarica la pagina e riprova.');
        } else {
          alert(msg || 'Si e\' verificato un errore. Riprova o contattaci telefonicamente.');
        }
      });
    });

    // New booking button
    document.getElementById('bookBtnNew').addEventListener('click', function() {
      form.style.display = '';
      document.querySelector('.booking-steps').style.display = 'flex';
      document.getElementById('bookingSuccess').style.display = 'none';
      isSubmitting = false;
      formLoadedAt = Date.now(); // Reset timing for new booking
      selectedService = null;
      selectedDate = null;
      selectedFascia = null;
      selectedOra = null;
      document.querySelectorAll('.service-option').forEach(function(el) { el.classList.remove('selected'); });
      document.getElementById('slotSelector').style.display = 'none';
      document.getElementById('bookNome').value = '';
      document.getElementById('bookEmail').value = '';
      document.getElementById('bookTelefono').value = '';
      document.getElementById('bookAuto').value = '';
      document.getElementById('bookNote').value = '';
      document.getElementById('bookConsent').checked = false;
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Conferma Prenotazione';
      goToStep(1);
    });

    // Utilities
    function formatDateISO(d) {
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    }

    function escapeHtml(s) {
      if (!s) return '';
      var div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    }

    // Blocca lettere nel campo telefono
    var telInput = document.getElementById('bookTelefono');
    if (telInput) {
      telInput.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9\s\+\-]/g, '');
      });
    }

    // Init
    loadData();
  }

  /* ============================================
     Cookie Consent
     ============================================ */
  var COOKIE_KEY = 'cg_cookie_consent';

  function getCookieConsent() {
    try {
      var raw = localStorage.getItem(COOKIE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveCookieConsent(prefs) {
    localStorage.setItem(COOKIE_KEY, JSON.stringify(prefs));
  }

  function loadGoogleFonts() {
    if (document.getElementById('googleFontsLink')) return;
    var preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(preconnect1);

    var preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect2);

    var link = document.createElement('link');
    link.id = 'googleFontsLink';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&family=Dancing+Script:wght@700&display=swap';
    document.head.appendChild(link);

    // Wait for fonts to actually load before removing fallback styles
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        document.body.classList.remove('fonts-blocked');
      });
    } else {
      // Fallback for older browsers: wait a bit for fonts to download
      setTimeout(function () {
        document.body.classList.remove('fonts-blocked');
      }, 1000);
    }
  }

  var GA_MEASUREMENT_ID = 'G-YLNSV8KYR0';

  function loadGoogleAnalytics() {
    if (window.gtag || document.getElementById('gaScript')) return;

    var script = document.createElement('script');
    script.id = 'gaScript';
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });
  }

  function loadGoogleMaps() {
    var container = document.getElementById('mapEmbed');
    var placeholder = document.getElementById('mapPlaceholder');
    if (!container || !placeholder) return;

    var src = container.getAttribute('data-map-src');
    if (!src) return;

    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.width = '100%';
    iframe.height = '350';
    iframe.style.cssText = 'border:0; border-radius:12px; filter: grayscale(0.8) contrast(1.1) brightness(0.7);';
    iframe.allowFullscreen = true;
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.title = 'Posizione Control Garage su Google Maps';

    placeholder.style.display = 'none';
    container.appendChild(iframe);
  }

  function showCookieBanner() {
    var banner = document.getElementById('cookieBanner');
    if (!banner) return;

    var consent = getCookieConsent();
    var fontsToggle = document.getElementById('cookieToggleFonts');
    var mapsToggle = document.getElementById('cookieToggleMaps');
    var analyticsToggle = document.getElementById('cookieToggleAnalytics');
    if (fontsToggle && consent) fontsToggle.checked = consent.functional;
    if (mapsToggle && consent) mapsToggle.checked = consent.maps;
    if (analyticsToggle && consent) analyticsToggle.checked = consent.analytics;

    banner.setAttribute('aria-hidden', 'false');
    // Force reflow before adding class for transition
    banner.offsetHeight;
    banner.classList.add('visible');
  }

  function hideCookieBanner() {
    var banner = document.getElementById('cookieBanner');
    if (!banner) return;
    banner.classList.remove('visible');
    banner.setAttribute('aria-hidden', 'true');
  }

  function applyCookieConsent(prefs) {
    saveCookieConsent(prefs);
    hideCookieBanner();

    if (prefs.functional) {
      loadGoogleFonts();
    } else {
      document.body.classList.add('fonts-blocked');
    }

    if (prefs.maps) {
      loadGoogleMaps();
    }

    if (prefs.analytics) {
      loadGoogleAnalytics();
    }
  }

  function initCookieConsent() {
    var banner = document.getElementById('cookieBanner');
    if (!banner) return;

    var consent = getCookieConsent();

    // If consent already given, apply it silently
    if (consent) {
      if (consent.functional) loadGoogleFonts();
      else document.body.classList.add('fonts-blocked');
      if (consent.maps) loadGoogleMaps();
      if (consent.analytics) loadGoogleAnalytics();
      return;
    }

    // No consent yet – block fonts and show banner
    document.body.classList.add('fonts-blocked');

    // Show banner after a short delay so page renders first
    setTimeout(function () {
      showCookieBanner();
    }, 800);

    // Accept all
    document.getElementById('cookieAcceptAll').addEventListener('click', function () {
      applyCookieConsent({ necessary: true, functional: true, maps: true, analytics: true });
    });

    // Reject all
    document.getElementById('cookieRejectAll').addEventListener('click', function () {
      applyCookieConsent({ necessary: true, functional: false, maps: false, analytics: false });
    });

    // Customize toggle
    var details = document.getElementById('cookieDetails');
    document.getElementById('cookieCustomize').addEventListener('click', function () {
      details.style.display = details.style.display === 'none' ? 'block' : 'none';
    });

    // Save preferences
    document.getElementById('cookieSavePrefs').addEventListener('click', function () {
      var fontsChecked = document.getElementById('cookieToggleFonts').checked;
      var mapsChecked = document.getElementById('cookieToggleMaps').checked;
      var analyticsChecked = document.getElementById('cookieToggleAnalytics').checked;
      applyCookieConsent({ necessary: true, functional: fontsChecked, maps: mapsChecked, analytics: analyticsChecked });
    });
  }

  // Expose for footer link and map placeholder button
  window.CookieConsent = {
    show: function () {
      showCookieBanner();
    }
  };

  /* ============================================
     Bootstrap
     ============================================ */
  onReady(function () {
    initCookieConsent();
    initNavbar();
    initMobileNav();
    initAnchorLinks();
    initCustomCursor();
    initMagneticButtons();
    initScrollProgress();
    initBookingForm();
    initAnimations();
  });

})();
