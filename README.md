# Book Notes App

A personal book tracking and note-taking app inspired by Derek Sivers' book notes system. Track your reading, save detailed notes, and retain key insights from every book.

🔗 **Live Demo:** [Book Notes App](https://book-notes-m5n0.onrender.com)

> **Note:** Hosted on Render's free tier, so initial loading might take a few minutes as the server spins up.

## Overview

This app solves a common reader's challenge—remembering crucial parts of books. It helps you:

- Track books read, notes, and ratings
- Search through your collection and sort by various criteria
- Record reading dates and manage book metadata

## Features

- **Book Management:** Add, edit, and delete books
- **Detailed Notes & Rating System:** Keep book insights and rate on a scale of 1-10
- **Reading Dates:** Track when you read each book
- **Search & Sort:** Find books via Google Books API, sort by rating, date, or title
- **Responsive Design:** Optimized for both desktop and mobile

## Tech Stack

- **Frontend:** HTML, EJS templates, TailwindCSS with DaisyUI, JavaScript
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL
- **APIs:** Google Books API for book search and metadata
- **Hosting:** Render for app hosting and PostgreSQL database

## Getting Started

1. **Clone the repository**:

   ```bash
   git clone https://github.com/lalitcodekr/Book-Notes.git
   cd book-notes
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Create a `.env` file** with the following variables:

   ```plaintext
   GOOGLE_BOOKS_API_KEY=your_google_books_api_key
   DB_USER=your_db_user
   DB_HOST=localhost
   DB_NAME=book_tracker
   DB_PASSWORD=your_db_password
   DB_PORT=5432
   PORT=3000
   NODE_ENV=development
   ```

4. **Set up the database**:

   ```bash
   npm run migrate
   ```

5. **Build CSS**:

   ```bash
   npm run build:css
   ```

6. **Start the server**:
   ```bash
   npm start
   ```
   Access the app at `http://localhost:3000`.

## Scripts

- `npm run build:css` - Build and watch Tailwind CSS
- `npm start` - Start the development server
- `npm run migrate` - Run database migrations
- `npm run build` - Build production CSS

## Environment Variables

- `GOOGLE_BOOKS_API_KEY` - Google Books API key
- `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT` - PostgreSQL database credentials
- `PORT` - App port
- `NODE_ENV` - Environment (development/production)
- `DATABASE_URL` - Full database URL for production

## Contributing

Contributions are welcome! Please:

1. Fork the repo
2. Create your branch (`git checkout -b feature/YourFeature`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/YourFeature`)
5. Open a Pull Request

## License

© 2024 Book Notes App. All rights reserved.

## Acknowledgments

- Inspired by [Derek Sivers' book notes system](https://sive.rs/book)
- Powered by Node.js, Express.js, TailwindCSS, and Google Books API
