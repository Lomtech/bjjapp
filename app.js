// Umgebungsvariablen - werden von build.js ersetzt
const SUPABASE_URL = 'SUPABASE_URL_PLACEHOLDER';
const SUPABASE_ANON_KEY = 'SUPABASE_KEY_PLACEHOLDER';

let supabase = null;
let map = null;
let currentUser = null;
let isLogin = true;
let allAthletes = [];
let allGyms = [];
let editingAthleteId = null;
let currentAthleteImageUrl = null;

// Geocoding Funktion
async function geocodeAddress(street, postalCode, city) {
    const address = `${street}, ${postalCode} ${city}, Germany`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'BJJ-Community-Platform' }
        });
        const data = await response.json();
        
        if (data && data.length > 0) {
            return {
                latitude: parseFloat(data[0].lat),
                longitude: parseFloat(data[0].lon),
                success: true
            };
        }
        return { success: false };
    } catch (error) {
        return { success: false };
    }
}

// Initialisierung beim Laden
(function init() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY && 
        SUPABASE_URL !== 'SUPABASE_URL_PLACEHOLDER' && 
        SUPABASE_ANON_KEY !== 'SUPABASE_KEY_PLACEHOLDER') {
        initSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        showNotification('⚠️ Umgebungsvariablen nicht gefunden', 'warning');
    }
})();

async function initSupabase(url, key) {
    supabase = window.supabase.createClient(url, key);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        updateAuthUI();
        loadGymsForAthleteSelect();
        loadGymsForSelect();
        loadAthletes();
        loadGyms();
        loadOpenMats();
        loadDashboard();
    } else {
        updateAuthUI();
    }

    supabase.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        updateAuthUI();
        if (event === 'SIGNED_IN') {
            loadDashboard();
            loadGymsForAthleteSelect();
            loadGymsForSelect();
            loadAthletes();
            loadGyms();
            loadOpenMats();
        }
    });
}

function updateAuthUI() {
    const authSection = document.getElementById('auth-section');
    if (currentUser) {
        authSection.innerHTML = `
            <div class="user-info">
                <span>👤 ${currentUser.email}</span>
            </div>
            <button class="auth-btn logout" onclick="logout()">Logout</button>
        `;
    } else {
        authSection.innerHTML = `
            <button class="auth-btn" onclick="openAuthModal('login')">Login</button>
            <button class="auth-btn" onclick="openAuthModal('signup')">Registrieren</button>
        `;
    }
    updateVisibility();
}

function updateVisibility() {
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const welcomeScreen = document.getElementById('welcome-screen');
    
    if (!currentUser) {
        // Nicht angemeldet: Tabs ausblenden, Welcome-Screen zeigen
        tabs.forEach(tab => tab.style.display = 'none');
        tabContents.forEach(content => content.classList.remove('active'));
        if (welcomeScreen) {
            welcomeScreen.classList.add('active');
        }
    } else {
        // Angemeldet: Tabs anzeigen, Welcome-Screen verstecken
        tabs.forEach((tab, index) => {
            tab.style.display = index === 0 ? 'none' : 'block';
        });
        if (welcomeScreen) {
            welcomeScreen.classList.remove('active');
        }
        // Zeige Dashboard als Default
        switchTab('dashboard');
    }
}

function openAuthModal(mode) {
    isLogin = mode === 'login';
    document.getElementById('modal-title').textContent = isLogin ? 'Login' : 'Registrieren';
    document.getElementById('auth-submit-btn').textContent = isLogin ? 'Anmelden' : 'Registrieren';
    document.getElementById('toggle-auth').textContent = isLogin ? 
        'Noch kein Konto? Registrieren' : 'Bereits registriert? Anmelden';
    document.getElementById('auth-modal').classList.add('show');
}

function closeModal() {
    // Verhindere Schließen wenn nicht angemeldet
    if (!currentUser) {
        showNotification('Bitte melde dich an, um fortzufahren', 'warning');
        return;
    }
    closeModalForce();
}

function closeModalForce() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.remove('show');
    }
    const form = document.getElementById('auth-form');
    if (form) {
        form.reset();
    }
}

function toggleAuthMode(e) {
    e.preventDefault();
    isLogin = !isLogin;
    openAuthModal(isLogin ? 'login' : 'signup');
}

async function logout() {
    await supabase.auth.signOut();
    showNotification('Erfolgreich abgemeldet', 'info');
}

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabase) return showNotification('Bitte zuerst Supabase konfigurieren!', 'warning');

    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
        if (isLogin) {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            showNotification('Erfolgreich angemeldet!');
            closeModalForce();
        } else {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            showNotification('Registrierung erfolgreich! Bitte bestätige deine E-Mail.', 'info');
            closeModalForce();
        }
    } catch (error) {
        showNotification('Fehler: ' + error.message, 'error');
    }
});

function switchTab(tabName, eventTarget = null) {
    if (!currentUser) return;
    
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    const targetTab = document.getElementById(tabName + '-tab');
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // Aktiviere den entsprechenden Button
    if (eventTarget) {
        eventTarget.classList.add('active');
    } else {
        // Finde den Button basierend auf dem Tab-Namen
        const tabMapping = {
            'dashboard': 'Dashboard',
            'athletes': 'Athleten',
            'gyms': 'Gyms',
            'openmats': 'Open Mats',
            'map': 'Karte',
            'setup': 'Setup'
        };
        
        const buttons = document.querySelectorAll('.tab-btn');
        buttons.forEach(btn => {
            if (btn.textContent === tabMapping[tabName]) {
                btn.classList.add('active');
            }
        });
    }

    if (tabName === 'map' && !map) {
        initMap();
    }
    if (tabName === 'dashboard') {
        loadDashboard();
    }
}

function showNotification(message, type = 'success') {
    const notif = document.getElementById('notification');
    notif.textContent = message;
    notif.className = 'notification show';
    if (type) notif.classList.add(type);
    setTimeout(() => notif.classList.remove('show'), 3000);
}

async function loadDashboard() {
    if (!supabase) return;
    
    const [
        { data: athletes },
        { data: gyms },
        { data: openMats }
    ] = await Promise.all([
        supabase.from('athletes').select('*'),
        supabase.from('gyms').select('*'),
        supabase.from('open_mats').select('*').gte('event_date', new Date().toISOString())
    ]);

    const statsGrid = document.getElementById('stats-grid');
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div>👥 Athleten</div>
            <div class="stat-number">${athletes?.length || 0}</div>
        </div>
        <div class="stat-card">
            <div>🏋️ Gyms</div>
            <div class="stat-number">${gyms?.length || 0}</div>
        </div>
        <div class="stat-card">
            <div>📅 Open Mats</div>
            <div class="stat-number">${openMats?.length || 0}</div>
        </div>
    `;

    const activities = document.getElementById('recent-activities');
    const recentAthletes = athletes?.slice(-3).reverse() || [];
    activities.innerHTML = recentAthletes.length > 0 ? 
        recentAthletes.map(a => `
            <div style="padding: 15px; background: #f8f9fa; margin: 10px 0; border-radius: 8px;">
                <strong>${a.name}</strong> hat sich registriert
                <span style="float: right; color: #666; font-size: 0.9em;">
                    ${new Date(a.created_at).toLocaleDateString('de-DE')}
                </span>
            </div>
        `).join('') : '<p>Noch keine Aktivitäten</p>';
}

// Lade alle Gyms für das Athleten-Dropdown
async function loadGymsForAthleteSelect() {
    if (!supabase) return;
    const { data: gyms } = await supabase.from('gyms').select('id, name, city').order('name');
    const select = document.getElementById('athlete-gym-select');
    if (gyms && select) {
        select.innerHTML = '<option value="">Kein Gym zugeordnet</option>' + 
            gyms.map(g => `<option value="${g.id}">${g.name}${g.city ? ` (${g.city})` : ''}</option>`).join('');
    }
}

document.getElementById('athlete-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabase) return;

    const formData = new FormData(e.target);
    const imageFile = formData.get('image');
    const athleteId = formData.get('athlete_id');
    const isEditing = !!athleteId;

    let imageUrl = currentAthleteImageUrl;

    // Bild hochladen wenn vorhanden
    if (imageFile && imageFile.size > 0) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
            .from('profile-images')
            .upload(fileName, imageFile, { upsert: true });

        if (uploadError) {
            showNotification('Fehler beim Bild-Upload: ' + uploadError.message, 'error');
            return;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('profile-images')
            .getPublicUrl(fileName);
        imageUrl = publicUrl;
    }

    const data = {
        name: formData.get('name'),
        age: formData.get('age') ? parseInt(formData.get('age')) : null,
        weight: formData.get('weight') ? parseFloat(formData.get('weight')) : null,
        belt_rank: formData.get('belt_rank'),
        bio: formData.get('bio') || null,
        gym_id: formData.get('gym_id') || null,
        image_url: imageUrl,
        user_id: currentUser.id
    };

    if (isEditing) {
        // Update bestehenden Athleten
        const { error } = await supabase
            .from('athletes')
            .update(data)
            .eq('id', athleteId);

        if (error) {
            showNotification('Fehler beim Aktualisieren: ' + error.message, 'error');
        } else {
            showNotification('Profil erfolgreich aktualisiert!');
            cancelAthleteEdit();
            loadAthletes();
        }
    } else {
        // Neuen Athleten erstellen
        const { error } = await supabase.from('athletes').insert([data]);

        if (error) {
            showNotification('Fehler: ' + error.message, 'error');
        } else {
            showNotification('Profil erfolgreich angelegt!');
            e.target.reset();
            loadAthletes();
            loadDashboard();
        }
    }
});

async function loadAthletes() {
    if (!supabase) return;
    const { data } = await supabase
        .from('athletes')
        .select('*, gyms(name, city)')
        .order('created_at', { ascending: false });
    
    if (data) {
        allAthletes = data;
        displayAthletes(data);
    }
}

function displayAthletes(athletes) {
    const list = document.getElementById('athletes-list');
    list.innerHTML = athletes.map(a => `
        <div class="profile-card">
            ${currentUser && currentUser.id === a.user_id ? `
                <div class="profile-actions">
                    <button class="btn btn-small" onclick="editAthlete('${a.id}')">✏️</button>
                    <button class="btn btn-small btn-danger" onclick="deleteAthlete('${a.id}')">🗑️</button>
                </div>
            ` : ''}
            ${a.image_url ? `<img src="${a.image_url}" class="profile-image" alt="${a.name}">` : 
              '<div class="profile-image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 3em; color: white;">👤</div>'}
            <h3>${a.name}</h3>
            ${a.bio ? `<p style="font-size: 0.9em; color: #666; margin: 10px 0;">${a.bio}</p>` : ''}
            ${a.age ? `<p>📅 ${a.age} Jahre</p>` : ''}
            ${a.weight ? `<p>⚖️ ${a.weight} kg</p>` : ''}
            ${a.belt_rank ? `<span class="belt-badge belt-${a.belt_rank}">${a.belt_rank.toUpperCase()}</span>` : ''}
            ${a.gyms ? `<p style="margin-top: 10px;">🏋️ <strong>${a.gyms.name}</strong>${a.gyms.city ? ` (${a.gyms.city})` : ''}</p>` : ''}
        </div>
    `).join('');
}

async function editAthlete(athleteId) {
    if (!supabase) return;
    
    const { data: athlete } = await supabase
        .from('athletes')
        .select('*')
        .eq('id', athleteId)
        .single();
    
    if (!athlete) return;

    editingAthleteId = athleteId;
    currentAthleteImageUrl = athlete.image_url;

    // Formular mit Daten füllen
    document.getElementById('athlete-id').value = athlete.id;
    document.getElementById('athlete-name').value = athlete.name || '';
    document.getElementById('athlete-bio').value = athlete.bio || '';
    document.getElementById('athlete-age').value = athlete.age || '';
    document.getElementById('athlete-weight').value = athlete.weight || '';
    document.getElementById('athlete-belt').value = athlete.belt_rank || '';
    document.getElementById('athlete-gym-select').value = athlete.gym_id || '';

    // Bild-Vorschau anzeigen
    const preview = document.getElementById('current-image-preview');
    if (athlete.image_url) {
        preview.innerHTML = `
            <div style="margin-top: 10px;">
                <img src="${athlete.image_url}" style="max-width: 200px; border-radius: 10px;" alt="Aktuelles Bild">
                <p style="font-size: 0.9em; color: #666;">Neues Bild hochladen, um zu ersetzen</p>
            </div>
        `;
    } else {
        preview.innerHTML = '';
    }

    // UI anpassen
    document.getElementById('athlete-form-title').textContent = 'Athleten-Profil bearbeiten';
    document.getElementById('athlete-submit-btn').textContent = 'Profil aktualisieren';
    document.getElementById('cancel-edit-btn').style.display = 'block';

    // Zum Formular scrollen
    document.getElementById('athlete-form').scrollIntoView({ behavior: 'smooth' });
}

function cancelAthleteEdit() {
    editingAthleteId = null;
    currentAthleteImageUrl = null;
    
    document.getElementById('athlete-form').reset();
    document.getElementById('athlete-id').value = '';
    document.getElementById('current-image-preview').innerHTML = '';
    document.getElementById('athlete-form-title').textContent = 'Athleten-Profil anlegen';
    document.getElementById('athlete-submit-btn').textContent = 'Profil anlegen';
    document.getElementById('cancel-edit-btn').style.display = 'none';
}

function filterAthletes() {
    const searchTerm = document.getElementById('search-athlete').value.toLowerCase();
    const beltFilter = document.getElementById('filter-belt').value;
    const weightFilter = parseFloat(document.getElementById('filter-weight').value);

    let filtered = allAthletes;

    if (searchTerm) {
        filtered = filtered.filter(a => a.name.toLowerCase().includes(searchTerm));
    }
    if (beltFilter) {
        filtered = filtered.filter(a => a.belt_rank === beltFilter);
    }
    if (weightFilter) {
        filtered = filtered.filter(a => a.weight && a.weight <= weightFilter);
    }

    displayAthletes(filtered);
}

async function deleteAthlete(id) {
    if (!confirm('Profil wirklich löschen?')) return;
    const { error } = await supabase.from('athletes').delete().eq('id', id);
    if (error) {
        showNotification('Fehler beim Löschen', 'error');
    } else {
        showNotification('Profil gelöscht');
        loadAthletes();
        loadDashboard();
    }
}

document.getElementById('gym-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabase) return;

    const submitBtn = document.getElementById('gym-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Erstelle Gym...';

    const formData = new FormData(e.target);
    const street = formData.get('street');
    const postalCode = formData.get('postal_code');
    const city = formData.get('city');

    const statusDiv = document.getElementById('geocoding-status');
    statusDiv.textContent = '🔄 Geocodiere Adresse...';
    statusDiv.className = 'geocoding-status';

    const geoResult = await geocodeAddress(street, postalCode, city);

    if (!geoResult.success) {
        statusDiv.textContent = '⚠️ Adresse konnte nicht gefunden werden';
        statusDiv.className = 'geocoding-status error';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Gym anlegen';
        return;
    }

    statusDiv.textContent = '✅ Adresse erfolgreich gefunden';
    statusDiv.className = 'geocoding-status success';

    const imageFile = formData.get('image');
    let imageUrl = null;

    if (imageFile && imageFile.size > 0) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `gym_${currentUser.id}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
            .from('profile-images')
            .upload(fileName, imageFile, { upsert: true });

        if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
                .from('profile-images')
                .getPublicUrl(fileName);
            imageUrl = publicUrl;
        }
    }

    const data = {
        name: formData.get('name'),
        description: formData.get('description') || null,
        email: formData.get('email') || null,
        phone: formData.get('phone') || null,
        website: formData.get('website') || null,
        street: street,
        postal_code: postalCode,
        city: city,
        address: `${street}, ${postalCode} ${city}`,
        latitude: geoResult.latitude,
        longitude: geoResult.longitude,
        image_url: imageUrl,
        user_id: currentUser.id
    };

    const { error } = await supabase.from('gyms').insert([data]);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Gym anlegen';

    if (error) {
        showNotification('Fehler: ' + error.message, 'error');
    } else {
        showNotification('Gym erfolgreich angelegt!');
        e.target.reset();
        statusDiv.textContent = '';
        loadGyms();
        loadGymsForAthleteSelect();
        loadGymsForSelect();
        loadDashboard();
        if (map) initMap();
    }
});

document.getElementById('openmat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabase) return;

    const formData = new FormData(e.target);
    const data = {
        gym_id: formData.get('gym_id'),
        title: formData.get('title'),
        description: formData.get('description') || null,
        event_date: formData.get('event_date'),
        duration_minutes: parseInt(formData.get('duration_minutes'))
    };

    const { error } = await supabase.from('open_mats').insert([data]);
    if (error) {
        showNotification('Fehler: ' + error.message, 'error');
    } else {
        showNotification('Event erstellt!');
        e.target.reset();
        loadOpenMats();
        loadDashboard();
        if (map) initMap();
    }
});

async function loadGyms() {
    if (!supabase) return;
    const { data: gyms } = await supabase.from('gyms').select('*');
    const { data: ratings } = await supabase.from('gym_ratings').select('*');
    
    if (gyms) {
        allGyms = gyms.map(gym => {
            const gymRatings = ratings?.filter(r => r.gym_id === gym.id) || [];
            const avgRating = gymRatings.length > 0 ? 
                gymRatings.reduce((sum, r) => sum + r.rating, 0) / gymRatings.length : 0;
            return { ...gym, avgRating, ratingCount: gymRatings.length };
        });
        displayGyms(allGyms);
    }
}

function displayGyms(gyms) {
    const list = document.getElementById('gyms-list');
    list.innerHTML = gyms.map(g => `
        <div class="profile-card">
            ${currentUser && currentUser.id === g.user_id ? `
                <div class="profile-actions">
                    <button class="btn btn-small btn-danger" onclick="deleteGym('${g.id}')">🗑️</button>
                </div>
            ` : ''}
            ${g.image_url ? `<img src="${g.image_url}" class="profile-image" alt="${g.name}">` : ''}
            <h3>${g.name}</h3>
            ${g.description ? `<p style="font-size: 0.9em; color: #666;">${g.description}</p>` : ''}
            <p>📍 ${g.street || ''}</p>
            <p>🏙️ ${g.postal_code || ''} ${g.city || ''}</p>
            ${g.phone ? `<p>📞 ${g.phone}</p>` : ''}
            ${g.website ? `<p><a href="${g.website}" target="_blank">🌐 Website</a></p>` : ''}
            ${g.avgRating > 0 ? `
                <div class="rating">
                    <span class="stars">${'★'.repeat(Math.round(g.avgRating))}${'☆'.repeat(5 - Math.round(g.avgRating))}</span>
                    <span>(${g.ratingCount} Bewertungen)</span>
                </div>
            ` : ''}
            ${currentUser && currentUser.id !== g.user_id ? `
                <button class="btn btn-small" onclick="openRatingModal('${g.id}')">Bewerten</button>
            ` : ''}
        </div>
    `).join('');
}

function filterGyms() {
    const searchTerm = document.getElementById('search-gym').value.toLowerCase();
    const ratingFilter = parseFloat(document.getElementById('filter-rating').value);

    let filtered = allGyms;

    if (searchTerm) {
        filtered = filtered.filter(g => 
            g.name.toLowerCase().includes(searchTerm) || 
            g.city?.toLowerCase().includes(searchTerm)
        );
    }
    if (ratingFilter) {
        filtered = filtered.filter(g => g.avgRating >= ratingFilter);
    }

    displayGyms(filtered);
}

async function deleteGym(id) {
    if (!confirm('Gym wirklich löschen?')) return;
    const { error } = await supabase.from('gyms').delete().eq('id', id);
    if (error) {
        showNotification('Fehler beim Löschen', 'error');
    } else {
        showNotification('Gym gelöscht');
        loadGyms();
        loadGymsForAthleteSelect();
        loadDashboard();
        if (map) initMap();
    }
}

function openRatingModal(gymId) {
    if (!currentUser) return showNotification('Bitte zuerst anmelden!', 'warning');
    document.getElementById('rating-gym-id').value = gymId;
    document.getElementById('rating-modal').classList.add('show');
}

function closeRatingModal() {
    document.getElementById('rating-modal').classList.remove('show');
    document.getElementById('rating-form').reset();
    document.querySelectorAll('#star-rating span').forEach(s => s.classList.remove('active'));
}

function setRating(rating) {
    document.getElementById('rating-value').value = rating;
    const stars = document.querySelectorAll('#star-rating span');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

document.getElementById('rating-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabase) return;

    const formData = new FormData(e.target);
    const data = {
        gym_id: formData.get('gym_id'),
        user_id: currentUser.id,
        rating: parseInt(formData.get('rating')),
        comment: formData.get('comment') || null
    };

    const { error } = await supabase.from('gym_ratings').insert([data]);
    if (error) {
        showNotification('Fehler: ' + error.message, 'error');
    } else {
        showNotification('Bewertung gespeichert!');
        closeRatingModal();
        loadGyms();
    }
});

async function loadGymsForSelect() {
    if (!supabase) return;
    const { data } = await supabase.from('gyms').select('id, name, city, user_id');
    if (currentUser && data) {
        const ownGyms = data.filter(g => g.user_id === currentUser.id);
        if (ownGyms.length > 0) {
            const select = document.getElementById('gym-select');
            select.innerHTML = '<option value="">Bitte wählen</option>' + 
                ownGyms.map(g => `<option value="${g.id}">${g.name} ${g.city ? `(${g.city})` : ''}</option>`).join('');
        }
    }
}

async function loadOpenMats() {
    if (!supabase) return;
    const { data } = await supabase
        .from('open_mats')
        .select('*, gyms(name, city, street, postal_code, user_id)')
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true });
    
    if (data) {
        const list = document.getElementById('openmats-list');
        list.innerHTML = data.map(om => {
            const date = new Date(om.event_date);
            const isOwner = currentUser && om.gyms?.user_id === currentUser.id;
            return `
                <div class="event-card">
                    ${isOwner ? `
                        <div class="event-actions">
                            <button class="btn btn-small btn-danger" onclick="deleteOpenMat('${om.id}')">🗑️</button>
                        </div>
                    ` : ''}
                    <div class="event-date">${date.toLocaleDateString('de-DE', { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    })}</div>
                    <h3>${om.title}</h3>
                    <p><strong>${om.gyms?.name || ''}</strong></p>
                    ${om.gyms?.street ? `<p>📍 ${om.gyms.street}</p>` : ''}
                    ${om.gyms?.city ? `<p>🏙️ ${om.gyms.postal_code || ''} ${om.gyms.city}</p>` : ''}
                    ${om.description ? `<p>${om.description}</p>` : ''}
                    <p>⏱️ Dauer: ${om.duration_minutes} Minuten</p>
                </div>
            `;
        }).join('');
    }
}

async function deleteOpenMat(id) {
    if (!confirm('Event wirklich löschen?')) return;
    const { error } = await supabase.from('open_mats').delete().eq('id', id);
    if (error) {
        showNotification('Fehler beim Löschen', 'error');
    } else {
        showNotification('Event gelöscht');
        loadOpenMats();
        loadDashboard();
        if (map) initMap();
    }
}

async function initMap() {
    if (!supabase) return;
    
    if (map) map.remove();
    
    map = L.map('map').setView([51.1657, 10.4515], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    const { data: gyms } = await supabase.from('gyms').select('*');
    const { data: openMats } = await supabase
        .from('open_mats')
        .select('*, gyms(name, city, street, postal_code, latitude, longitude)')
        .gte('event_date', new Date().toISOString());

    let bounds = [];

    if (gyms && gyms.length > 0) {
        gyms.forEach(gym => {
            if (gym.latitude && gym.longitude) {
                L.marker([gym.latitude, gym.longitude])
                    .addTo(map)
                    .bindPopup(`<strong>${gym.name}</strong><br>${gym.street || ''}<br>${gym.postal_code || ''} ${gym.city || ''}`);
                bounds.push([gym.latitude, gym.longitude]);
            }
        });
    }

    if (openMats && openMats.length > 0) {
        openMats.forEach(om => {
            if (om.gyms?.latitude && om.gyms?.longitude) {
                const date = new Date(om.event_date).toLocaleDateString('de-DE', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                L.marker([om.gyms.latitude, om.gyms.longitude], {
                    icon: L.divIcon({ className: 'custom-icon', html: '📅', iconSize: [30, 30] })
                })
                    .addTo(map)
                    .bindPopup(`<strong>${om.title}</strong><br>${om.gyms.name}<br>${om.gyms.street || ''}<br>${om.gyms.postal_code || ''} ${om.gyms.city || ''}<br>📅 ${date}`);
                bounds.push([om.gyms.latitude, om.gyms.longitude]);
            }
        });
    }

    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}