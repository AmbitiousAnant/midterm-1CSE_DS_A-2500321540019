const http = require('http');

const PORT = 8080;
const books = [
    { id: 1, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', category: 'Fiction' },
    { id: 2, title: 'To Kill a Mockingbird', author: 'Harper Lee', category: 'Classic' },
    { id: 3, title: 'A Brief History of Time', author: 'Stephen Hawking', category: 'Science' },
    { id: 4, title: 'The Hobbit', author: 'J. R. R. Tolkien', category: 'Fantasy' }
];
let nextId = 5;

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new Error('Request body must be valid JSON'));
            }
        });
        req.on('error', reject);
    });
}

function validateBook(book) {
    // Require all book fields to be non-empty strings.
    if (!book || typeof book !== 'object' || Array.isArray(book)) return null;
    const { title, author, category } = book;
    if (![title, author, category].every(
        value => typeof value === 'string' && value.trim()
    )) return null;
    return { title: title.trim(), author: author.trim(), category: category.trim() };
}

function getBookId(idText, res) {
    const id = Number(idText);
    if (!Number.isInteger(id) || id < 1) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Book ID must be a positive number' }));
        return null;
    }
    return id;
}

// Controllers
function getAllBooks(url, res) {
    const filter = (url.searchParams.get('filter') || '').toLowerCase();
    const result = books.filter(book =>
        !filter || [book.title, book.author, book.category].some(
            value => value.toLowerCase().includes(filter)
        )
    );
    res.statusCode = 200;
    res.end(JSON.stringify(result));
}

function getBookById(id, res) {
    const book = books.find(item => item.id === id);
    if (!book) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'Book not found' }));
    }
    res.statusCode = 200;
    res.end(JSON.stringify(book));
}

async function createBook(req, res) {
    try {
        const book = validateBook(await readBody(req));
        if (!book) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Title, author, and category are required' }));
        }
        const newBook = { id: nextId++, ...book };
        books.push(newBook);
        res.statusCode = 201;
        res.end(JSON.stringify(newBook));
    } catch (error) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: error.message }));
    }
}

async function updateBook(req, id, res) {
    try {
        const index = books.findIndex(book => book.id === id);
        if (index === -1) {
            res.statusCode = 404;
            return res.end(JSON.stringify({ error: 'Book not found' }));
        }
        const book = validateBook(await readBody(req));
        if (!book) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Title, author, and category are required' }));
        }
        books[index] = { id, ...book };
        res.statusCode = 200;
        res.end(JSON.stringify(books[index]));
    } catch (error) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: error.message }));
    }
}

function deleteBook(id, res) {
    const index = books.findIndex(book => book.id === id);
    if (index === -1) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'Book not found' }));
    }
    const deletedBook = books.splice(index, 1)[0];
    res.statusCode = 200;
    res.end(JSON.stringify({ message: 'Book deleted', book: deletedBook }));
}

async function handleBookRoutes(req, res, url) {
    const match = url.pathname.match(/^\/books(?:\/([^/]+))?$/);
    if (!match) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'Route not found' }));
    }

    const idText = match[1];
    if (req.method === 'GET' && idText === undefined) return getAllBooks(url, res);
    if (req.method === 'POST' && idText === undefined) return createBook(req, res);
    if (idText === undefined) {
        res.statusCode = 405;
        return res.end(JSON.stringify({ error: 'Method not allowed' }));
    }

    const id = getBookId(idText, res);
    if (id === null) return;
    if (req.method === 'GET') return getBookById(id, res);
    if (req.method === 'PUT') return updateBook(req, id, res);
    if (req.method === 'DELETE') return deleteBook(id, res);
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
}

function createServer() {
    return http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        // Label every response as JSON so API clients can parse it.
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        Promise.resolve(handleBookRoutes(req, res, url)).catch(error => {
            if (res.headersSent) return res.destroy(error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Internal server error' }));
        });
    });
}

if (require.main === module) {
    createServer().listen(PORT, () => {
        console.log(`Student library running at http://localhost:${PORT}`);
    });
}

module.exports = { createServer, books };
