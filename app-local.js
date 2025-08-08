// app-local.js (Updated for a more immersive user experience)

const LS_PROFILES_KEY = 'jm_profiles_v2';
const LS_MESSAGES_KEY = 'jm_messages_v2';
const SESSION_ACTIVE_PROFILE_KEY = 'jm_active_profile_id'; // Using sessionStorage for the active "user"

// --- Active Profile Management (NEW) ---
function setActiveProfile(profileId) {
    if (profileId) {
        sessionStorage.setItem(SESSION_ACTIVE_PROFILE_KEY, profileId);
    } else {
        sessionStorage.removeItem(SESSION_ACTIVE_PROFILE_KEY);
    }
    // Update the nav bar on any page that's open
    window.dispatchEvent(new Event('activeProfileChanged'));
}

function getActiveProfile() {
    const activeId = sessionStorage.getItem(SESSION_ACTIVE_PROFILE_KEY);
    return activeId ? getProfileById(activeId) : null;
}

// --- Profile Storage ---
function loadProfilesFromStorage() {
  try {
    const data = localStorage.getItem(LS_PROFILES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Error loading profiles:", e);
    return [];
  }
}

function saveProfilesToStorage(profiles) {
  try {
    localStorage.setItem(LS_PROFILES_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.error("Error saving profiles:", e);
  }
}

function saveProfileToStorage(profile) {
  const allProfiles = loadProfilesFromStorage();
  if (!profile.id || !profile.name || !profile.species) {
      console.error("Attempted to save invalid profile:", profile);
      return;
  }
  profile.likes = [];
  allProfiles.unshift(profile);
  saveProfilesToStorage(allProfiles);
}

function getProfileById(id) {
  return loadProfilesFromStorage().find(p => p.id === id);
}

// --- "Like" and Mutual Match Logic ---
function addLike(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const allProfiles = loadProfilesFromStorage();
    const sourceProfile = allProfiles.find(p => p.id === sourceId);
    if (sourceProfile) {
        if (!sourceProfile.likes) {
            sourceProfile.likes = [];
        }
        if (!sourceProfile.likes.includes(targetId)) {
            sourceProfile.likes.push(targetId);
            saveProfilesToStorage(allProfiles);
        }
    }
}

function checkForMutualMatch(sourceId, targetId) {
    if (!sourceId || !targetId) return false;
    const targetProfile = getProfileById(targetId);
    return targetProfile && targetProfile.likes && targetProfile.likes.includes(sourceId);
}

// --- Get all successful mutual matches for a user (NEW) ---
function getMutualMatchesFor(profileId) {
    const sourceProfile = getProfileById(profileId);
    if (!sourceProfile || !sourceProfile.likes) return [];
    
    const mutuals = [];
    sourceProfile.likes.forEach(likedId => {
        const likedProfile = getProfileById(likedId);
        if (likedProfile && likedProfile.likes && likedProfile.likes.includes(profileId)) {
            mutuals.push(likedProfile);
        }
    });
    return mutuals;
}

// --- Message Storage --- (No changes in this section)
function loadAllMessages() {
  try {
    const data = localStorage.getItem(LS_MESSAGES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
}
function saveAllMessages(messages) {
  try {
    localStorage.setItem(LS_MESSAGES_KEY, JSON.stringify(messages));
  } catch (e) { console.error("Error saving messages:", e); }
}
function addMessage(from, to, text) {
  const allMessages = loadAllMessages();
  allMessages.push({ from, to, text, time: Date.now() });
  saveAllMessages(allMessages);
}
function loadMessagesForPair(userA, userB) {
  return loadAllMessages()
    .filter(m => (m.from === userA && m.to === userB) || (m.from === userB && m.to === userA))
    .sort((x, y) => x.time - y.time);
}

// --- Matching Algorithm --- (No changes in this section)
function findMatchesFor(sourceId) {
  const all = loadProfilesFromStorage();
  const sourceProfile = all.find(p => p.id === sourceId);
  if (!sourceProfile) return [];
  const results = [];
  all.forEach(p => {
    if (p.id === sourceId) return;
    let score = 0;
    if (p.species && sourceProfile.species && p.species.toLowerCase() === sourceProfile.species.toLowerCase()) { score += 5; }
    if (p.diet === sourceProfile.diet) { score += 2; }
    const sourceHobbies = new Set((sourceProfile.hobbies || []).map(h => h.toLowerCase()));
    const targetHobbies = new Set((p.hobbies || []).map(h => h.toLowerCase()));
    let sharedHobbiesCount = 0;
    sourceHobbies.forEach(hobby => { if (targetHobbies.has(hobby)) { sharedHobbiesCount++; } });
    score += Math.min(sharedHobbiesCount * 2, 4);
    const ageDiff = Math.abs((sourceProfile.age || 0) - (p.age || 0));
    if (ageDiff <= 2) score += 2; else if (ageDiff <= 5) score += 1;
    if (score > 0) { results.push({ ...p, score }); }
  });
  results.sort((a, b) => b.score - a.score || b.createdAt - a.createdAt);
  return results.slice(0, 12);
}

// --- UI Rendering ---
function renderNavActiveProfile() {
    const activeProfile = getActiveProfile();
    const container = document.getElementById('active-profile-display');
    if (!container) return;

    if (activeProfile) {
        container.innerHTML = `
            <span class="text-sm text-slate-500 hidden sm:inline">Active Profile:</span>
            <img src="${activeProfile.photo || ''}" class="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" onerror="this.outerHTML='<div class=\\'w-8 h-8 rounded-full bg-slate-200\\'></div>'"/>
            <span class="text-sm font-bold text-slate-700">${activeProfile.name}</span>
        `;
    } else {
        container.innerHTML = `<span class="text-sm text-slate-500">No Active Profile. <a href="matches.html" class="font-bold text-orange-600">Pick one!</a></span>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderNavActiveProfile(); // Render on initial load
    window.addEventListener('activeProfileChanged', renderNavActiveProfile); // Listen for changes

    const container = document.getElementById('profiles');
    if (!container) return; 

    const searchInput = document.getElementById('searchInput');
    const filterDiet = document.getElementById('filterDiet');
    const filterSpecies = document.getElementById('filterSpecies');
    const clearBtn = document.getElementById('clearFilters');

    function renderProfiles(profilesToRender) {
        container.innerHTML = '';
        const activeProfile = getActiveProfile();

        if (!profilesToRender.length) {
            container.innerHTML = '<p class="text-slate-500 col-span-full">No profiles match your criteria. Try clearing the filters!</p>';
            return;
        }
        profilesToRender.forEach(p => {
            if (p.id === (activeProfile && activeProfile.id)) return; // Don't show active profile on main list

            const card = document.createElement('div');
            // **NEW:** Check if the active user has liked this profile
            const isLiked = activeProfile && activeProfile.likes && activeProfile.likes.includes(p.id);
            card.className = `profile-card ${isLiked ? 'is-liked' : ''}`;
            
            const placeholderDiv = `<div class='h-56 bg-slate-100 flex items-center justify-center text-slate-400'>No Photo</div>`;
            const imgHTML = p.photo ? `<img src="${p.photo}" class="h-56 w-full object-cover" onerror="this.outerHTML='${placeholderDiv}'">` : placeholderDiv;

            card.innerHTML = `
                <div class="liked-indicator">❤️</div>
                ${imgHTML}
                <div class="p-5">
                    <p class="text-sm font-semibold text-orange-600">${p.species}</p>
                    <h3 class="font-bold text-xl mt-1 text-slate-800">${p.name}</h3>
                    <p class="text-slate-500 text-sm mt-2 h-10">${(p.bio || '').slice(0, 70)}${(p.bio || '').length > 70 ? '...' : ''}</p>
                    <div class="mt-4">
                      <a href="profile.html?id=${p.id}" class="font-semibold text-sm text-slate-800 hover:text-orange-600">View Profile &rarr;</a>
                    </div>
                </div>`;
            container.appendChild(card);
        });
    }

    function applyFilters() {
        const all = loadProfilesFromStorage();
        const query = searchInput.value.toLowerCase();
        const diet = filterDiet.value;
        const species = filterSpecies.value;
        const filtered = all.filter(p => {
            const textMatch = (p.name.toLowerCase().includes(query) || p.species.toLowerCase().includes(query) || (p.bio || '').toLowerCase().includes(query));
            const dietMatch = !diet || p.diet === diet;
            const speciesFilterMatch = !species || p.species === species;
            return textMatch && dietMatch && speciesFilterMatch;
        });
        renderProfiles(filtered);
    }
    
    renderProfiles(loadProfilesFromStorage());
    window.addEventListener('activeProfileChanged', () => renderProfiles(loadProfilesFromStorage()));

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (filterDiet) filterDiet.addEventListener('change', applyFilters);
    if (filterSpecies) filterSpecies.addEventListener('change', applyFilters);
    if (clearBtn) clearBtn.addEventListener('click', () => {
        if(searchInput) searchInput.value=''; 
        if(filterDiet) filterDiet.value=''; 
        if(filterSpecies) filterSpecies.value='';
        renderProfiles(loadProfilesFromStorage());
    });
});