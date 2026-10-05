const $ = s => document.querySelector(s);
let token = localStorage.getItem('token'), me = null, current = () => { }, feedURL = '';
let tab = localStorage.getItem('defTab') || 'all';
let draft = { image: null, feeling: '', poll: false };

const EYE = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="3" y1="3" x2="21" y2="21"/></svg>`;
const DOTS = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`;
const FEELINGS = ['😊 Happy', '😍 Loved', '😎 Cool', '🥳 Excited', '😢 Sad', '😴 Tired', '😡 Angry', '🤩 Amazed'];
const BADGE = { photo: '🖼️ Photo', poll: '📊 Poll', feeling: '😊 Mood' };
const MOODBG = ['#7c3aed,#ec4899', '#f97316,#ec4899', '#06b6d4,#7c3aed', '#10b981,#06b6d4', '#f59e0b,#ef4444'];
const TABS = [['all', '🌍 All'], ['following', '👥 Following'], ['photo', '🖼️ Photos'], ['poll', '📊 Polls'], ['feeling', '😊 Moods']];
const ACCENTS = { purple: ['#7c3aed', '#ec4899'], ocean: ['#0ea5e9', '#6366f1'], sunset: ['#f97316', '#ec4899'], forest: ['#10b981', '#0ea5a4'] };

// ---------- THEME ----------
function applyTheme() {
    const root = document.documentElement;
    root.dataset.theme = localStorage.getItem('theme') || 'light';
    const [a, b] = ACCENTS[localStorage.getItem('accent')] || ACCENTS.purple;
    root.style.setProperty('--p', a);
    root.style.setProperty('--pink', b);
    root.style.setProperty('--grad', `linear-gradient(135deg,${a},${b})`);
}
applyTheme();

// ---------- HELPERS ----------
async function api(url, method = 'GET', body) {
    const r = await fetch('/api' + url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: body ? JSON.stringify(body) : undefined
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Something went wrong');
    return d;
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const color = n => `hsl(${[...n].reduce((a, c) => a + c.charCodeAt(0), 0) * 37 % 360},65%,50%)`;
const avatar = (n, img, cls = '') => img
    ? `<img class="avatar ${cls}" src="${esc(img)}" alt="${esc(n)}">`
    : `<div class="avatar ${cls}" style="background:${color(n)}">${esc(n[0].toUpperCase())}</div>`;
function ago(s) {
    const m = Math.floor((Date.now() - new Date(s.replace(' ', 'T') + 'Z')) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    if (m < 1440) return Math.floor(m / 60) + 'h ago';
    return Math.floor(m / 1440) + 'd ago';
}
function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}
function readImage(file, max = 1000, square = false) {
    return new Promise((ok, no) => {
        const r = new FileReader();
        r.onload = () => {
            const img = new Image();
            img.onload = () => {
                const c = document.createElement('canvas'), x = c.getContext('2d');
                if (square) {
                    const s = Math.min(img.width, img.height);
                    c.width = c.height = Math.min(max, s);
                    x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, c.width, c.height);
                } else {
                    const k = Math.min(1, max / Math.max(img.width, img.height));
                    c.width = img.width * k; c.height = img.height * k;
                    x.drawImage(img, 0, 0, c.width, c.height);
                }
                ok(c.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = no; img.src = r.result;
        };
        r.onerror = no; r.readAsDataURL(file);
    });
}
function bindEyes() {
    document.querySelectorAll('[data-eye]').forEach(b => b.onclick = () => {
        const inp = $('#' + b.dataset.eye), show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        b.innerHTML = show ? EYE_OFF : EYE;
    });
}
const eyeBtn = id => `<button type="button" class="eye" data-eye="${id}" title="Show / Hide password">${EYE}</button>`;

// ---------- ROUTER (back button support) ----------
function navTo(h) { if (location.hash === h) route(); else location.hash = h; }
function route() {
    if (!me) return authPage();
    const [pg, arg] = location.hash.replace(/^#\/?/, '').split('/');
    window.scrollTo(0, 0);
    if (pg === 'profile' && arg) profile(decodeURIComponent(arg));
    else if (pg === 'settings') settings();
    else home();
}
window.addEventListener('hashchange', () => { if (me) route(); });

function logout() {
    localStorage.removeItem('token'); token = me = null;
    history.replaceState(null, '', '#/');
    authPage();
}

// ---------- NAVBAR ----------
function nav() {
    $('#nav').innerHTML = me
        ? `<div class="nav-in"><a class="logo" data-go="home">✨ Buzzly</a>
       <div class="nav-r"><a data-go="home">🏠 Home</a>
       <a data-profile="${esc(me.username)}">${avatar(me.username, me.avatar, 'sm')} Profile</a>
       <a data-go="settings">⚙️ Settings</a>
       <button class="btn small ghost" id="logout">Logout</button></div></div>`
        : '';
}

// ---------- AUTH PAGE ----------
function authPage(mode = 'login') {
    nav();
    const reg = mode === 'register';
    $('#app').innerHTML = `<div class="auth-wrap">
    <section class="hero">
      <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
      <div class="fl fl1">❤️ 2.4k likes</div><div class="fl fl2">📊 78% voted</div>
      <div class="hero-in">
        <div class="brand">✨ Buzzly</div>
        <h2>Connect. Share.<br>Get Buzzing.</h2>
        <p>Post photos, create polls, share your mood and follow people you love, all in one colourful place.</p>
        <div class="feats"><span>📸 Photos</span><span>📊 Polls</span><span>😊 Moods</span><span>💬 Comments</span><span>👥 Follow</span></div>
      </div>
    </section>
    <section class="form-side"><div class="auth-card">
      <div class="seg"><button data-mode="login" class="${reg ? '' : 'on'}">Login</button><button data-mode="register" class="${reg ? 'on' : ''}">Register</button></div>
      <h2>${reg ? 'Create your account 🚀' : 'Welcome back 👋'}</h2>
      <p class="sub">${reg ? 'Join Buzzly and start sharing in seconds.' : 'Login to see what your friends are posting.'}</p>
      <div class="field"><i>👤</i><input id="u" placeholder="Username" autocomplete="username"></div>
      <div class="field"><i>🔒</i><input id="p" type="password" placeholder="Password" autocomplete="${reg ? 'new-password' : 'current-password'}">${eyeBtn('p')}</div>
      ${reg ? `<div class="field"><i>🔐</i><input id="p2" type="password" placeholder="Confirm password" autocomplete="new-password">${eyeBtn('p2')}</div>` : ''}
      <button class="btn big" id="go">${reg ? 'Create Account' : 'Login'}</button>
      <p class="swap">${reg ? 'Already have an account?' : 'New here?'} <a id="sw">${reg ? 'Login' : 'Register'}</a></p>
    </div></section></div>`;

    document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => authPage(b.dataset.mode));
    $('#sw').onclick = () => authPage(reg ? 'login' : 'register');
    bindEyes();
    const submit = async () => {
        try {
            if (reg && $('#p').value !== $('#p2').value) throw new Error('Passwords do not match');
            const d = await api(reg ? '/register' : '/login', 'POST', { username: $('#u').value.trim(), password: $('#p').value });
            token = d.token; localStorage.setItem('token', token); start();
        } catch (e) { toast(e.message); }
    };
    $('#go').onclick = submit;
    document.querySelectorAll('.field input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') submit(); });
}

// ---------- POSTS ----------
function postHTML(p) {
    const mine = me.username === p.username;
    const mood = p.type === 'feeling' && !p.image;
    const [emoji, ...rest] = (p.feeling || '').split(' ');
    let body = '';
    if (mood) {
        body = `<div class="mood" style="background:linear-gradient(135deg,${MOODBG[p.id % MOODBG.length]})">
      <div class="big">${esc(emoji)}</div>${p.content ? `<p>${esc(p.content)}</p>` : ''}<span>Feeling ${esc(rest.join(' '))}</span></div>`;
    } else {
        if (p.content) body += `<p class="content">${esc(p.content)}</p>`;
        if (p.image) body += `<img class="pimg" src="${esc(p.image)}" alt="post photo" loading="lazy" onerror="this.style.display='none'">`;
        if (p.poll) {
            const total = p.poll.reduce((a, o) => a + o.votes, 0), voted = p.myVote !== null;
            body += `<div class="poll">${p.poll.map((o, i) => {
                const pc = total ? Math.round(o.votes * 100 / total) : 0;
                return `<button class="opt ${p.myVote === i ? 'mine' : ''}" data-vote="${p.id}" data-opt="${i}">
          <span class="bar" style="width:${voted ? pc : 0}%"></span><span class="radio"></span><span class="ot">${esc(o.text)}</span><b>${voted ? pc + '%' : ''}</b></button>`;
            }).join('')}<small>${total} vote${total === 1 ? '' : 's'}${voted ? '' : ' · tap to vote'}</small></div>`;
        }
    }
    return `<article class="card post"><div class="post-h">${avatar(p.username, p.avatar)}
    <div class="pinfo"><a class="uname" data-profile="${esc(p.username)}">@${esc(p.username)}</a>
    <small>${ago(p.created_at)}${p.feeling && !mood ? ' · feeling ' + esc(p.feeling) : ''}</small></div>
    ${BADGE[p.type] ? `<span class="badge">${BADGE[p.type]}</span>` : ''}
    ${mine ? `<div class="more"><button class="dots" data-menu="${p.id}" title="More">${DOTS}</button>
      <div class="dd" id="dd-${p.id}"><button data-edit="${p.id}">✏️ Edit post</button><button class="red" data-del="${p.id}">🗑️ Delete post</button></div></div>` : ''}
    </div>
    <div class="pbody" id="pb-${p.id}" data-raw="${esc(p.content)}">${body}</div>
    <div class="post-f">
      <button class="act ${p.liked ? 'liked' : ''}" data-like="${p.id}">${p.liked ? '❤️' : '🤍'} <b>${p.likes}</b></button>
      <button class="act" data-cm="${p.id}">💬 <b id="cc-${p.id}">${p.comments}</b></button>
    </div><div class="cm hidden" id="cm-${p.id}"></div></article>`;
}

async function loadFeed(url, empty) {
    feedURL = url;
    const posts = await api(url);
    $('#feed').innerHTML = posts.length ? posts.map(postHTML).join('')
        : `<div class="empty">${empty || '😴 No posts here yet.'}</div>`;
}

async function loadComments(id) {
    const list = await api(`/posts/${id}/comments`);
    $('#cm-' + id).innerHTML = list.map(c => `<div class="c-item">${avatar(c.username, c.avatar)}
    <div class="c-body"><b data-profile="${esc(c.username)}">@${esc(c.username)}</b> <small>${ago(c.created_at)}</small><br>${esc(c.content)}</div></div>`).join('')
        + `<div class="c-new"><input id="ci-${id}" placeholder="Write a comment..." maxlength="300">
       <button class="btn small" data-sendcm="${id}">Send</button></div>`;
    $('#cc-' + id).textContent = list.length;
}

// ---------- HOME ----------
function showPreview() {
    $('#preview').innerHTML = draft.image
        ? `<div class="pv"><img src="${draft.image}" alt=""><button class="x" id="rmimg" type="button">✕</button></div>` : '';
    if (draft.image) $('#rmimg').onclick = () => { draft.image = null; showPreview(); };
}

async function home() {
    current = home; nav();
    draft = { image: null, feeling: '', poll: false };
    $('#app').innerHTML = `<div class="layout">
    <aside class="left"><div class="card mini">${avatar(me.username, me.avatar, 'big2')}
      <b>@${esc(me.username)}</b><small>${esc(me.bio || 'No bio yet')}</small>
      <a class="btn small ghost" data-profile="${esc(me.username)}">View profile</a></div>
      <div class="card menu"><a data-go="home">🏠 Home</a><a data-profile="${esc(me.username)}">👤 My Profile</a>
      <a data-tab="photo">🖼️ Photos</a><a data-tab="poll">📊 Polls</a><a data-tab="feeling">😊 Moods</a>
      <a data-go="settings">⚙️ Settings</a></div></aside>
    <section>
      <div class="card composer-box">
        <div class="c-top">${avatar(me.username, me.avatar)}
          <textarea id="txt" maxlength="500" placeholder="What's on your mind, ${esc(me.username)}?"></textarea></div>
        <div id="preview"></div>
        <div id="pollbox" class="hidden"><small>Poll options (2 to 4)</small>
          <input class="po" placeholder="Option 1" maxlength="60"><input class="po" placeholder="Option 2" maxlength="60">
          <input class="po" placeholder="Option 3 (optional)" maxlength="60"><input class="po" placeholder="Option 4 (optional)" maxlength="60"></div>
        <div id="feelbox" class="hidden">${FEELINGS.map(f => `<button type="button" class="chip" data-feel="${f}">${f}</button>`).join('')}</div>
        <div class="row"><div class="tools">
          <button type="button" class="tool" id="tPhoto">🖼️ Photo</button>
          <button type="button" class="tool" id="tPoll">📊 Poll</button>
          <button type="button" class="tool" id="tFeel">😊 Feeling</button></div>
          <button class="btn" id="post">Post</button></div>
        <input type="file" id="file" accept="image/*" hidden>
      </div>
      <div class="tabs">${TABS.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="feed"></div></section>
    <aside class="card" id="side"><h3>People to follow</h3>
      <input id="q" placeholder="🔍 Search users..." style="margin-top:12px"><div id="sug"></div></aside></div>`;

    $('#tPhoto').onclick = () => $('#file').click();
    $('#file').onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
            draft.image = await readImage(f); draft.poll = false;
            $('#pollbox').classList.add('hidden'); showPreview();
        } catch { toast('Invalid image'); }
    };
    $('#tPoll').onclick = () => {
        draft.poll = !draft.poll;
        $('#pollbox').classList.toggle('hidden', !draft.poll);
        if (draft.poll) { draft.image = null; showPreview(); }
    };
    $('#tFeel').onclick = () => $('#feelbox').classList.toggle('hidden');
    $('#post').onclick = async () => {
        const body = { content: $('#txt').value, feeling: draft.feeling };
        if (draft.poll) body.options = [...document.querySelectorAll('.po')].map(i => i.value.trim()).filter(Boolean);
        else if (draft.image) body.image = draft.image;
        try { await api('/posts', 'POST', body); toast('Posted! 🎉'); home(); }
        catch (e) { toast(e.message); }
    };
    $('#q').oninput = e => loadUsers(e.target.value);
    loadUsers('');
    const empties = {
        following: '👥 Follow some people from the right side to see their posts here.',
        photo: '🖼️ No photo posts yet.', poll: '📊 No polls yet.', feeling: '😊 No mood posts yet.'
    };
    loadFeed(tab === 'all' ? '/posts' : tab === 'following' ? '/posts?feed=following' : '/posts?type=' + tab, empties[tab]);
}

async function loadUsers(q) {
    const users = await api('/users?q=' + encodeURIComponent(q));
    $('#sug').innerHTML = users.length ? users.map(u => `<div class="u-item">${avatar(u.username, u.avatar)}
    <div class="uinfo"><a class="uname" data-profile="${esc(u.username)}">@${esc(u.username)}</a><small>${esc((u.bio || '').slice(0, 28))}</small></div>
    <button class="btn small sf ${u.isFollowing ? 'ghost' : ''}" data-follow="${esc(u.username)}">${u.isFollowing ? 'Unfollow' : 'Follow'}</button></div>`).join('')
        : '<div class="empty">No users found</div>';
}

// ---------- PROFILE ----------
async function profile(name) {
    current = () => profile(name); nav();
    try {
        const d = await api('/users/' + name), own = me.username === d.username;
        $('#app').innerHTML = `<div class="narrow"><div class="card prof"><div class="cover"></div>
      <div class="av-wrap">${avatar(d.username, d.avatar, 'big')}
        ${own ? `<button class="cam" id="camBtn" type="button" title="Change photo">📷</button><input type="file" id="avFile" accept="image/*" hidden>` : ''}</div>
      <h2>@${esc(d.username)}</h2>
      <p class="bio">${esc(d.bio || 'No bio yet.')}</p>
      <small>Joined ${new Date(d.created_at.replace(' ', 'T') + 'Z').toLocaleDateString()}</small>
      <div class="stats"><div><b>${d.posts}</b>Posts</div><div><b>${d.followers}</b>Followers</div><div><b>${d.following}</b>Following</div></div>
      ${own ? `<a class="btn" data-go="settings">⚙️ Edit in Settings</a>`
                : `<button class="btn ${d.isFollowing ? 'ghost' : ''}" data-follow="${esc(d.username)}">${d.isFollowing ? 'Unfollow' : 'Follow'}</button>`}
      </div><div id="feed"></div></div>`;
        if (own) {
            $('#camBtn').onclick = () => $('#avFile').click();
            $('#avFile').onchange = async e => {
                const f = e.target.files[0]; if (!f) return;
                try {
                    const img = await readImage(f, 300, true);
                    const r = await api('/me/avatar', 'PUT', { image: img });
                    me.avatar = r.avatar; toast('Profile photo updated 📸'); profile(name);
                } catch (err) { toast(err.message || 'Invalid image'); }
            };
        }
        loadFeed('/posts?user=' + d.username, '📝 No posts yet.');
    } catch (e) { toast(e.message); history.replaceState(null, '', '#/home'); home(); }
}

// ---------- SETTINGS ----------
function settings() {
    current = settings; nav();
    const th = localStorage.getItem('theme') || 'light';
    const ac = localStorage.getItem('accent') || 'purple';
    const dt = localStorage.getItem('defTab') || 'all';
    $('#app').innerHTML = `<div class="narrow">
    <h2 class="s-title">⚙️ Settings</h2>

    <div class="card set"><h3>🎨 Appearance</h3>
      <div class="s-row"><span>Theme</span><div class="seg2">
        <button data-theme-set="light" class="${th === 'light' ? 'on' : ''}">☀️ Light</button>
        <button data-theme-set="dark" class="${th === 'dark' ? 'on' : ''}">🌙 Dark</button></div></div>
      <div class="s-row"><span>Accent colour</span><div class="swatches">
        ${Object.entries(ACCENTS).map(([k, [a, b]]) => `<button class="swatch ${k === ac ? 'on' : ''}" data-accent="${k}" title="${k}" style="background:linear-gradient(135deg,${a},${b})"></button>`).join('')}</div></div>
      <div class="s-row"><span>Default feed after login</span>
        <select id="defTab">${TABS.map(([k, l]) => `<option value="${k}" ${k === dt ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>

    <div class="card set"><h3>👤 Profile</h3>
      <div class="s-photo">${avatar(me.username, me.avatar, 'big2')}
        <div class="s-btns"><button class="btn small" id="sPhoto">📷 Change photo</button>
        ${me.avatar ? '<button class="btn small ghost" id="sRm">Remove photo</button>' : ''}</div>
        <input type="file" id="sFile" accept="image/*" hidden></div>
      <div class="s-stack"><label>Username</label>
        <div class="s-inline"><input id="sName" value="${esc(me.username)}" maxlength="20"><button class="btn small" id="sUser">Save</button></div></div>
      <div class="s-stack"><label>Bio</label>
        <textarea id="sBio" maxlength="160" placeholder="Write something about yourself...">${esc(me.bio || '')}</textarea>
        <button class="btn small" id="sBioBtn">Save bio</button></div>
    </div>

    <div class="card set"><h3>🔐 Security</h3>
      <div class="s-stack"><label>Change password</label>
        <div class="field"><i>🔒</i><input id="pw0" type="password" placeholder="Current password">${eyeBtn('pw0')}</div>
        <div class="field"><i>🔑</i><input id="pw1" type="password" placeholder="New password (min 6)">${eyeBtn('pw1')}</div>
        <div class="field"><i>🔐</i><input id="pw2" type="password" placeholder="Confirm new password">${eyeBtn('pw2')}</div>
        <button class="btn small" id="sPw">Update password</button></div>
    </div>

    <div class="card set"><h3>🚪 Session</h3>
      <p class="s-note">Log out of this device.</p>
      <button class="btn ghost" id="sLogout">Logout</button></div>

    <div class="card set danger"><h3>⚠️ Danger zone</h3>
      <p class="s-note">Deleting your account will permanently remove all your posts, comments, likes and followers.</p>
      <div class="field"><i>🔒</i><input id="delpw" type="password" placeholder="Enter password to confirm">${eyeBtn('delpw')}</div>
      <button class="btn red" id="sDel">Delete my account</button></div>
  </div>`;

    bindEyes();
    document.querySelectorAll('[data-theme-set]').forEach(b => b.onclick = () => {
        localStorage.setItem('theme', b.dataset.themeSet); applyTheme(); settings();
    });
    document.querySelectorAll('[data-accent]').forEach(b => b.onclick = () => {
        localStorage.setItem('accent', b.dataset.accent); applyTheme(); settings();
    });
    $('#defTab').onchange = e => { localStorage.setItem('defTab', e.target.value); tab = e.target.value; toast('Default feed saved ✅'); };

    $('#sPhoto').onclick = () => $('#sFile').click();
    $('#sFile').onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
            const img = await readImage(f, 300, true);
            const r = await api('/me/avatar', 'PUT', { image: img });
            me.avatar = r.avatar; toast('Profile photo updated 📸'); settings();
        } catch (err) { toast(err.message || 'Invalid image'); }
    };
    const rm = $('#sRm');
    if (rm) rm.onclick = async () => {
        try { await api('/me/avatar', 'DELETE'); me.avatar = null; toast('Photo removed'); settings(); }
        catch (err) { toast(err.message); }
    };
    $('#sUser').onclick = async () => {
        try {
            const r = await api('/me/username', 'PUT', { username: $('#sName').value.trim() });
            token = r.token; localStorage.setItem('token', token); me.username = r.username;
            toast('Username updated ✅'); settings();
        } catch (err) { toast(err.message); }
    };
    $('#sBioBtn').onclick = async () => {
        try { await api('/me', 'PUT', { bio: $('#sBio').value }); me.bio = $('#sBio').value; toast('Bio saved ✅'); }
        catch (err) { toast(err.message); }
    };
    $('#sPw').onclick = async () => {
        try {
            if ($('#pw1').value !== $('#pw2').value) throw new Error('New passwords do not match');
            await api('/me/password', 'PUT', { current: $('#pw0').value, next: $('#pw1').value });
            ['pw0', 'pw1', 'pw2'].forEach(i => $('#' + i).value = '');
            toast('Password changed ✅');
        } catch (err) { toast(err.message); }
    };
    $('#sLogout').onclick = logout;
    $('#sDel').onclick = async () => {
        if (!confirm('Are you sure? Your account will be permanently deleted.')) return;
        try {
            await api('/me/delete', 'POST', { password: $('#delpw').value });
            logout(); toast('Account deleted');
        } catch (err) { toast(err.message); }
    };
}

// ---------- CLICK EVENTS ----------
document.addEventListener('click', async e => {
    const m = e.target.closest('[data-menu]');
    document.querySelectorAll('.dd.show').forEach(x => { if (!m || x.id !== 'dd-' + m.dataset.menu) x.classList.remove('show'); });
    const t = e.target.closest('[data-go],[data-profile],[data-like],[data-cm],[data-del],[data-follow],[data-tab],[data-sendcm],[data-feel],[data-vote],[data-menu],[data-edit],[data-cancel],[data-saveedit],#logout');
    if (!t) return;
    try {
        const d = t.dataset;
        if (d.go) navTo('#/' + d.go);
        else if (d.profile) navTo('#/profile/' + encodeURIComponent(d.profile));
        else if (t.id === 'logout') logout();
        else if (d.tab) { tab = d.tab; navTo('#/home'); }
        else if (d.menu) $('#dd-' + d.menu).classList.toggle('show');
        else if (d.edit) {
            const box = $('#pb-' + d.edit);
            box.innerHTML = `<textarea class="edit-ta" id="et-${d.edit}" maxlength="500">${esc(box.dataset.raw)}</textarea>
        <div class="edit-act"><button class="btn small ghost" data-cancel="1">Cancel</button>
        <button class="btn small" data-saveedit="${d.edit}">Save</button></div>`;
            $('#et-' + d.edit).focus();
        }
        else if (d.cancel) loadFeed(feedURL);
        else if (d.saveedit) {
            await api('/posts/' + d.saveedit, 'PUT', { content: $('#et-' + d.saveedit).value });
            toast('Post updated ✅'); loadFeed(feedURL);
        }
        else if (d.feel) {
            draft.feeling = draft.feeling === d.feel ? '' : d.feel;
            document.querySelectorAll('[data-feel]').forEach(b => b.classList.toggle('on', b.dataset.feel === draft.feeling));
            $('#tFeel').textContent = draft.feeling || '😊 Feeling';
        }
        else if (d.vote) {
            await api(`/posts/${d.vote}/vote`, 'POST', { option: Number(d.opt) });
            loadFeed(feedURL);
        }
        else if (d.like) {
            const r = await api(`/posts/${d.like}/like`, 'POST');
            t.classList.toggle('liked', r.liked);
            t.innerHTML = `${r.liked ? '❤️' : '🤍'} <b>${r.likes}</b>`;
        }
        else if (d.cm) {
            const box = $('#cm-' + d.cm);
            box.classList.toggle('hidden');
            if (!box.classList.contains('hidden')) loadComments(d.cm);
        }
        else if (d.sendcm) {
            const inp = $('#ci-' + d.sendcm);
            await api(`/posts/${d.sendcm}/comments`, 'POST', { content: inp.value });
            loadComments(d.sendcm);
        }
        else if (d.del) {
            if (confirm('Delete this post?')) { await api('/posts/' + d.del, 'DELETE'); toast('Post deleted'); current(); }
        }
        else if (d.follow) {
            const r = await api(`/users/${d.follow}/follow`, 'POST');
            if (t.classList.contains('sf')) {
                t.textContent = r.following ? 'Unfollow' : 'Follow';
                t.classList.toggle('ghost', r.following);
            } else current();
        }
    } catch (err) { toast(err.message); }
});

// Press Enter to send a comment
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id && e.target.id.startsWith('ci-'))
        document.querySelector(`[data-sendcm="${e.target.id.slice(3)}"]`).click();
});

// ---------- START ----------
async function start() {
    if (!token) return authPage();
    try { me = await api('/me'); route(); }
    catch { localStorage.removeItem('token'); token = null; authPage(); }
}
start();