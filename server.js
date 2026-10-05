const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3301;
const SECRET = 'codealpha_social_secret_key';
const db = new Database('social.db');
const UPLOADS = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

// ---------- DATABASE TABLES ----------
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password TEXT NOT NULL,
  bio TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS posts(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS comments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS likes(
  user_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL,
  PRIMARY KEY(user_id, post_id));
CREATE TABLE IF NOT EXISTS follows(
  follower_id INTEGER NOT NULL,
  following_id INTEGER NOT NULL,
  PRIMARY KEY(follower_id, following_id));
CREATE TABLE IF NOT EXISTS poll_votes(
  user_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL,
  option_idx INTEGER NOT NULL,
  PRIMARY KEY(user_id, post_id));
`);
for (const q of [
    "ALTER TABLE posts ADD COLUMN type TEXT DEFAULT 'text'",
    'ALTER TABLE posts ADD COLUMN image TEXT',
    'ALTER TABLE posts ADD COLUMN feeling TEXT',
    'ALTER TABLE posts ADD COLUMN poll TEXT',
    'ALTER TABLE users ADD COLUMN avatar TEXT'
]) { try { db.exec(q); } catch { } }

// ---------- HELPERS ----------
function saveImage(data, prefix) {
    const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(data || '');
    if (!m) return null;
    const name = `${prefix}_${Date.now()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
    fs.writeFileSync(path.join(UPLOADS, name), Buffer.from(m[2], 'base64'));
    return '/uploads/' + name;
}
const removeFile = p => { if (p && p.startsWith('/uploads/')) fs.unlink(path.join(__dirname, 'public', p), () => { }); };

function deleteUser(id) {
    const imgs = db.prepare('SELECT image FROM posts WHERE user_id=? AND image IS NOT NULL').all(id);
    const ps = '(SELECT id FROM posts WHERE user_id=?)';
    db.prepare(`DELETE FROM comments WHERE post_id IN ${ps}`).run(id);
    db.prepare(`DELETE FROM likes WHERE post_id IN ${ps}`).run(id);
    db.prepare(`DELETE FROM poll_votes WHERE post_id IN ${ps}`).run(id);
    db.prepare('DELETE FROM posts WHERE user_id=?').run(id);
    db.prepare('DELETE FROM comments WHERE user_id=?').run(id);
    db.prepare('DELETE FROM likes WHERE user_id=?').run(id);
    db.prepare('DELETE FROM poll_votes WHERE user_id=?').run(id);
    db.prepare('DELETE FROM follows WHERE follower_id=? OR following_id=?').run(id, id);
    const u = db.prepare('SELECT avatar FROM users WHERE id=?').get(id);
    db.prepare('DELETE FROM users WHERE id=?').run(id);
    if (u) removeFile(u.avatar);
    imgs.forEach(i => removeFile(i.image));
}

// ---------- DEMO DATA (real-looking feed) ----------
const IMG = id => `https://picsum.photos/id/${id}/900/600`;
const FACE = n => `https://i.pravatar.cc/200?img=${n}`;
// [username, bio, avatar]
const DEMO_USERS = [
    ['sara_khan', 'Coffee lover ☕ | UI designer | Lahore', FACE(47)],
    ['ali_codes', 'Full stack dev in the making 💻', FACE(12)],
    ['zoya_travels', 'Chasing sunsets 🌅 Northern Pakistan', FACE(5)],
    ['hamza_foodie', 'Biryani is a personality 🍛', FACE(33)],
    ['bilal_tech', 'Gadgets, AI & gaming 🎮', FACE(60)],
    ['fatima_art', 'Illustrator ✏️ Sketchbooks & chai', FACE(25)],
    ['usman_fit', 'Gym, run, repeat 💪', FACE(15)],
    ['ayesha_reads', 'Books, notes & quiet corners 📚', FACE(44)]
];
// [user, text, type, image, feeling, poll, hoursAgo, comments, likesCount, votes]
const DEMO_POSTS = [
    [2, 'Sunrise over the valley. Worth the 4am wake up call ⛰️', 'photo', IMG(1018), '', null, 2, [[0, 'Wow, this is unreal 😍'], [3, 'Bucket list!'], [4, 'Which trail is this?']], 6, []],
    [1, 'Hot take: tabs vs spaces is pointless. Just use Prettier and move on 😅', 'text', null, '', null, 3, [[4, 'Finally someone said it'], [0, 'Prettier saved my sanity']], 5, []],
    [3, 'Fresh strawberries from the market today. Summer is officially here 🍓', 'photo', IMG(1080), '', null, 4, [[5, 'Share some please!'], [2, 'So fresh 😋']], 5, []],
    [0, 'Light mode or dark mode? Be honest.', 'text', null, '', null, 5, [[1, 'Dark mode, always'], [6, 'Light in the day, dark at night']], 4, []],
    [6, 'Day 30 of my gym streak. Not a single day missed this month.', 'feeling', null, '🥳 Excited', null, 6, [[2, 'Proud of you!'], [4, 'Consistency is everything 💪']], 7, []],
    [7, 'Finished Atomic Habits this weekend. Small changes really do add up. What should I read next?', 'text', null, '', null, 7, [[5, 'Try Deep Work'], [0, 'The Psychology of Money is great'], [1, 'Show Your Work!']], 6, []],
    [2, 'Quiet lake, no signal, no notifications. Exactly what I needed 🌲', 'photo', IMG(10), '', null, 9, [[7, 'This looks so peaceful'], [3, 'Take me along next time 😂']], 8, []],
    [4, 'Which platform do you game on?', 'poll', null, '', ['PC', 'PlayStation', 'Xbox', 'Mobile'], 10, [[1, 'PC master race'], [6, 'Mobile, no time for anything else 😅']], 4, [[0, 0], [1, 0], [2, 3], [3, 1], [5, 3], [6, 3], [7, 0]]],
    [0, 'Meet the newest member of our family 🐶', 'photo', IMG(237), '', null, 12, [[5, 'Omg so cute!!'], [7, 'What is his name?'], [3, 'I need to meet him'], [2, 'Best update of the day']], 8, []],
    [5, 'Working on a new illustration series. Sneak peek coming soon!', 'text', null, '', null, 14, [[0, 'Cannot wait!'], [7, 'Your work is always so good']], 5, []],
    [1, 'Deployed my first full stack project today. It actually works 🚀', 'feeling', null, '🤩 Amazed', null, 16, [[4, 'Congrats bro!'], [0, 'Share the link!'], [6, 'Legend']], 7, []],
    [2, 'Spotted this beauty on our morning trail walk 🦌', 'photo', IMG(1003), '', null, 20, [[7, 'Amazing shot'], [5, 'Nature is the best artist']], 6, []],
    [6, 'When do you work out?', 'poll', null, '', ['Morning', 'Evening', 'Whenever I can'], 22, [[3, 'Whenever I can, honestly'], [0, 'Morning before work']], 3, [[0, 0], [1, 2], [2, 0], [3, 2], [4, 1], [5, 2], [7, 0]]],
    [3, 'Hot chai and rain. Nothing beats this.', 'feeling', null, '😊 Happy', null, 26, [[0, 'Pakoras too please'], [5, 'Perfect combo']], 6, []],
    [4, 'Reminder: back up your data. Future you will thank you.', 'text', null, '', null, 30, [[1, 'Learned this the hard way'], [7, 'Doing it right now']], 4, []],
    [0, 'Coffee and a good playlist. Productive Monday unlocked ☕', 'photo', IMG(30), '', null, 34, [[5, 'Drop the playlist'], [1, 'Same energy today']], 5, []],
    [7, 'You do not rise to the level of your goals. You fall to the level of your systems.', 'text', null, '', null, 40, [[6, 'So true'], [4, 'Saving this one']], 6, []],
    [2, 'Waterfall hike done. Legs are jelly, heart is full 💚', 'photo', IMG(15), '', null, 46, [[3, 'You look so happy in these'], [6, 'How long was the trail?'], [0, 'Gorgeous!']], 7, []]
];

function wipeDemo() {
    const names = DEMO_USERS.map(u => u[0]);
    db.prepare(`SELECT id FROM users WHERE username IN (${names.map(() => '?').join(',')})`)
        .all(...names).forEach(r => deleteUser(r.id));
}

function seed() {
    const hash = bcrypt.hashSync('demo1234', 8);
    const ids = DEMO_USERS.map(([n, b, a], i) => db.prepare(
        "INSERT INTO users(username,password,bio,avatar,created_at) VALUES(?,?,?,?,datetime('now',?))")
        .run(n, hash, b, a, `-${20 + i * 3} days`).lastInsertRowid);

    for (const [u, c, t, img, f, poll, h, cm, lk, vt] of DEMO_POSTS) {
        const id = db.prepare("INSERT INTO posts(user_id,content,type,image,feeling,poll,created_at) VALUES(?,?,?,?,?,?,datetime('now',?))")
            .run(ids[u], c, t, img, f || null, poll ? JSON.stringify(poll) : null, `-${h} hours`).lastInsertRowid;
        cm.forEach(([cu, tx], k) => db.prepare("INSERT INTO comments(post_id,user_id,content,created_at) VALUES(?,?,?,datetime('now',?))")
            .run(id, ids[cu], tx, `-${Math.max(3, h * 60 - 20 - k * 10)} minutes`));
        for (let k = 1; k <= lk; k++) db.prepare('INSERT OR IGNORE INTO likes VALUES(?,?)').run(ids[(u + k) % ids.length], id);
        vt.forEach(([vu, o]) => db.prepare('INSERT OR IGNORE INTO poll_votes VALUES(?,?,?)').run(ids[vu], id, o));
    }
    ids.forEach((a, i) => ids.forEach((b, j) => {
        if (i !== j && (i + 2 * j) % 3 !== 0) db.prepare('INSERT OR IGNORE INTO follows VALUES(?,?)').run(a, b);
    }));
    console.log('✅ Demo users and posts added (password: demo1234)');
}

if (db.pragma('user_version', { simple: true }) < 2) {
    db.transaction(() => { wipeDemo(); seed(); })();
    db.pragma('user_version = 2');
}

const app = express();
app.use(express.json({ limit: '6mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- AUTH ----------
const sign = u => jwt.sign({ id: u.id, username: u.username }, SECRET, { expiresIn: '7d' });
const auth = (req, res, next) => {
    try {
        const t = (req.headers.authorization || '').split(' ')[1];
        req.user = jwt.verify(t, SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Please login first' });
    }
};

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username || ''))
        return res.status(400).json({ error: 'Username 3-20 chars (letters, numbers, _)' });
    if (!password || password.length < 6)
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (db.prepare('SELECT 1 FROM users WHERE username=?').get(username))
        return res.status(400).json({ error: 'Username already taken' });
    const r = db.prepare('INSERT INTO users(username,password) VALUES(?,?)')
        .run(username, bcrypt.hashSync(password, 10));
    res.json({ token: sign({ id: r.lastInsertRowid, username }) });
});

app.post('/api/login', (req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE username=?').get(req.body.username || '');
    if (!u || !bcrypt.compareSync(req.body.password || '', u.password))
        return res.status(400).json({ error: 'Wrong username or password' });
    res.json({ token: sign(u) });
});

app.get('/api/me', auth, (req, res) => {
    const u = db.prepare('SELECT id,username,bio,avatar FROM users WHERE id=?').get(req.user.id);
    u ? res.json(u) : res.status(401).json({ error: 'Login again' });
});

app.put('/api/me', auth, (req, res) => {
    db.prepare('UPDATE users SET bio=? WHERE id=?').run((req.body.bio || '').slice(0, 160), req.user.id);
    res.json({ ok: true });
});

app.put('/api/me/avatar', auth, (req, res) => {
    const p = saveImage(req.body.image, 'avatar_' + req.user.id);
    if (!p) return res.status(400).json({ error: 'Invalid image' });
    const old = db.prepare('SELECT avatar FROM users WHERE id=?').get(req.user.id).avatar;
    db.prepare('UPDATE users SET avatar=? WHERE id=?').run(p, req.user.id);
    removeFile(old);
    res.json({ avatar: p });
});

app.delete('/api/me/avatar', auth, (req, res) => {
    const old = db.prepare('SELECT avatar FROM users WHERE id=?').get(req.user.id).avatar;
    db.prepare('UPDATE users SET avatar=NULL WHERE id=?').run(req.user.id);
    removeFile(old);
    res.json({ ok: true });
});

// ---------- SETTINGS ----------
app.put('/api/me/username', auth, (req, res) => {
    const name = (req.body.username || '').trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(name))
        return res.status(400).json({ error: 'Username 3-20 chars (letters, numbers, _)' });
    const ex = db.prepare('SELECT id FROM users WHERE username=?').get(name);
    if (ex && ex.id !== req.user.id) return res.status(400).json({ error: 'Username already taken' });
    db.prepare('UPDATE users SET username=? WHERE id=?').run(name, req.user.id);
    res.json({ username: name, token: sign({ id: req.user.id, username: name }) });
});

app.put('/api/me/password', auth, (req, res) => {
    const { current, next } = req.body;
    const u = db.prepare('SELECT password FROM users WHERE id=?').get(req.user.id);
    if (!u || !bcrypt.compareSync(current || '', u.password))
        return res.status(400).json({ error: 'Current password is wrong' });
    if (!next || next.length < 6)
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
    db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(next, 10), req.user.id);
    res.json({ ok: true });
});

app.post('/api/me/delete', auth, (req, res) => {
    const u = db.prepare('SELECT password FROM users WHERE id=?').get(req.user.id);
    if (!u || !bcrypt.compareSync(req.body.password || '', u.password))
        return res.status(400).json({ error: 'Password is wrong' });
    db.transaction(() => deleteUser(req.user.id))();
    res.json({ ok: true });
});

// ---------- POSTS ----------
const POSTS = `SELECT p.id, p.content, p.created_at, p.type, p.image, p.feeling, p.poll, u.username, u.avatar,
  (SELECT COUNT(*) FROM likes WHERE post_id=p.id) AS likes,
  (SELECT COUNT(*) FROM comments WHERE post_id=p.id) AS comments,
  EXISTS(SELECT 1 FROM likes WHERE post_id=p.id AND user_id=?) AS liked,
  (SELECT option_idx FROM poll_votes WHERE post_id=p.id AND user_id=?) AS myVote
  FROM posts p JOIN users u ON u.id=p.user_id`;

app.get('/api/posts', auth, (req, res) => {
    const id = req.user.id, { feed, user, type } = req.query;
    const conds = [], params = [id, id];
    if (user) { conds.push('u.username=?'); params.push(user); }
    else if (feed === 'following') {
        conds.push('(p.user_id IN (SELECT following_id FROM follows WHERE follower_id=?) OR p.user_id=?)');
        params.push(id, id);
    }
    if (['text', 'photo', 'poll', 'feeling'].includes(type)) { conds.push('p.type=?'); params.push(type); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const rows = db.prepare(`${POSTS} ${where} ORDER BY p.created_at DESC, p.id DESC LIMIT 100`).all(...params);
    rows.forEach(r => {
        if (r.poll) {
            const counts = db.prepare('SELECT option_idx i, COUNT(*) c FROM poll_votes WHERE post_id=? GROUP BY option_idx').all(r.id);
            r.poll = JSON.parse(r.poll).map((t, i) => ({ text: t, votes: (counts.find(x => x.i === i) || { c: 0 }).c }));
        }
    });
    res.json(rows);
});

app.post('/api/posts', auth, (req, res) => {
    const content = (req.body.content || '').trim().slice(0, 500);
    const feeling = (req.body.feeling || '').slice(0, 20);
    let type = 'text', imgPath = null, poll = null;

    if (Array.isArray(req.body.options)) {
        const opts = req.body.options.map(o => String(o).trim().slice(0, 60)).filter(Boolean).slice(0, 4);
        if (!content) return res.status(400).json({ error: 'Write a question for your poll' });
        if (opts.length < 2) return res.status(400).json({ error: 'Poll needs at least 2 options' });
        type = 'poll'; poll = JSON.stringify(opts);
    } else if (req.body.image) {
        imgPath = saveImage(req.body.image, 'post_' + req.user.id);
        if (!imgPath) return res.status(400).json({ error: 'Invalid image' });
        type = 'photo';
    } else if (feeling) {
        type = 'feeling';
    } else if (!content) {
        return res.status(400).json({ error: 'Post cannot be empty' });
    }

    db.prepare('INSERT INTO posts(user_id,content,type,image,feeling,poll) VALUES(?,?,?,?,?,?)')
        .run(req.user.id, content, type, imgPath, feeling || null, poll);
    res.json({ ok: true });
});

app.put('/api/posts/:id', auth, (req, res) => {
    const p = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
    if (!p || p.user_id !== req.user.id) return res.status(403).json({ error: 'Not allowed' });
    const content = (req.body.content || '').trim().slice(0, 500);
    if (!content && (p.type === 'text' || p.type === 'poll'))
        return res.status(400).json({ error: 'Post cannot be empty' });
    db.prepare('UPDATE posts SET content=? WHERE id=?').run(content, p.id);
    res.json({ ok: true });
});

app.delete('/api/posts/:id', auth, (req, res) => {
    const p = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
    if (!p || p.user_id !== req.user.id) return res.status(403).json({ error: 'Not allowed' });
    db.prepare('DELETE FROM comments WHERE post_id=?').run(p.id);
    db.prepare('DELETE FROM likes WHERE post_id=?').run(p.id);
    db.prepare('DELETE FROM poll_votes WHERE post_id=?').run(p.id);
    db.prepare('DELETE FROM posts WHERE id=?').run(p.id);
    removeFile(p.image);
    res.json({ ok: true });
});

// ---------- POLL VOTE ----------
app.post('/api/posts/:id/vote', auth, (req, res) => {
    const p = db.prepare('SELECT poll FROM posts WHERE id=?').get(req.params.id);
    if (!p || !p.poll) return res.status(404).json({ error: 'Poll not found' });
    const idx = Number(req.body.option);
    if (!Number.isInteger(idx) || idx < 0 || idx >= JSON.parse(p.poll).length)
        return res.status(400).json({ error: 'Invalid option' });
    db.prepare('INSERT OR REPLACE INTO poll_votes VALUES(?,?,?)').run(req.user.id, req.params.id, idx);
    res.json({ ok: true });
});

// ---------- LIKES ----------
app.post('/api/posts/:id/like', auth, (req, res) => {
    const { id } = req.params, uid = req.user.id;
    const ex = db.prepare('SELECT 1 FROM likes WHERE user_id=? AND post_id=?').get(uid, id);
    if (ex) db.prepare('DELETE FROM likes WHERE user_id=? AND post_id=?').run(uid, id);
    else db.prepare('INSERT INTO likes VALUES(?,?)').run(uid, id);
    const likes = db.prepare('SELECT COUNT(*) c FROM likes WHERE post_id=?').get(id).c;
    res.json({ liked: !ex, likes });
});

// ---------- COMMENTS ----------
app.get('/api/posts/:id/comments', auth, (req, res) => {
    res.json(db.prepare(`SELECT c.id, c.content, c.created_at, u.username, u.avatar
    FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.id ASC`).all(req.params.id));
});

app.post('/api/posts/:id/comments', auth, (req, res) => {
    const content = (req.body.content || '').trim();
    if (!content) return res.status(400).json({ error: 'Comment cannot be empty' });
    db.prepare('INSERT INTO comments(post_id,user_id,content) VALUES(?,?,?)')
        .run(req.params.id, req.user.id, content.slice(0, 300));
    res.json({ ok: true });
});

// ---------- USERS / FOLLOW ----------
app.get('/api/users', auth, (req, res) => {
    res.json(db.prepare(`SELECT username, bio, avatar,
    EXISTS(SELECT 1 FROM follows WHERE follower_id=? AND following_id=users.id) AS isFollowing
    FROM users WHERE id!=? AND username LIKE ? ORDER BY isFollowing ASC, id DESC LIMIT 8`)
        .all(req.user.id, req.user.id, '%' + (req.query.q || '') + '%'));
});

app.get('/api/users/:username', auth, (req, res) => {
    const u = db.prepare('SELECT id,username,bio,avatar,created_at FROM users WHERE username=?').get(req.params.username);
    if (!u) return res.status(404).json({ error: 'User not found' });
    const c = (q, ...a) => db.prepare(q).get(...a).c;
    res.json({
        ...u,
        posts: c('SELECT COUNT(*) c FROM posts WHERE user_id=?', u.id),
        followers: c('SELECT COUNT(*) c FROM follows WHERE following_id=?', u.id),
        following: c('SELECT COUNT(*) c FROM follows WHERE follower_id=?', u.id),
        isFollowing: !!db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?').get(req.user.id, u.id)
    });
});

app.post('/api/users/:username/follow', auth, (req, res) => {
    const u = db.prepare('SELECT id FROM users WHERE username=?').get(req.params.username);
    if (!u) return res.status(404).json({ error: 'User not found' });
    if (u.id === req.user.id) return res.status(400).json({ error: "You can't follow yourself" });
    const ex = db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?').get(req.user.id, u.id);
    if (ex) db.prepare('DELETE FROM follows WHERE follower_id=? AND following_id=?').run(req.user.id, u.id);
    else db.prepare('INSERT INTO follows VALUES(?,?)').run(req.user.id, u.id);
    res.json({ following: !ex });
});

app.listen(PORT, () => console.log('🚀 Server running: http://localhost:' + PORT));