/* ===================================
   ЮС 812 — Ювелирная студия
   Главный JavaScript-файл
   =================================== */

document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // ===== Yandex.Metrika: цели =====
    // Метрика грузится асинхронно, поэтому проверка window.ym обязательна:
    // если счётчик ещё не поднялся (или заблокирован adblock'ом) — молча пропускаем.
    const METRIKA_ID = 112416476;

    function ymGoal(goal) {
        try {
            if (typeof window.ym === 'function') {
                window.ym(METRIKA_ID, 'reachGoal', goal);
            }
        } catch (err) {
            // счётчик недоступен — на UI не влияет
        }
    }

    // Сквозной трекинг контактов и мессенджеров. Делегирование нужно затем,
    // чтобы цели считались и с кнопок вне формы: шапка, sticky-панель, футер, модалка.
    const LINK_GOALS = [
        ['a[href^="tel:"]', 'phone_click'],
        ['a[href^="mailto:"]', 'email_click'],
        ['a[href*="vk.com"]', 'vk_click'],
        ['a[href*="wa.me"]', 'whatsapp_click'],
        ['a[href*="t.me"]', 'telegram_click']
    ];

    document.addEventListener('click', function(e) {
        const link = e.target && e.target.closest ? e.target.closest('a') : null;
        if (!link) return;
        for (let i = 0; i < LINK_GOALS.length; i++) {
            if (link.matches(LINK_GOALS[i][0])) {
                ymGoal(LINK_GOALS[i][1]);
                return;
            }
        }
    });

    // Цели с кнопок/ссылок, размеченных data-goal (основной и вторичный CTA Hero).
    // Отдельный обработчик, а не расширение LINK_GOALS: primary CTA — это button
    // со скроллом к форме, он не попадает под селекторы ссылок выше.
    // calc_click продолжит считаться параллельно — старая воронка не ломается.
    document.addEventListener('click', function(e) {
        const el = e.target && e.target.closest ? e.target.closest('[data-goal]') : null;
        if (!el) return;
        const goal = el.getAttribute('data-goal');
        if (goal) ymGoal(goal);
    });

    // ===== UTM (first-touch) =====
    // Метки сохраняются в sessionStorage и подставляются в скрытые поля формы:
    // в письме Web3Forms видно, из какой кампании пришёл лид.
    const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    let utmStore = {};

    try {
        utmStore = JSON.parse(sessionStorage.getItem('us812_utm') || '{}');
        const params = new URLSearchParams(window.location.search);
        let utmChanged = false;
        UTM_KEYS.forEach(function(key) {
            const value = params.get(key);
            // first-touch: значение с URL пишется только если метка ещё пустая
            if (value && !utmStore[key]) {
                utmStore[key] = value;
                utmChanged = true;
            }
        });
        if (utmChanged) sessionStorage.setItem('us812_utm', JSON.stringify(utmStore));
    } catch (err) {
        utmStore = {};
    }

    function applyUtmToForm(formEl) {
        UTM_KEYS.forEach(function(key) {
            if (!utmStore[key]) return;
            let field = formEl.querySelector('input[name="' + key + '"]');
            if (!field) {
                field = document.createElement('input');
                field.type = 'hidden';
                field.name = key;
                formEl.appendChild(field);
            }
            field.value = utmStore[key];
        });
    }

    // ===== Mobile Menu =====
    const burger = document.getElementById('burger');
    const nav = document.getElementById('nav');

    if (burger && nav) {
        burger.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = burger.classList.contains('active');
            burger.classList.toggle('active');
            nav.classList.toggle('active');
            console.log('Menu toggled, nav active:', nav.classList.contains('active'));
        });

        // Close menu on link click
        const navLinks = nav.querySelectorAll('.header__link');
        navLinks.forEach(function(link) {
            link.addEventListener('click', function(e) {
                e.stopPropagation();
                burger.classList.remove('active');
                nav.classList.remove('active');
                console.log('Link clicked, menu closing');
            });
        });
        
        // Close menu when clicking outside
        document.body.addEventListener('click', function(e) {
            if (nav.classList.contains('active')) {
                if (!nav.contains(e.target) && !burger.contains(e.target)) {
                    burger.classList.remove('active');
                    nav.classList.remove('active');
                    console.log('Menu closed by body click');
                }
            }
        });
        
        // Close menu on window resize (if desktop)
        // 1024, а не 768: горизонтальное меню включается с 1024px (см. css/style.css)
        window.addEventListener('resize', function() {
            if (window.innerWidth >= 1024) {
                burger.classList.remove('active');
                nav.classList.remove('active');
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
    
    // ===== Sticky CTA (mobile) =====
    // Показ после ~1 экрана скролла, скрытие пока секция #form в вьюпорте.
    // Конфликт с cookie-баннером: панель поднимается на его высоту,
    // отслеживается через MutationObserver (баннер показывается с задержкой).
    const stickyCta = document.getElementById('stickyCta');

    if (stickyCta) {
        let formInView = false;
        let stickyTicking = false;

        function updateStickyCtaVisibility() {
            // На десктопе панель скрыта через CSS
            if (window.innerWidth >= 768) {
                stickyCta.classList.remove('visible');
                return;
            }
            const scrolledEnough = window.pageYOffset > window.innerHeight * 0.8;
            stickyCta.classList.toggle('visible', scrolledEnough && !formInView);
        }

        function updateStickyCtaOffset() {
            if (!cookieBanner) return;
            const offset = cookieBanner.classList.contains('visible') ? cookieBanner.offsetHeight : 0;
            stickyCta.style.setProperty('--sticky-cta-offset', offset + 'px');
        }

        // Скрытие у секции формы заявки
        const formSection = document.getElementById('form');
        if (formSection && 'IntersectionObserver' in window) {
            const formCtaObserver = new IntersectionObserver(function(entries) {
                formInView = entries[0].isIntersecting;
                updateStickyCtaVisibility();
            }, { threshold: 0.2 });
            formCtaObserver.observe(formSection);
        }

        // Показ по скроллу (throttle через requestAnimationFrame)
        window.addEventListener('scroll', function() {
            if (!stickyTicking) {
                window.requestAnimationFrame(function() {
                    updateStickyCtaVisibility();
                    stickyTicking = false;
                });
                stickyTicking = true;
            }
        });

        // Высота cookie-баннера меняется при показе/скрытии
        if (cookieBanner && 'MutationObserver' in window) {
            const cookieCtaObserver = new MutationObserver(updateStickyCtaOffset);
            cookieCtaObserver.observe(cookieBanner, { attributes: true, attributeFilter: ['class'] });
        }
        window.addEventListener('resize', function() {
            updateStickyCtaOffset();
            updateStickyCtaVisibility();
        });

        // Начальное состояние (например, перезагрузка со скроллом)
        updateStickyCtaVisibility();
    }

    // ===== Smooth Scroll =====
    const scrollButtons = document.querySelectorAll('[data-scroll]');
    scrollButtons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-scroll');
            const target = document.getElementById(targetId);
            // Клик по «Рассчитать стоимость» — микро-цель: показывает, какие кнопки
            // реально доводят до формы, а какие только уводят по странице.
            if (targetId === 'form') ymGoal('calc_click');
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
        // Микро-цель «начал заполнять» — нужен, чтобы видеть в воронке,
        // на каком шаге форма теряёт заявки (показ только при скролле к форме — ложь).
        let formStarted = false;
        form.addEventListener('focusin', function() {
            if (formStarted) return;
            formStarted = true;
            ymGoal('form_start');
        });

        // Set custom validation messages
        const nameInput = document.getElementById('name');
        const phoneInput = document.getElementById('phone');
        
        if (nameInput) {
            nameInput.setCustomValidity('');
            nameInput.addEventListener('input', function() {
                this.setCustomValidity('');
            });
        }
        
        if (phoneInput) {
            phoneInput.setCustomValidity('');
            phoneInput.addEventListener('input', function() {
                this.setCustomValidity('');
            });
        }
        
        // Отправка заявки на email через Web3Forms (GitHub Pages не имеет бэкенда).
        // mode:'no-cors' здесь сознательно НЕ ставим: в этом режиме промис резолвится
        // на любом HTTP-ответе, и «отказ сервиса» было не отличить от успеха — заявка
        // молча терялась, а клиент видел «отправлено». Читаем статус и data.success.
        let submitting = false;

        form.addEventListener('submit', function(e) {
            e.preventDefault();

            // Защита от двойного отправления (Enter в поле до блокировки кнопки)
            if (submitting) return;

            // Get form values
            const name = document.getElementById('name').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const consent = document.getElementById('consent').checked;

            // Validate name
            if (!name) {
                alert('Пожалуйста, введите ваше имя');
                document.getElementById('name').focus();
                return;
            }

            // Validate phone
            if (!phone) {
                alert('Пожалуйста, введите номер телефона');
                document.getElementById('phone').focus();
                return;
            }

            // Phone validation (simple)
            const phoneRegex = /[\+]?[0-9\s\-\(\)]{7,}/;
            if (!phoneRegex.test(phone)) {
                alert('Пожалуйста, введите корректный номер телефона');
                document.getElementById('phone').focus();
                return;
            }

            // Validate consent
            if (!consent) {
                alert('Необходимо дать согласие на обработку персональных данных');
                return;
            }

            // Поле-ссылка на фото референса (необязательное). Поле в HTML — type="text":
            // нативная валидация type="url" блокирует сабмит ДО submit-события, и эта
            // нормализация не успевала выполниться (живой тест 12.09.2026: «Введите URL»
            // на «vk.com/album123»). Клиенты часто пишут адрес без схемы — если её нет,
            // молча дописываем https://, иначе форма отбивает заявку из-за необязательного поля.
            const photoLinkInput = document.getElementById('photoLink');
            if (photoLinkInput) {
                let link = photoLinkInput.value.trim();
                if (link && !/^https?:\/\//i.test(link)) {
                    link = 'https://' + link;
                    photoLinkInput.value = link;
                }
            }

            applyUtmToForm(form);

            const submitBtn = form.querySelector('button[type="submit"]');
            const formError = document.getElementById('formError');
            const originalBtnText = submitBtn.textContent;

            submitting = true;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Отправка...';
            if (formError) formError.hidden = true;

            // Возврат кнопки в исходное состояние — в любой ветке исхода
            function resetSubmitState() {
                submitting = false;
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }

            fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: { 'Accept': 'application/json' }
            })
                .then(function(response) {
                    // Тело может быть не-JSON (502 от прокси, пустой ответ) —
                    // не роняем цепочку, статус всё равно проверим ниже.
                    return response.json()
                        .catch(function() { return {}; })
                        .then(function(data) {
                            return {
                                ok: response.ok,
                                status: response.status,
                                data: data,
                                // Запасной признак успеха: поле redirect Web3Forms
                                // подставляет только при успешной приёме заявки. Если
                                // нас редирекнуло на our thanks.html, а JSON не читнулся,
                                // заявка всё равно принята — иначе клиент увидел бы
                                // «ошибка» после реально ушедшего письма.
                                onThanksPage: response.redirected === true &&
                                    String(response.url || '').indexOf('/thanks.html') !== -1
                            };
                        });
                })
                .then(function(result) {
                    if (!result.ok || !((result.data || {}).success === true || result.onThanksPage)) {
                        throw new Error('HTTP ' + result.status + ' — ' +
                            ((result.data && result.data.message) || 'сервис не принял заявку'));
                    }

                    // Успех подтверждён сервисом: только здесь ставим макро-цель
                    // и показываем модалку. Без искусственных задержек.
                    ymGoal('lead_form');
                    form.reset();
                    resetSubmitState();
                    modal.classList.add('active');
                })
                .catch(function(error) {
                    // Сетевая ошибка, таймаут, не-2xx или success:false —
                    // заявка НЕ отправлена: говорим правду и даём прямые каналы.
                    console.error('Form submit error:', error);
                    resetSubmitState();
                    if (formError) formError.hidden = false;
                });
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

    // Блок цифр в Hero («30 лет / 1000+ / 1 год») убран из разметки 12.09.2026:
    // он дублировал секцию «Почему выбирают нас» и раздувал первый экран.
    // Вместе с ним убраны счётчик-анимация и IntersectionObserver для этих цифр.

    // ===== FAQ Accordion =====
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(function(item) {
        const question = item.querySelector('.faq-item__question');
        if (!question) return;

        question.addEventListener('click', function() {
            const isOpen = item.classList.contains('active');

            // Close all other items
            faqItems.forEach(function(other) {
                other.classList.remove('active');
                const q = other.querySelector('.faq-item__question');
                if (q) q.setAttribute('aria-expanded', 'false');
            });

            // Toggle current
            if (!isOpen) {
                item.classList.add('active');
                question.setAttribute('aria-expanded', 'true');
            }
        });
    });

    // ===== Gold Price (config-driven) =====
    if (window.SITE_CONFIG) {
        const priceEl = document.getElementById('goldPrice585');
        const noteEl = document.getElementById('goldPriceNote');

        if (priceEl && window.SITE_CONFIG.goldPrice585PerGram) {
            const formatted = new Intl.NumberFormat('ru-RU').format(window.SITE_CONFIG.goldPrice585PerGram);
            priceEl.textContent = formatted + ' ₽/г с НДС';
        }
        if (noteEl && window.SITE_CONFIG.goldPriceNote) {
            noteEl.textContent = window.SITE_CONFIG.goldPriceNote;
        }
    }

    console.log('ЮС 812 — Ювелирная студия. Сайт загружен успешно.');
});