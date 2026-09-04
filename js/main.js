/* ===================================
   ЮС 812 — Ювелирная студия
   Главный JavaScript-файл
   =================================== */

document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // ===== Mobile Menu =====
    const burger = document.getElementById('burger');
    const nav = document.getElementById('nav');

    if (burger && nav) {
        burger.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = burger.classList.contains('active');
            burger.classList.toggle('active');
            nav.classList.toggle('active');
            document.body.classList.toggle('body--menu-open');
            console.log('Menu toggled, nav active:', nav.classList.contains('active'));
        });

        // Close menu on link click
        const navLinks = nav.querySelectorAll('.header__link');
        navLinks.forEach(function(link) {
            link.addEventListener('click', function(e) {
                e.stopPropagation();
                burger.classList.remove('active');
                nav.classList.remove('active');
                document.body.classList.remove('body--menu-open');
                console.log('Link clicked, menu closing');
            });
        });
        
        // Close menu when clicking on the gap between header and nav (on the body)
        // But NOT when clicking on the nav itself
        document.body.addEventListener('click', function(e) {
            if (nav.classList.contains('active')) {
                if (!nav.contains(e.target) && !burger.contains(e.target)) {
                    burger.classList.remove('active');
                    nav.classList.remove('active');
                    document.body.classList.remove('body--menu-open');
                    console.log('Menu closed by body click');
                }
            }
        });
        
        // Close menu on window resize (if desktop)
        window.addEventListener('resize', function() {
            if (window.innerWidth >= 768) {
                burger.classList.remove('active');
                nav.classList.remove('active');
                document.body.classList.remove('body--menu-open');
            }
        });
    }

    // ===== Cookie Banner =====
    const cookieBanner = document.getElementById('cookieBanner');
    const acceptCookies = document.getElementById('acceptCookies');
    
    // Check if user already accepted cookies
    if (!localStorage.getItem('cookiesAccepted')) {
        // Show cookie banner after a short delay
        setTimeout(function() {
            if (cookieBanner) {
                cookieBanner.classList.add('visible');
            }
        }, 1000);
    }
    
    // Accept cookies
    if (acceptCookies) {
        acceptCookies.addEventListener('click', function() {
            localStorage.setItem('cookiesAccepted', 'true');
            if (cookieBanner) {
                cookieBanner.classList.remove('visible');
            }
            console.log('Cookies accepted');
            
            // Here you can enable Yandex.Metrika if it was disabled
            // enableMetrika();
        });
    }
    
    // ===== Smooth Scroll =====
    const scrollButtons = document.querySelectorAll('[data-scroll]');
    scrollButtons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-scroll');
            const target = document.getElementById(targetId);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // ===== Header Scroll Effect =====
    const header = document.getElementById('header');
    let lastScroll = 0;

    window.addEventListener('scroll', function() {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        lastScroll = currentScroll;
    });

    // ===== Form Handling =====
    const form = document.getElementById('contactForm');
    const modal = document.getElementById('successModal');
    const modalClose = document.getElementById('modalClose');

    if (form && modal) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form values
            const name = document.getElementById('name').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const message = document.getElementById('message').value.trim();
            const consent = document.getElementById('consent').checked;
            
            // Validate
            if (!name || !phone) {
                alert('Пожалуйста, заполните все обязательные поля');
                return;
            }
            
            if (!consent) {
                alert('Необходимо дать согласие на обработку персональных данных');
                return;
            }
            
            // Phone validation (simple)
            const phoneRegex = /[\+]?[0-9\s\-\(\)]{7,}/;
            if (!phoneRegex.test(phone)) {
                alert('Пожалуйста, введите корректный номер телефона');
                return;
            }
            
            // Here you would normally send the form data to your server
            // For now, we'll just show the success modal
            console.log('Form submitted:', {
                name: name,
                phone: phone,
                message: message
            });
            
            // Show success modal
            modal.classList.add('active');
            
            // Reset form
            form.reset();
        });
        
        // Close modal
        if (modalClose) {
            modalClose.addEventListener('click', function() {
                modal.classList.remove('active');
            });
        }
        
        // Close modal on outside click
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
        
        // Close modal on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                modal.classList.remove('active');
            }
        });
    }

    // ===== Scroll Animations =====
    const animateElements = document.querySelectorAll('.benefit-card, .service-card, .portfolio__item, .step, .review-card');
    
    function checkScroll() {
        const triggerBottom = window.innerHeight * 0.8;
        
        animateElements.forEach(function(element) {
            const elementTop = element.getBoundingClientRect().top;
            
            if (elementTop < triggerBottom) {
                element.classList.add('animated');
            }
        });
    }
    
    // Add animation class initially
    animateElements.forEach(function(el, index) {
        el.style.transitionDelay = (index % 4) * 0.1 + 's';
        el.classList.add('animate-on-scroll');
    });
    
    // Check on load and scroll
    checkScroll();
    window.addEventListener('scroll', checkScroll);

    // ===== Phone Mask (Simple) =====
    const phoneInput = document.getElementById('phone');
    
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            
            if (value.length > 0) {
                if (value[0] === '7' || value[0] === '8') {
                    value = value.substring(1);
                }
                
                let formattedValue = '+7';
                
                if (value.length > 0) {
                    formattedValue += ' (' + value.substring(0, 3);
                }
                
                if (value.length >= 3) {
                    formattedValue += ') ' + value.substring(3, 6);
                }
                
                if (value.length >= 6) {
                    formattedValue += '-' + value.substring(6, 8);
                }
                
                if (value.length >= 8) {
                    formattedValue += '-' + value.substring(8, 10);
                }
                
                e.target.value = formattedValue;
            }
        });
    }

    // ===== Lazy Loading Images (if needed) =====
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        images.forEach(function(img) {
            imageObserver.observe(img);
        });
    } else {
        // Fallback for browsers without IntersectionObserver
        images.forEach(function(img) {
            img.src = img.dataset.src;
        });
    }

    // ===== Counter Animation =====
    function animateCounter(element, target, duration) {
        let start = 0;
        const increment = target / (duration / 16);
        
        function step() {
            start += increment;
            if (start < target) {
                element.textContent = Math.floor(start);
                requestAnimationFrame(step);
            } else {
                element.textContent = target;
            }
        }
        
        step();
    }

    // Observe hero features for counter animation
    const heroFeatures = document.querySelectorAll('.hero__feature-number');
    
    if ('IntersectionObserver' in window) {
        const featureObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    // Add animation class
                    entry.target.style.opacity = '1';
                    featureObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        
        heroFeatures.forEach(function(feature) {
            feature.style.opacity = '0';
            feature.style.transition = 'opacity 0.5s ease';
            featureObserver.observe(feature);
        });
    }

    console.log('ЮС 812 — Ювелирная студия. Сайт загружен успешно.');
});