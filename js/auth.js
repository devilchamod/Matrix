import { supabase } from './supabase.js';

/* ---------- DOM HELPERS ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(msg, type = 'error') {
    const t = $('#toast');
    t.innerText = msg;
    t.className = `toast ${type}`;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), 3500);
}

function setLoading(btn, loading, text) {
    if (loading) {
        btn.dataset.originalText = btn.innerText;
        btn.innerText = text || 'Working...';
        btn.disabled = true;
    } else {
        btn.innerText = btn.dataset.originalText || btn.innerText;
        btn.disabled = false;
    }
}

/* ---------- VIEW SWITCHING ---------- */
function switchAuthView(view) {
    $('#loginView').classList.toggle('hidden', view !== 'login');
    $('#registerView').classList.toggle('hidden', view !== 'register');
}

function showApp(user) {
    $('#authScreen').classList.add('hidden');
    $('#appShell').classList.remove('hidden');

    const displayName = user.user_metadata?.display_name
    || user.user_metadata?.username
    || user.email
    || 'Entity';

    $('#appUserName').innerText = displayName;
    $('#welcomeUser').innerText = displayName;

    const avatarUrl = user.user_metadata?.avatar_url
    || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.id}`;
    $('#appUserAvatar').src = avatarUrl;

    // Hide any visible toasts on login
    $('#toast').classList.add('hidden');
}

function showAuth() {
    $('#appShell').classList.add('hidden');
    $('#authScreen').classList.remove('hidden');
}

/* ---------- PASSWORD TOGGLE ---------- */
$$('.pass-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.toggle);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        btn.innerText = input.type === 'password' ? '👁️' : '🙈';
    });
});

/* ---------- VIEW LINK BUTTONS ---------- */
$$('[data-view]').forEach(el => {
    el.addEventListener('click', () => switchAuthView(el.dataset.view));
});

/* ---------- AVATAR PREVIEW ---------- */
$('#regAvatarFile')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { $('#regAvatarPreview').src = ev.target.result; };
    reader.readAsDataURL(file);
});

/* ---------- REGISTER ---------- */
$('#registerBtn').addEventListener('click', async () => {
    const btn = $('#registerBtn');

    const username = $('#regUsername').value.trim().toLowerCase();
    const displayName = $('#regDisplayName').value.trim();
    const password = $('#regPassword').value;
    const confirm = $('#regConfirmPassword').value;
    const avatarFile = $('#regAvatarFile').files?.[0];

    // Validation
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
        return showToast('Username must be 3–24 chars: a-z, 0-9, underscore');
    }
    if (!displayName || displayName.length < 1 || displayName.length > 32) {
        return showToast('Display name must be 1–32 characters');
    }
    if (password.length < 8) {
        return showToast('Password must be at least 8 characters');
    }
    if (password !== confirm) {
        return showToast('Passwords do not match');
    }

    setLoading(btn, true, 'Materializing...');

    try {
        // Check if username already exists (public read is allowed for authed users only,
        // but we can query before signup if we allow anon read — we don't, so we handle
        // the unique constraint error after signup instead).
        // For now, skip pre-check and handle the error post-signup.

        let avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`;

        // Upload avatar if provided (needs a storage bucket — we'll add later)
        // For v1, we just use the dicebear fallback. Storage comes in a later phase.

        const { data, error } = await supabase.auth.signUp({
            email: `${username}@nexus.local`,   // synthetic email — Supabase requires one
            password,
            options: {
                data: {
                    username,
                    display_name: displayName,
                    avatar_url: avatarUrl,
                },
            },
        });

        if (error) {
            // Handle unique-username collision
            if (error.message?.toLowerCase().includes('already')) {
                return showToast('That username is taken');
            }
            throw error;
        }

        if (!data.user) {
            return showToast('Signup did not return a user');
        }

        // If email confirmation is required, session will be null.
        if (!data.session) {
            showToast('Entity created. Check your email to confirm.', 'success');
            setTimeout(() => switchAuthView('login'), 1200);
        } else {
            showToast('Entity manifested', 'success');
            showApp(data.user);
        }
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Registration failed');
    } finally {
        setLoading(btn, false);
    }
});

/* ---------- LOGIN ---------- */
$('#loginBtn').addEventListener('click', async () => {
    const btn = $('#loginBtn');
    const username = $('#loginUsername').value.trim().toLowerCase();
    const password = $('#loginPassword').value;

    if (!username || !password) {
        return showToast('Enter username and password');
    }

    setLoading(btn, true, 'Linking...');

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: `${username}@nexus.local`,
            password,
        });

        if (error) {
            // Don't leak whether user exists
            return showToast('Invalid username or password');
        }

        showToast('Link established', 'success');
        showApp(data.user);
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Login failed');
    } finally {
        setLoading(btn, false);
    }
});

/* ---------- ENTER KEY SUBMITS ---------- */
$('#loginPassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#loginBtn').click();
});
$('#regConfirmPassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#registerBtn').click();
});

/* ---------- LOGOUT ---------- */
$('#logoutBtn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    showAuth();
    showToast('Disconnected', 'success');
});

/* ---------- SESSION BOOTSTRAP ---------- */
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        showApp(session.user);
    } else {
        showAuth();
    }
})();

/* ---------- AUTH STATE CHANGES ---------- */
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
        showAuth();
    } else if (event === 'SIGNED_IN' && session?.user) {
        showApp(session.user);
    }
});
