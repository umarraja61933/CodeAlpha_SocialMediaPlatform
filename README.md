# Buzzly - Social Media Platform

A full stack social media platform built for the CodeAlpha Full Stack Development Internship (Task 2).

## Features

- User registration and login (hashed passwords, JWT authentication)
- User profiles with profile photo, bio, and posts/followers/following count
- Four post types: text, photo, poll, and mood
- Like and unlike posts
- Comments on posts
- Follow and unfollow users
- Feed filters: All, Following, Photos, Polls, Moods
- Edit and delete your own posts
- Settings: dark/light theme, accent colours, change username, password and profile photo, delete account
- Responsive design

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js
- **Database:** SQLite (better-sqlite3)
- **Authentication:** JSON Web Tokens, bcryptjs

## How to Run

1. Install [Node.js](https://nodejs.org) (LTS version)
2. Clone this repository and open the folder in a terminal
3. Install dependencies:
```
   npm install
```
4. Start the server:
```
   node server.js
```
5. Open http://localhost:3301 in your browser

On the first run, the app creates the database and adds demo users and posts automatically.

## Demo Accounts

| Username | Password |
|---|---|
| sara_khan | demo1234 |
| ali_codes | demo1234 |

You can also register a new account.

## Note

Demo photos and profile pictures are loaded from the internet, so an internet connection is needed to see them.