// Mobile Menu Dropdown Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Warte kurz, damit alle anderen Scripts geladen sind
    setTimeout(initMobileMenuSystem, 100);
});

function initMobileMenuSystem() {
    // Prüfe ob wir auf Mobile sind
    function isMobile() {
        return window.innerWidth < 600;
    }

    let mobileToggleBtn = null;
    let mobileDropdown = null;

    // Initialisiere Mobile Menu
    function initMobileMenu() {
        const tabsContainer = document.querySelector('.tabs');
        if (!tabsContainer) return;

        // Cleanup alte Mobile-Elemente
        if (mobileToggleBtn) mobileToggleBtn.remove();
        if (mobileDropdown) mobileDropdown.remove();
        mobileToggleBtn = null;
        mobileDropdown = null;

        if (!isMobile()) {
            tabsContainer.style.display = '';
            return;
        }

        // Erstelle Toggle Button
        mobileToggleBtn = document.createElement('button');
        mobileToggleBtn.className = 'mobile-menu-toggle';
        mobileToggleBtn.type = 'button';
        
        // Erstelle Dropdown Container
        mobileDropdown = document.createElement('div');
        mobileDropdown.className = 'tabs-dropdown';
        
        // Hole alle Tab-Buttons
        const tabButtons = Array.from(tabsContainer.querySelectorAll('.tab-btn'));
        
        // Klone Buttons in Dropdown
        tabButtons.forEach((btn, index) => {
            const clonedBtn = btn.cloneNode(true);
            
            // Entferne onclick und füge neuen Event Listener hinzu
            clonedBtn.removeAttribute('onclick');
            clonedBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Extrahiere Tab-Name aus dem Original-Button onclick
                const originalOnclick = btn.getAttribute('onclick');
                if (originalOnclick) {
                    const match = originalOnclick.match(/switchTab\('([^']+)'/);
                    if (match && window.switchTab) {
                        const tabName = match[1];
                        
                        // Rufe die originale switchTab Funktion auf
                        window.switchTab(tabName, btn);
                        
                        // Schließe Dropdown
                        mobileDropdown.classList.remove('open');
                        mobileToggleBtn.classList.remove('open');
                        
                        // Update Toggle Text
                        updateToggleText();
                    }
                }
            });
            
            mobileDropdown.appendChild(clonedBtn);
        });
        
        // Verstecke originale Tabs auf Mobile
        tabsContainer.style.display = 'none';
        
        // Füge Toggle und Dropdown ins DOM ein
        tabsContainer.parentNode.insertBefore(mobileToggleBtn, tabsContainer);
        tabsContainer.parentNode.insertBefore(mobileDropdown, tabsContainer.nextSibling);

        // Update Toggle Text mit aktivem Tab
        function updateToggleText() {
            // Finde aktiven Button in den Originalen
            const activeBtn = Array.from(tabButtons).find(btn => btn.classList.contains('active'));
            if (activeBtn) {
                // Entferne Badge-Text und Whitespace
                const btnText = activeBtn.textContent.trim().split('\n')[0].trim();
                mobileToggleBtn.textContent = btnText;
            } else {
                mobileToggleBtn.textContent = 'Menü';
            }
        }
        
        updateToggleText();

        // Toggle Dropdown öffnen/schließen
        mobileToggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            mobileDropdown.classList.toggle('open');
            mobileToggleBtn.classList.toggle('open');
        });

        // Schließe Dropdown beim Klick außerhalb
        document.addEventListener('click', function(e) {
            if (mobileToggleBtn && mobileDropdown && 
                !mobileToggleBtn.contains(e.target) && 
                !mobileDropdown.contains(e.target)) {
                mobileDropdown.classList.remove('open');
                mobileToggleBtn.classList.remove('open');
            }
        });

        // Beobachte Änderungen an Original-Buttons für Active-States
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.attributeName === 'class') {
                    const target = mutation.target;
                    const index = tabButtons.indexOf(target);
                    
                    if (index !== -1 && mobileDropdown) {
                        const dropdownBtns = mobileDropdown.querySelectorAll('.tab-btn');
                        const dropdownBtn = dropdownBtns[index];
                        
                        if (dropdownBtn) {
                            if (target.classList.contains('active')) {
                                dropdownBtn.classList.add('active');
                                updateToggleText();
                            } else {
                                dropdownBtn.classList.remove('active');
                            }
                        }
                    }
                }
            });
        });

        // Beobachte alle Tab-Buttons
        tabButtons.forEach(btn => {
            observer.observe(btn, { 
                attributes: true,
                attributeFilter: ['class']
            });
        });
    }

    // Initialisiere beim Start
    initMobileMenu();

    // Handle Window Resize mit Debouncing
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            initMobileMenu();
        }, 250);
    });

    // Exportiere für externe Verwendung
    window.refreshMobileMenu = initMobileMenu;
}
