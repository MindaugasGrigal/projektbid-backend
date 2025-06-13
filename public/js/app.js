// ===== GLOBAL VARIABLES =====
let currentUser = null;
let authToken = localStorage.getItem('authToken');
const API_BASE = window.location.origin;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    
    // Check URL parameters for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('token')) {
        authToken = urlParams.get('token');
        localStorage.setItem('authToken', authToken);
        showNotification('Sėkmingas prisijungimas per Google!', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
        checkAuthStatus();
    }
});

async function initializeApp() {
    if (authToken) {
        await checkAuthStatus();
    } else {
        updateUIForGuest();
    }
    
    // Load marketplace stats
    await loadMarketplaceStats();
}

function setupEventListeners() {
    // Navigation
    document.getElementById('hamburger').addEventListener('click', toggleMobileMenu);
    
    // Forms
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Close user menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.user-dropdown')) {
            document.getElementById('userDropdown').classList.remove('show');
        }
    });
}

// ===== AUTHENTICATION =====
async function handleRegister(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const userData = Object.fromEntries(formData);
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/auth/register/enhanced`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            authToken = result.data.token;
            localStorage.setItem('authToken', authToken);
            currentUser = result.data.user;
            
            showNotification(
                `Sveiki atvykę, ${result.data.user.name}! Registracija sėkminga.`,
                'success'
            );
            
            updateUIForUser(currentUser);
            showPage('dashboard');
            await loadDashboardData();
        } else {
            showNotification(
                result.message || 'Registracija nepavyko',
                'error'
            );
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('Klaida registruojantis. Bandykite vėliau.', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const loginData = Object.fromEntries(formData);
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loginData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            authToken = result.token;
            localStorage.setItem('authToken', authToken);
            currentUser = result.user;
            
            showNotification(
                `Sveiki sugrįžę, ${result.user.name}!`,
                'success'
            );
            
            updateUIForUser(currentUser);
            showPage('dashboard');
            await loadDashboardData();
        } else {
            showNotification(
                result.error || 'Prisijungimas nepavyko',
                'error'
            );
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Klaida prisijungiant. Bandykite vėliau.', 'error');
    } finally {
        showLoading(false);
    }
}

async function checkAuthStatus() {
    if (!authToken) return false;
    
    try {
        const response = await fetch(`${API_BASE}/auth/status`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const result = await response.json();
            currentUser = result.data.user;
            updateUIForUser(currentUser);
            return true;
        } else {
            // Token invalid
            logout();
            return false;
        }
    } catch (error) {
        console.error('Auth check error:', error);
        return false;
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    updateUIForGuest();
    showPage('home');
    showNotification('Sėkmingai atsijungėte', 'success');
}

function googleAuth() {
    window.location.href = `${API_BASE}/auth/google`;
}

// ===== UI MANAGEMENT =====
function updateUIForUser(user) {
    // Hide auth buttons, show user menu
    document.getElementById('navAuth').style.display = 'none';
    document.getElementById('navUser').style.display = 'block';
    
    // Update user info
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userAvatar').src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=007bff&color=ffffff`;
    
    // Update dashboard welcome
    document.getElementById('dashboardWelcome').textContent = `Sveiki sugrįžę, ${user.name}!`;
}

function updateUIForGuest() {
    // Show auth buttons, hide user menu
    document.getElementById('navAuth').style.display = 'flex';
    document.getElementById('navUser').style.display = 'none';
}

function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show requested page
    const targetPage = document.getElementById(pageId + 'Page');
    if (targetPage) {
        targetPage.classList.add('active');
        
        // Load page-specific data
        switch(pageId) {
            case 'dashboard':
                loadDashboardData();
                break;
            case 'create-project':
                loadCreateProjectPage();
                break;
            case 'client-projects':
                loadClientProjectsPage();
                break;
            case 'provider-projects':
                loadProviderProjectsPage();
                break;
            case 'profile':
                loadProfilePage();
                break;
        }
    }
}

function toggleUserMenu() {
    document.getElementById('userDropdown').classList.toggle('show');
}

function toggleMobileMenu() {
    document.getElementById('navMenu').classList.toggle('active');
}

// ===== DASHBOARD =====
async function loadDashboardData() {
    if (!currentUser) return;
    
    if (currentUser.role === 'CLIENT') {
        document.getElementById('clientDashboard').style.display = 'block';
        document.getElementById('providerDashboard').style.display = 'none';
        await loadClientDashboardData();
    } else {
        document.getElementById('clientDashboard').style.display = 'none';
        document.getElementById('providerDashboard').style.display = 'block';
        await loadProviderDashboardData();
    }
}

async function loadClientDashboardData() {
    try {
        // Load user projects
        const projectsResponse = await fetch(`${API_BASE}/projects/my`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (projectsResponse.ok) {
            const projectsData = await projectsResponse.json();
            const projects = projectsData.projects || [];
            
            // Update stats
            const activeProjects = projects.filter(p => p.phase === 'ACTIVE' || p.phase === 'WAITING').length;
            const completedProjects = projects.filter(p => p.phase === 'COMPLETED').length;
            const totalProposals = projects.reduce((sum, p) => sum + (p._count?.proposals || 0), 0);
            
            document.getElementById('clientActiveProjects').textContent = activeProjects;
            document.getElementById('clientCompletedProjects').textContent = completedProjects;
            document.getElementById('clientTotalProposals').textContent = totalProposals;
            
            // Show recent projects
            displayRecentProjects(projects.slice(0, 3));
        }
    } catch (error) {
        console.error('Error loading client dashboard:', error);
    }
}

async function loadProviderDashboardData() {
    try {
        // Load provider proposals
        const proposalsResponse = await fetch(`${API_BASE}/proposals/my`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (proposalsResponse.ok) {
            const proposalsData = await proposalsResponse.json();
            const proposals = proposalsData.proposals || [];
            
            // Update stats
            const activeProposals = proposals.filter(p => p.status === 'PENDING').length;
            const wonProjects = proposals.filter(p => p.status === 'ACCEPTED').length;
            
            document.getElementById('providerActiveProposals').textContent = activeProposals;
            document.getElementById('providerWonProjects').textContent = wonProjects;
            document.getElementById('providerRating').textContent = currentUser.rating?.toFixed(1) || '0.0';
        }
        
        // Load recommended projects
        const recommendedResponse = await fetch(`${API_BASE}/search/recommendations`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (recommendedResponse.ok) {
            const recommendedData = await recommendedResponse.json();
            displayRecommendedProjects(recommendedData.data.recommendations || []);
        }
    } catch (error) {
        console.error('Error loading provider dashboard:', error);
    }
}

function displayRecentProjects(projects) {
    const container = document.getElementById('clientRecentProjects');
    
    if (projects.length === 0) {
        container.innerHTML = '<p class="text-center">Dar neturite projektų. <a href="#" onclick="showPage(\'create-project\')">Sukurkite pirmą projektą!</a></p>';
        return;
    }
    
    container.innerHTML = projects.map(project => `
        <div class="project-card">
            <div class="project-title">${project.title}</div>
            <div class="project-meta">
                <span class="project-budget">${project.budgetMin || 0}€ - ${project.budgetMax || 0}€</span>
                <span class="project-status status-${project.phase.toLowerCase()}">${getStatusText(project.phase)}</span>
            </div>
            <p>${project.description.substring(0, 100)}...</p>
            <div class="mt-10">
                <small>Pasiūlymų: ${project._count?.proposals || 0}</small>
            </div>
        </div>
    `).join('');
}

function displayRecommendedProjects(projects) {
    const container = document.getElementById('providerRecommendedProjects');
    
    if (projects.length === 0) {
        container.innerHTML = '<p class="text-center">Šiuo metu nėra rekomenduojamų projektų.</p>';
        return;
    }
    
    container.innerHTML = projects.map(project => `
        <div class="project-card">
            <div class="project-title">${project.title}</div>
            <div class="project-meta">
                <span class="project-budget">${project.budgetMin || 0}€ - ${project.budgetMax || 0}€</span>
                <span class="project-status status-${project.phase.toLowerCase()}">${getStatusText(project.phase)}</span>
            </div>
            <p>${project.description.substring(0, 100)}...</p>
            <div class="mt-10">
                <small>Rekomendacijos priežastis: ${project.recommendationReason || 'Tinka jums'}</small>
            </div>
        </div>
    `).join('');
}

// ===== CREATE PROJECT PAGE =====
function loadCreateProjectPage() {
    if (!currentUser || currentUser.role !== 'CLIENT') {
        showNotification('Tik klientai gali kurti projektus', 'error');
        showPage('home');
        return;
    }
    
    document.getElementById('createProjectPage').innerHTML = `
        <div class="form-container">
            <div class="form-card">
                <h2><i class="fas fa-plus"></i> Sukurti naują projektą</h2>
                <form id="createProjectForm">
                    <div class="form-group">
                        <label for="projectTitle">Projekto pavadinimas *</label>
                        <input type="text" id="projectTitle" name="title" required 
                               placeholder="Pvz., Vonios kambario remontas">
                    </div>
                    
                    <div class="form-group">
                        <label for="projectDescription">Detalus aprašymas *</label>
                        <textarea id="projectDescription" name="description" required 
                                  placeholder="Aprašykite detales, ką reikia padaryti, kokius rezultatus tikitės...">
                        </textarea>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="projectCategory">Kategorija *</label>
                            <select id="projectCategory" name="category" required>
                                <option value="">Pasirinkite kategoriją...</option>
                                <option value="construction">Statyba ir remontas</option>
                                <option value="electrical">Elektros darbai</option>
                                <option value="plumbing">Santechnikos darbai</option>
                                <option value="painting">Dažymo darbai</option>
                                <option value="cleaning">Valymo paslaugos</option>
                                <option value="garden">Sodo darbai</option>
                                <option value="design">Dizaino paslaugos</option>
                                <option value="it">IT paslaugos</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="projectPriority">Prioritetas *</label>
                            <select id="projectPriority" name="priority" required>
                                <option value="">Pasirinkite...</option>
                                <option value="PRICE">Kaina</option>
                                <option value="SPEED">Greitis</option>
                                <option value="EXPERIENCE">Patirtis</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="budgetMin">Minimalus biudžetas (€) *</label>
                            <input type="number" id="budgetMin" name="budgetMin" required min="1">
                        </div>
                        
                        <div class="form-group">
                            <label for="budgetMax">Maksimalus biudžetas (€) *</label>
                            <input type="number" id="budgetMax" name="budgetMax" required min="1">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="projectDeadline">Pageidaujamas užbaigimo terminas *</label>
                            <input type="date" id="projectDeadline" name="deadline" required 
                                   min="${new Date().toISOString().split('T')[0]}">
                        </div>
                        
                        <div class="form-group">
                            <label for="projectCity">Miestas</label>
                            <input type="text" id="projectCity" name="city" 
                                   placeholder="Kur vykdomi darbai">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="projectLocation">Detalus adresas</label>
                        <input type="text" id="projectLocation" name="location" 
                               placeholder="Gatvė, namo numeris (neprivaloma)">
                    </div>
                    
                    <button type="submit" class="btn btn-primary btn-full">Sukurti projektą</button>
                </form>
            </div>
        </div>
    `;
    
    // Add form submission handler
    document.getElementById('createProjectForm').addEventListener('submit', handleCreateProject);
}

async function handleCreateProject(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const projectData = Object.fromEntries(formData);
    
    // Add budget range
    projectData.budgetRange = `${projectData.budgetMin}€ - ${projectData.budgetMax}€`;
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(projectData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Projektas sėkmingai sukurtas!', 'success');
            showPage('dashboard');
            await loadDashboardData();
        } else {
            showNotification(result.error || 'Nepavyko sukurti projekto', 'error');
        }
    } catch (error) {
        console.error('Create project error:', error);
        showNotification('Klaida kuriant projektą. Bandykite vėliau.', 'error');
    } finally {
        showLoading(false);
    }
}

// ===== CLIENT PROJECTS PAGE =====
function loadClientProjectsPage() {
    if (!currentUser || currentUser.role !== 'CLIENT') {
        showNotification('Prieiga uždrausta', 'error');
        showPage('home');
        return;
    }
    
    document.getElementById('clientProjectsPage').innerHTML = `
        <div class="container" style="padding: 40px 20px;">
            <div class="dashboard-header">
                <h1><i class="fas fa-list"></i> Mano projektai</h1>
                <button class="btn btn-primary" onclick="showPage('create-project')">
                    <i class="fas fa-plus"></i> Sukurti naują projektą
                </button>
            </div>
            
            <div class="projects-filter">
                <button class="btn btn-outline" onclick="filterClientProjects('all')" id="filterAll">Visi</button>
                <button class="btn btn-outline" onclick="filterClientProjects('WAITING')" id="filterWaiting">Laukiantys</button>
                <button class="btn btn-outline" onclick="filterClientProjects('ACTIVE')" id="filterActive">Aktyvūs</button>
                <button class="btn btn-outline" onclick="filterClientProjects('COMPLETED')" id="filterCompleted">Baigti</button>
            </div>
            
            <div id="clientProjectsList" class="projects-list">
                <div class="text-center">Kraunama...</div>
            </div>
        </div>
    `;
    
    loadClientProjects();
}

async function loadClientProjects(filter = 'all') {
    try {
        const response = await fetch(`${API_BASE}/projects/my`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            let projects = data.projects || [];
            
            if (filter !== 'all') {
                projects = projects.filter(p => p.phase === filter);
            }
            
            displayClientProjects(projects);
        }
    } catch (error) {
        console.error('Error loading client projects:', error);
        document.getElementById('clientProjectsList').innerHTML = 
            '<div class="text-center">Klaida kraunant projektus</div>';
    }
}

function displayClientProjects(projects) {
    const container = document.getElementById('clientProjectsList');
    
    if (projects.length === 0) {
        container.innerHTML = `
            <div class="text-center" style="padding: 40px;">
                <i class="fas fa-folder-open" style="font-size: 3rem; color: #ccc; margin-bottom: 20px;"></i>
                <h3>Nėra projektų</h3>
                <p>Dar neturite projektų šioje kategorijoje.</p>
                <button class="btn btn-primary" onclick="showPage('create-project')">
                    <i class="fas fa-plus"></i> Sukurti pirmą projektą
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = projects.map(project => `
        <div class="project-card">
            <div class="project-header">
                <div class="project-title">${project.title}</div>
                <span class="project-status status-${project.phase.toLowerCase()}">${getStatusText(project.phase)}</span>
            </div>
            
            <div class="project-meta">
                <span class="project-budget">${project.budgetMin || 0}€ - ${project.budgetMax || 0}€</span>
                <span>Kategorija: ${getCategoryText(project.category)}</span>
            </div>
            
            <p class="project-description">${project.description.substring(0, 150)}...</p>
            
            <div class="project-stats">
                <div class="stat-item">
                    <i class="fas fa-file-alt"></i>
                    <span>${project._count?.proposals || 0} pasiūlymų</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-calendar"></i>
                    <span>Sukurta: ${new Date(project.createdAt).toLocaleDateString('lt-LT')}</span>
                </div>
                ${project.timing ? `
                <div class="stat-item">
                    <i class="fas fa-clock"></i>
                    <span>${project.timing.message}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="project-actions">
                <button class="btn btn-outline" onclick="viewProjectDetails('${project.id}')">
                    <i class="fas fa-eye"></i> Peržiūrėti
                </button>
                ${project.phase === 'ACTIVE' ? `
                <button class="btn btn-primary" onclick="viewProposals('${project.id}')">
                    <i class="fas fa-handshake"></i> Pasiūlymai (${project._count?.proposals || 0})
                </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// ===== PROVIDER PROJECTS PAGE =====
function loadProviderProjectsPage() {
    if (!currentUser || currentUser.role !== 'PROVIDER') {
        showNotification('Prieiga uždrausta', 'error');
        showPage('home');
        return;
    }
    
    document.getElementById('providerProjectsPage').innerHTML = `
        <div class="container" style="padding: 40px 20px;">
            <div class="dashboard-header">
                <h1><i class="fas fa-search"></i> Ieškoti projektų</h1>
                <p>Raskite projektus, kurie tinka jūsų specializacijai</p>
            </div>
            
            <div class="search-filters" style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 30px;">
                <div class="form-row">
                    <div class="form-group">
                        <label for="searchQuery">Paieška</label>
                        <input type="text" id="searchQuery" placeholder="Ieškoti pagal raktažodžius...">
                    </div>
                    <div class="form-group">
                        <label for="searchCategory">Kategorija</label>
                        <select id="searchCategory">
                            <option value="">Visos kategorijos</option>
                            <option value="construction">Statyba ir remontas</option>
                            <option value="electrical">Elektros darbai</option>
                            <option value="plumbing">Santechnikos darbai</option>
                            <option value="painting">Dažymo darbai</option>
                            <option value="cleaning">Valymo paslaugos</option>
                            <option value="garden">Sodo darbai</option>
                            <option value="design">Dizaino paslaugos</option>
                            <option value="it">IT paslaugos</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="searchLocation">Miestas</label>
                        <input type="text" id="searchLocation" placeholder="Miestas...">
                    </div>
                    <div class="form-group">
                        <label for="searchSort">Rūšiuoti pagal</label>
                        <select id="searchSort">
                            <option value="ending_soon">Baigiasi greitai</option>
                            <option value="newest">Naujausi</option>
                            <option value="budget_high">Aukščiausias biudžetas</option>
                            <option value="budget_low">Žemiausias biudžetas</option>
                        </select>
                    </div>
                </div>
                
                <button class="btn btn-primary" onclick="searchProjects()">Ieškoti</button>
            </div>
            
            <div id="providerProjectsList" class="projects-list">
                <div class="text-center">Kraunama...</div>
            </div>
        </div>
    `;
    
    searchProjects();
}

async function searchProjects() {
    const query = document.getElementById('searchQuery')?.value || '';
    const category = document.getElementById('searchCategory')?.value || '';
    const location = document.getElementById('searchLocation')?.value || '';
    const sortBy = document.getElementById('searchSort')?.value || 'ending_soon';
    
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (category) params.append('category', category);
    if (location) params.append('location', location);
    params.append('sortBy', sortBy);
    params.append('limit', '20');
    
    try {
        const response = await fetch(`${API_BASE}/search/projects?${params}`);
        
        if (response.ok) {
            const data = await response.json();
            displayProviderProjects(data.data.projects || []);
        }
    } catch (error) {
        console.error('Error searching projects:', error);
        document.getElementById('providerProjectsList').innerHTML = 
            '<div class="text-center">Klaida ieškant projektų</div>';
    }
}

function displayProviderProjects(projects) {
    const container = document.getElementById('providerProjectsList');
    
    if (projects.length === 0) {
        container.innerHTML = `
            <div class="text-center" style="padding: 40px;">
                <i class="fas fa-search" style="font-size: 3rem; color: #ccc; margin-bottom: 20px;"></i>
                <h3>Projektų nerasta</h3>
                <p>Pakeiskite paieškos kriterijus ir bandykite dar kartą.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = projects.map(project => `
        <div class="project-card">
            <div class="project-header">
                <div class="project-title">${project.title}</div>
                <span class="project-status status-${project.phase.toLowerCase()}">${getStatusText(project.phase)}</span>
            </div>
            
            <div class="project-meta">
                <span class="project-budget">${project.budgetMin || 0}€ - ${project.budgetMax || 0}€</span>
                <span>Kategorija: ${getCategoryText(project.category)}</span>
            </div>
            
            <p class="project-description">${project.description.substring(0, 150)}...</p>
            
            <div class="project-client">
                <div class="client-info">
                    <img src="${project.client.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(project.client.name)}&background=007bff&color=ffffff`}" alt="${project.client.name}" class="client-avatar">
                    <div>
                        <div class="client-name">${project.client.name}</div>
                        <div class="client-location">${project.client.city || 'Nenurodytas miestas'}</div>
                    </div>
                </div>
            </div>
            
            <div class="project-stats">
                <div class="stat-item">
                    <i class="fas fa-handshake"></i>
                    <span>${project.statistics?.totalBids || 0} konkurentų</span>
                </div>
                ${project.timing ? `
                <div class="stat-item">
                    <i class="fas fa-clock"></i>
                    <span>${project.timing.message}</span>
                </div>
                ` : ''}
                ${project.statistics?.lowestBid ? `
                <div class="stat-item">
                    <i class="fas fa-euro-sign"></i>
                    <span>Žem. pasiūlymas: ${project.statistics.lowestBid}€</span>
                </div>
                ` : ''}
            </div>
            
            <div class="project-actions">
                <button class="btn btn-outline" onclick="viewProjectDetails('${project.id}')">
                    <i class="fas fa-eye"></i> Peržiūrėti
                </button>
                <button class="btn btn-primary" onclick="createProposal('${project.id}')">
                    <i class="fas fa-paper-plane"></i> Pateikti pasiūlymą
                </button>
            </div>
        </div>
    `).join('');
}

// ===== PROFILE PAGE =====
function loadProfilePage() {
    if (!currentUser) {
        showNotification('Prieiga uždrausta', 'error');
        showPage('home');
        return;
    }
    
    document.getElementById('profilePage').innerHTML = `
        <div class="form-container">
            <div class="form-card">
                <h2><i class="fas fa-user"></i> Mano profilis</h2>
                
                <div class="profile-avatar" style="text-align: center; margin-bottom: 30px;">
                    <img src="${currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=007bff&color=ffffff&size=120`}" 
                         alt="${currentUser.name}" 
                         style="width: 120px; height: 120px; border-radius: 50%; border: 4px solid #007bff;">
                    <h3 style="margin: 15px 0 5px;">${currentUser.name}</h3>
                    <p style="color: #666;">${currentUser.role === 'CLIENT' ? 'Klientas' : 'Paslaugų teikėjas'}</p>
                </div>
                
                <form id="profileForm">
                    <div class="form-group">
                        <label for="profileName">Vardas ir pavardė</label>
                        <input type="text" id="profileName" name="name" value="${currentUser.name}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="profileEmail">El. paštas</label>
                        <input type="email" id="profileEmail" value="${currentUser.email}" disabled 
                               style="background: #f8f9fa; color: #6c757d;">
                        <small>El. pašto keisti negalima</small>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="profilePhone">Telefono numeris</label>
                            <input type="tel" id="profilePhone" name="phone" value="${currentUser.phone || ''}">
                        </div>
                        
                        <div class="form-group">
                            <label for="profileCity">Miestas</label>
                            <input type="text" id="profileCity" name="city" value="${currentUser.city || ''}">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="profileDescription">Aprašymas</label>
                        <textarea id="profileDescription" name="description" 
                                  placeholder="Papasakokite apie save...">${currentUser.description || ''}</textarea>
                    </div>
                    
                    ${currentUser.role === 'PROVIDER' ? `
                    <div class="form-group">
                        <label for="profileWebsite">Svetainė</label>
                        <input type="url" id="profileWebsite" name="website" 
                               value="${currentUser.website || ''}" 
                               placeholder="https://www.pavyzdys.lt">
                    </div>
                    ` : ''}
                    
                    <button type="submit" class="btn btn-primary btn-full">Atnaujinti profilį</button>
                </form>
            </div>
        </div>
    `;
    
    document.getElementById('profileForm').addEventListener('submit', handleUpdateProfile);
}

async function handleUpdateProfile(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const profileData = Object.fromEntries(formData);
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/users/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(profileData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            currentUser = { ...currentUser, ...result.user };
            updateUIForUser(currentUser);
            showNotification('Profilis sėkmingai atnaujintas!', 'success');
        } else {
            showNotification(result.error || 'Nepavyko atnaujinti profilio', 'error');
        }
    } catch (error) {
        console.error('Update profile error:', error);
        showNotification('Klaida atnaujinant profilį. Bandykite vėliau.', 'error');
    } finally {
        showLoading(false);
    }
}

// ===== UTILITY FUNCTIONS =====
async function loadMarketplaceStats() {
    try {
        const response = await fetch(`${API_BASE}/search/stats`);
        
        if (response.ok) {
            const data = await response.json();
            const stats = data.data.marketplace;
            
            document.getElementById('activeProjectsCount').textContent = stats.activeProjects || 0;
            document.getElementById('totalProvidersCount').textContent = stats.totalProviders || 0;
            document.getElementById('completedProjectsCount').textContent = stats.completedProjects || 0;
        }
    } catch (error) {
        console.error('Error loading marketplace stats:', error);
    }
}

function getStatusText(phase) {
    const statusMap = {
        'WAITING': 'Laukiantis',
        'ACTIVE': 'Aktyvus',
        'ENDED': 'Pasibaigė',
        'COMPLETED': 'Baigtas',
        'CANCELLED': 'Atšauktas',
        'AWARDED': 'Laimėtojas pasirinktas'
    };
    return statusMap[phase] || phase;
}

function getCategoryText(category) {
    const categoryMap = {
        'construction': 'Statyba ir remontas',
        'electrical': 'Elektros darbai',
        'plumbing': 'Santechnikos darbai',
        'painting': 'Dažymo darbai',
        'cleaning': 'Valymo paslaugos',
        'garden': 'Sodo darbai',
        'design': 'Dizaino paslaugos',
        'it': 'IT paslaugos'
    };
    return categoryMap[category] || category;
}

function showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notificationContainer');
    const id = 'notification-' + Date.now();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.id = id;
    notification.innerHTML = `
        <div class="notification-header">
            <span class="notification-title">${type === 'success' ? 'Sėkmingai' : type === 'error' ? 'Klaida' : 'Pranešimas'}</span>
            <button class="notification-close" onclick="closeNotification('${id}')">&times;</button>
        </div>
        <div class="notification-message">${message}</div>
    `;
    
    container.appendChild(notification);
    
    // Auto-remove after duration
    setTimeout(() => {
        closeNotification(id);
    }, duration);
}

function closeNotification(id) {
    const notification = document.getElementById(id);
    if (notification) {
        notification.remove();
    }
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('show');
    } else {
        overlay.classList.remove('show');
    }
}

// ===== PLACEHOLDER FUNCTIONS =====
function viewProjectDetails(projectId) {
    showNotification('Projekto peržiūros funkcija dar kuriama', 'info');
}

function viewProposals(projectId) {
    showNotification('Pasiūlymų peržiūros funkcija dar kuriama', 'info');
}

function createProposal(projectId) {
    showNotification('Pasiūlymo kūrimo funkcija dar kuriama', 'info');
}

function filterClientProjects(filter) {
    // Remove active class from all filter buttons
    document.querySelectorAll('.projects-filter .btn').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
    });
    
    // Add active class to selected filter
    const activeBtn = document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1).toLowerCase()}`) ||
                     document.getElementById('filterAll');
    if (activeBtn) {
        activeBtn.classList.remove('btn-outline');
        activeBtn.classList.add('btn-primary');
    }
    
    loadClientProjects(filter);
}

