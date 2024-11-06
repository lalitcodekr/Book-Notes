// Import required dependencies
import express from "express";
import pg from "pg";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";
import methodOverride from "method-override";
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Initialize Express app and set port
const app = express();
const port = 3000;

// Configure __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Express middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'src')));
app.set("view engine", "ejs");
app.use(methodOverride("_method"));

// Configure database connection pool
const { Pool } = require('pg');
const dbConfig = require('./config/database');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test database connection
pool.connect((err, _client, done) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Successfully connected to database');
    done();
  }
});

// API Routes

// Home route - Get all books
app.get("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        books.*,
        COALESCE(books.thumbnail, books.volumeInfo->>'thumbnail') as book_thumbnail
      FROM books 
      ORDER BY created_at DESC
    `);
    
    res.render("index", { 
      books: result.rows.map(book => ({
        ...book,
        // Ensure thumbnail is properly set
        thumbnail: book.book_thumbnail || book.thumbnail || book.volumeInfo?.imageLinks?.thumbnail || null,
        // Format the title properly
        title: book.title || book.volumeInfo?.title || 'Untitled',
        // Ensure other fields are available
        author: book.author || book.volumeInfo?.authors?.[0] || 'Unknown Author',
        rating: book.rating || 0,
        read_date: book.read_date || new Date()
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching books");
  } finally {
    client.release();
  }
});

// Search books from Google Books API
app.get("/api/books/search/:query", async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 10 } = req.query;

    if (!process.env.GOOGLE_BOOKS_API_KEY) {
      throw new Error('Google Books API key is not configured');
    }

    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&key=${process.env.GOOGLE_BOOKS_API_KEY}&maxResults=${limit}`;
    
    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json'
      },
      timeout: 5000 // 5 second timeout
    });

    if (!response.data || !response.data.items) {
      return res.status(404).json({ 
        success: false, 
        message: "No books found" 
      });
    }

    const books = response.data.items.map(item => {
      const volumeInfo = item.volumeInfo || {};
      const imageLinks = volumeInfo.imageLinks || {};
      const industryIdentifiers = volumeInfo.industryIdentifiers || [];
      
      return {
        id: item.id,
        title: volumeInfo.title || "Unknown Title",
        author: Array.isArray(volumeInfo.authors) ? volumeInfo.authors.join(", ") : "Unknown Author",
        isbn: industryIdentifiers.length > 0 ? industryIdentifiers[0].identifier : "N/A",
        rating: parseFloat(volumeInfo.averageRating) || 0,
        description: volumeInfo.description || "No description available",
        thumbnail: imageLinks.thumbnail || null,
        publishedDate: volumeInfo.publishedDate || "Unknown Date",
        pageCount: volumeInfo.pageCount || 0,
        categories: volumeInfo.categories || [],
        language: volumeInfo.language || "unknown"
      };
    });

    res.json({
      success: true,
      count: books.length,
      data: books
    });
  } catch (err) {
    console.error("Book search error:", err);
    const errorMessage = err.response?.data?.error?.message || err.message;
    res.status(err.response?.status || 500).json({ 
      success: false,
      error: "Failed to fetch books",
      message: process.env.NODE_ENV === 'development' ? errorMessage : 'Internal server error'
    });
  }
});

// Add a new book
app.post("/books", async (req, res) => {
  const client = await pool.connect();
  try {
    const { title, author, isbn } = req.body;
    
    // Clean the ISBN by removing any non-alphanumeric characters
    const cleanedIsbn = isbn.replace(/[^0-9X]/gi, '');
    
    // Fetch book details from Google Books API
    const apiResponse = await axios.get(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanedIsbn}&key=${process.env.GOOGLE_BOOKS_API_KEY}`
    );
    
    let thumbnail = null;
    if (apiResponse.data.items && apiResponse.data.items[0]?.volumeInfo?.imageLinks) {
      // Ensure HTTPS and handle different image sizes
      thumbnail = apiResponse.data.items[0].volumeInfo.imageLinks.thumbnail ||
                 apiResponse.data.items[0].volumeInfo.imageLinks.smallThumbnail;
      thumbnail = thumbnail.replace('http:', 'https:');
    }

    // If no thumbnail from ISBN search, try title search
    if (!thumbnail) {
      const titleSearch = await axios.get(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title)}&key=${process.env.GOOGLE_BOOKS_API_KEY}`
      );
      if (titleSearch.data.items && titleSearch.data.items[0]?.volumeInfo?.imageLinks) {
        thumbnail = titleSearch.data.items[0].volumeInfo.imageLinks.thumbnail ||
                   titleSearch.data.items[0].volumeInfo.imageLinks.smallThumbnail;
        thumbnail = thumbnail.replace('http:', 'https:');
      }
    }

    const result = await client.query(
      `INSERT INTO books (
        title, author, isbn, rating, read_date, notes, thumbnail,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [title, author, cleanedIsbn, req.body.rating, req.body.read_date, req.body.notes, thumbnail]
    );
    
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding book");
  } finally {
    client.release();
  }
});

// Update a book
app.post("/edit/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { title, author, isbn, rating, read_date, notes } = req.body;
    const result = await client.query(
      `UPDATE books 
       SET title = $1, author = $2, isbn = $3, rating = $4, read_date = $5, 
           notes = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [title, author, isbn, rating, read_date || null, notes, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Book not found" });
    }

    res.json({ success: true, book: result.rows[0] });
  } catch (err) {
    console.error("Error updating book:", err);
    res.status(500).json({ error: "Failed to update book" });
  } finally {
    client.release();
  }
});

// Delete a book
app.post("/delete/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('DELETE FROM books WHERE id = $1 RETURNING *', [req.params.id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Book not found" });
    }
    
    return res.json({ success: true });
  } catch (err) {
    console.error("Error deleting book:", err);
    return res.status(500).json({ error: "Error deleting book" });
  } finally {
    client.release();
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", {
    error: "Internal Server Error",
    message: process.env.NODE_ENV === 'development' ? err.message : null
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).render("error", {
    error: "Page Not Found",
    message: "The requested page does not exist"
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}).on('error', (err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});

app.get("/search", async (req, res) => {
  const query = req.query.q;
  try {
    const response = await axios.get(`https://www.googleapis.com/books/v1/volumes?q=${query}`);
    const books = response.data.items.map(book => ({
      title: book.volumeInfo.title,
      author: book.volumeInfo.authors ? book.volumeInfo.authors[0] : 'Unknown Author',
      isbn: book.volumeInfo.industryIdentifiers ? 
        book.volumeInfo.industryIdentifiers[0].identifier : '',
      thumbnail: book.volumeInfo.imageLinks ? 
        book.volumeInfo.imageLinks.thumbnail.replace('http:', 'https:') : null,
      description: book.volumeInfo.description || '',
      publishedDate: book.volumeInfo.publishedDate || ''
    }));
    res.json(books);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error searching books" });
  }
});

// Update thumbnails for existing books
app.post("/update-thumbnails", async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM books WHERE thumbnail IS NULL');
    
    for (const book of rows) {
      try {
        // Try ISBN search first
        let apiResponse = await axios.get(
          `https://www.googleapis.com/books/v1/volumes?q=isbn:${book.isbn}&key=${process.env.GOOGLE_BOOKS_API_KEY}`
        );
        
        let thumbnail = null;
        if (apiResponse.data.items && apiResponse.data.items[0]?.volumeInfo?.imageLinks) {
          thumbnail = apiResponse.data.items[0].volumeInfo.imageLinks.thumbnail ||
                     apiResponse.data.items[0].volumeInfo.imageLinks.smallThumbnail;
        }
        
        // If no thumbnail found, try title search
        if (!thumbnail) {
          apiResponse = await axios.get(
            `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(book.title)}&key=${process.env.GOOGLE_BOOKS_API_KEY}`
          );
          if (apiResponse.data.items && apiResponse.data.items[0]?.volumeInfo?.imageLinks) {
            thumbnail = apiResponse.data.items[0].volumeInfo.imageLinks.thumbnail ||
                       apiResponse.data.items[0].volumeInfo.imageLinks.smallThumbnail;
          }
        }
        
        if (thumbnail) {
          thumbnail = thumbnail.replace('http:', 'https:');
          await client.query(
            'UPDATE books SET thumbnail = $1 WHERE id = $2',
            [thumbnail, book.id]
          );
        }
      } catch (error) {
        console.error(`Error updating thumbnail for book ${book.id}:`, error);
      }
    }
    
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating thumbnails");
  } finally {
    client.release();
  }
});

// Delete route
app.post("/delete/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('DELETE FROM books WHERE id = $1 RETURNING *', [req.params.id]);
    
    if (result.rowCount === 0) {
      return res.status(404).send("Book not found");
    }
    
    // Send a success response
    return res.redirect('/');
  } catch (err) {
    console.error("Error deleting book:", err);
    return res.status(500).send("Error deleting book");
  } finally {
    client.release();
  }
});

// Get edit form
app.get("/edit/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM books WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).render("error", {
        error: "Book Not Found",
        message: "The requested book does not exist"
      });
    }
    
    res.render('edit', { book: result.rows[0] });
  } catch (err) {
    console.error("Error fetching book:", err);
    res.status(500).render("error", {
      error: "Error",
      message: "Failed to fetch book details"
    });
  } finally {
    client.release();
  }
});

// Handle edit form submission
app.post("/edit/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { title, author, isbn, rating, read_date, notes } = req.body;
    const result = await client.query(
      `UPDATE books 
       SET title = $1, author = $2, isbn = $3, rating = $4, read_date = $5, 
           notes = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [title, author, isbn, rating, read_date || null, notes, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Book not found" });
    }

    res.json({ success: true, book: result.rows[0] });
  } catch (err) {
    console.error("Error updating book:", err);
    res.status(500).json({ error: "Failed to update book" });
  } finally {
    client.release();
  }
});
