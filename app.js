// ============================================
// DIGITAL LOGBOOK - MAIN APPLICATION
// ============================================

// ===== GLOBAL STATE =====
let currentUser = null;
let userRole = null;
let booksListener = null;
let transactionsListener = null;
let studentHistoryListener = null;
let html5QrCode = null;
let currentBookFilter = 'all';
let currentActionBookId = null;
let currentActionType = null;

// ===== SCREEN MANAGEMENT =====
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function showLoading(show = true) {
    document.getElementById('loading').classList.toggle('active', show);
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `<i class="fas ${icons[type]}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== LOGIN TABS =====
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.login-form').forEach(form => form.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(`${tab}-login`).classList.add('active');
}

// ===== AUTHENTICATION =====

// Google Sign-In (Student)
function signInWithGoogle() {
    showLoading(true);
    const provider = new firebase.auth.GoogleAuthProvider();

    auth.signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            return ensureUserExists(user.uid, {
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                role: 'student'
            });
        })
        .then(() => {
            showToast('Welcome, Student!', 'success');
        })
        .catch((error) => {
            console.error('Google sign-in error:', error);
            showToast('Sign-in failed: ' + error.message, 'error');
            showLoading(false);
        });
}

// Admin Login
function signInAdmin() {
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

    if (!email || !password) {
        showToast('Please enter email and password', 'warning');
        return;
    }

    showLoading(true);

    auth.signInWithEmailAndPassword(email, password)
        .then((result) => {
            const user = result.user;
            return ensureUserExists(user.uid, {
                email: user.email,
                displayName: 'Admin',
                role: 'admin'
            });
        })
        .then(() => {
            showToast('Welcome, Admin!', 'success');
        })
        .catch((error) => {
            console.error('Admin login error:', error);
            showToast('Login failed: ' + error.message, 'error');
            showLoading(false);
        });
}

// Ensure user exists in Firestore
function ensureUserExists(uid, userData) {
    return db.collection('users').doc(uid).get().then((doc) => {
        if (!doc.exists) {
            return db.collection('users').doc(uid).set({
                ...userData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    });
}

// Logout
function logout() {
    showLoading(true);

    // Unsubscribe listeners
    if (booksListener) booksListener();
    if (transactionsListener) transactionsListener();
    if (studentHistoryListener) studentHistoryListener();

    auth.signOut().then(() => {
        currentUser = null;
        userRole = null;
        showScreen('login-screen');
        showLoading(false);
        showToast('Logged out successfully', 'info');
    }).catch((error) => {
        showToast('Logout failed: ' + error.message, 'error');
        showLoading(false);
    });
}

// Auth State Listener
auth.onAuthStateChanged((user) => {
    showLoading(true);

    if (user) {
        currentUser = user;

        // Check user role
        db.collection('users').doc(user.uid).get().then((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                userRole = userData.role || 'student';

                if (userRole === 'admin') {
                    setupAdminDashboard();
                    showScreen('admin-screen');
                } else {
                    setupStudentDashboard(userData);
                    showScreen('student-screen');
                }
            } else {
                // New Google user, default to student
                userRole = 'student';
                ensureUserExists(user.uid, {
                    email: user.email,
                    displayName: user.displayName || 'Student',
                    photoURL: user.photoURL || '',
                    role: 'student'
                }).then(() => {
                    setupStudentDashboard({
                        displayName: user.displayName || 'Student',
                        photoURL: user.photoURL || ''
                    });
                    showScreen('student-screen');
                });
            }
            showLoading(false);
        }).catch((error) => {
            console.error('Error fetching user data:', error);
            showToast('Error loading user data', 'error');
            showLoading(false);
        });
    } else {
        currentUser = null;
        userRole = null;
        showScreen('login-screen');
        showLoading(false);
    }
});

// ===== STUDENT DASHBOARD =====
function setupStudentDashboard(userData) {
    const name = userData.displayName || currentUser.displayName || 'Student';
    const photo = userData.photoURL || currentUser.photoURL || 'https://via.placeholder.com/150';

    document.getElementById('student-name').textContent = name;
    document.getElementById('welcome-name').textContent = name;
    document.getElementById('student-avatar').src = photo;

    // Load student history
    loadStudentHistory();
}

function loadStudentHistory() {
    if (studentHistoryListener) studentHistoryListener();

    const historyList = document.getElementById('student-history');

    studentHistoryListener = db.collection('transactions')
        .where('studentId', '==', currentUser.uid)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .onSnapshot((snapshot) => {
            if (snapshot.empty) {
                historyList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>No transactions yet. Scan a QR code to get started!</p>
                    </div>
                `;
                return;
            }

            let html = '';
            snapshot.forEach((doc) => {
                const t = doc.data();
                const time = t.timestamp ? t.timestamp.toDate().toLocaleString() : 'Just now';
                const iconClass = t.type === 'borrow' ? 'borrow' : 'return';
                const icon = t.type === 'borrow' ? 'fa-book' : 'fa-undo';

                html += `
                    <div class="transaction-item">
                        <div class="transaction-icon ${iconClass}">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="transaction-details">
                            <div class="transaction-book">${t.bookTitle}</div>
                            <div class="transaction-meta">
                                ${t.type === 'borrow' ? 'Borrowed' : 'Returned'} 
                                ${t.notes ? '· ' + t.notes : ''}
                            </div>
                        </div>
                        <div class="transaction-time">${time}</div>
                    </div>
                `;
            });

            historyList.innerHTML = html;
        }, (error) => {
            console.error('History listener error:', error);
            if (error.code === 'permission-denied') {
                historyList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-lock"></i>
                        <p>Unable to load history. Please check permissions.</p>
                    </div>
                `;
            }
        });
}

// ===== ADMIN DASHBOARD =====
function setupAdminDashboard() {
    document.getElementById('admin-name').innerHTML = `<i class="fas fa-shield-alt"></i> ${currentUser.email}`;

    // Load stats
    loadAdminStats();

    // Load books
    loadBooks();

    // Load transactions
    loadTransactions();
}

function loadAdminStats() {
    // Total books
    db.collection('books').onSnapshot((snapshot) => {
        document.getElementById('stat-total-books').textContent = snapshot.size;

        let borrowed = 0;
        let available = 0;
        snapshot.forEach((doc) => {
            const book = doc.data();
            if (book.status === 'borrowed') borrowed++;
            else available++;
        });

        document.getElementById('stat-borrowed').textContent = borrowed;
        document.getElementById('stat-available').textContent = available;
    });

    // Total transactions
    db.collection('transactions').onSnapshot((snapshot) => {
        document.getElementById('stat-transactions').textContent = snapshot.size;
    });
}

// ===== BOOKS MANAGEMENT =====
function loadBooks() {
    if (booksListener) booksListener();

    const booksList = document.getElementById('books-list');

    booksListener = db.collection('books')
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            if (snapshot.empty) {
                booksList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-books"></i>
                        <p>No books added yet. Add your first book above!</p>
                    </div>
                `;
                return;
            }

            let html = '';
            snapshot.forEach((doc) => {
                const book = doc.data();
                const bookId = doc.id;

                // Filter
                if (currentBookFilter !== 'all' && book.status !== currentBookFilter) {
                    return;
                }

                const statusClass = book.status === 'borrowed' ? 'borrowed' : 'available';
                const statusLabel = book.status === 'borrowed' ? 'Borrowed' : 'Available';
                const statusBadgeClass = book.status === 'borrowed' ? 'status-borrowed' : 'status-available';

                let borrowedHtml = '';
                if (book.status === 'borrowed' && book.borrowedByName) {
                    const time = book.borrowedAt ? book.borrowedAt.toDate().toLocaleString() : 'Unknown';
                    borrowedHtml = `
                        <div class="borrowed-info">
                            <i class="fas fa-user-clock"></i>
                            Borrowed by ${book.borrowedByName} on ${time}
                        </div>
                    `;
                }

                html += `
                    <div class="book-card ${statusClass}">
                        <div class="book-header">
                            <div>
                                <div class="book-title">${escapeHtml(book.title)}</div>
                                <div class="book-author">by ${escapeHtml(book.author)}</div>
                            </div>
                            <span class="book-status ${statusBadgeClass}">${statusLabel}</span>
                        </div>
                        <div class="book-actions">
                            <button class="btn-small btn-view" onclick="showQRCode('${bookId}', '${escapeHtml(book.title)}')">
                                <i class="fas fa-qrcode"></i> QR Code
                            </button>
                            <button class="btn-small btn-delete" onclick="deleteBook('${bookId}', '${escapeHtml(book.title)}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                        ${borrowedHtml}
                    </div>
                `;
            });

            if (html === '') {
                booksList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-filter"></i>
                        <p>No books match the current filter.</p>
                    </div>
                `;
            } else {
                booksList.innerHTML = html;
            }
        }, (error) => {
            console.error('Books listener error:', error);
        });
}

function filterBooks(filter) {
    currentBookFilter = filter;

    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    loadBooks();
}

function addBook() {
    const title = document.getElementById('book-title').value.trim();
    const author = document.getElementById('book-author').value.trim();

    if (!title || !author) {
        showToast('Please enter both title and author', 'warning');
        return;
    }

    showLoading(true);

    const bookData = {
        title: title,
        author: author,
        status: 'available',
        borrowedBy: null,
        borrowedByName: null,
        borrowedAt: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('books').add(bookData)
        .then((docRef) => {
            // Update with QR data (using the doc ID)
            return docRef.update({
                qrData: docRef.id
            }).then(() => {
                showToast(`"${title}" added successfully!`, 'success');
                document.getElementById('book-title').value = '';
                document.getElementById('book-author').value = '';
                showLoading(false);

                // Show QR code
                setTimeout(() => {
                    showQRCode(docRef.id, title);
                }, 500);
            });
        })
        .catch((error) => {
            console.error('Error adding book:', error);
            showToast('Error adding book: ' + error.message, 'error');
            showLoading(false);
        });
}

function deleteBook(bookId, bookTitle) {
    if (!confirm(`Are you sure you want to delete "${bookTitle}"?`)) {
        return;
    }

    showLoading(true);

    db.collection('books').doc(bookId).delete()
        .then(() => {
            showToast(`"${bookTitle}" deleted successfully`, 'success');
            showLoading(false);
        })
        .catch((error) => {
            console.error('Error deleting book:', error);
            showToast('Error deleting book: ' + error.message, 'error');
            showLoading(false);
        });
}

// ===== QR CODE =====
function showQRCode(bookId, bookTitle) {
    const modal = document.getElementById('qr-modal');
    const display = document.getElementById('qr-display');
    const titleEl = document.getElementById('qr-book-title');

    display.innerHTML = '';
    titleEl.textContent = bookTitle;

    // Generate QR code
    new QRCode(display, {
        text: bookId,
        width: 200,
        height: 200,
        colorDark: '#4f46e5',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    modal.classList.add('active');
}

function closeQRModal() {
    document.getElementById('qr-modal').classList.remove('active');
}

function downloadQR() {
    const canvas = document.querySelector('#qr-display canvas');
    if (canvas) {
        const link = document.createElement('a');
        link.download = 'book-qr-code.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('QR code downloaded!', 'success');
    }
}

// ===== QR SCANNER =====
function openScanner() {
    const modal = document.getElementById('scanner-modal');
    modal.classList.add('active');

    // Initialize scanner
    const reader = document.getElementById('reader');
    reader.innerHTML = '';

    html5QrCode = new Html5Qrcode('reader');

    html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        onScanFailure
    ).catch((error) => {
        console.error('Scanner error:', error);
        showToast('Camera error: ' + error.message, 'error');
        closeScanner();
    });
}

function closeScanner() {
    const modal = document.getElementById('scanner-modal');
    modal.classList.remove('active');

    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            html5QrCode = null;
        }).catch((error) => {
            console.error('Error stopping scanner:', error);
        });
    }
}

function onScanSuccess(decodedText) {
    // Stop scanner
    closeScanner();

    // Look up book
    showLoading(true);

    db.collection('books').doc(decodedText).get()
        .then((doc) => {
            showLoading(false);

            if (!doc.exists) {
                showToast('Invalid QR code. Book not found.', 'error');
                return;
            }

            const book = doc.data();
            showBookAction(doc.id, book);
        })
        .catch((error) => {
            showLoading(false);
            console.error('Error looking up book:', error);
            showToast('Error looking up book', 'error');
        });
}

function onScanFailure(error) {
    // Ignore scan failures (they happen constantly while scanning)
}

// ===== BOOK ACTION (Borrow/Return) =====
function showBookAction(bookId, book) {
    currentActionBookId = bookId;

    const modal = document.getElementById('book-action-modal');
    const infoEl = document.getElementById('action-book-info');
    const btn = document.getElementById('action-btn');

    const isBorrowed = book.status === 'borrowed';
    const isBorrowedByMe = book.borrowedBy === currentUser.uid;

    // Build info card
    let statusHtml = '';
    if (isBorrowed) {
        if (isBorrowedByMe) {
            statusHtml = `<span class="book-status status-borrowed">Borrowed by You</span>`;
        } else {
            statusHtml = `<span class="book-status status-borrowed">Borrowed by ${escapeHtml(book.borrowedByName || 'Someone')}</span>`;
        }
    } else {
        statusHtml = `<span class="book-status status-available">Available</span>`;
    }

    infoEl.innerHTML = `
        <div class="book-title-large">${escapeHtml(book.title)}</div>
        <div class="book-author-large">by ${escapeHtml(book.author)}</div>
        <div style="margin-top: 10px;">${statusHtml}</div>
    `;

    // Determine action
    if (isBorrowed) {
        if (isBorrowedByMe) {
            currentActionType = 'return';
            btn.innerHTML = '<i class="fas fa-undo"></i> Return Book';
            btn.onclick = () => performAction('return');
            btn.style.background = 'var(--success)';
        } else {
            currentActionType = 'unavailable';
            btn.innerHTML = '<i class="fas fa-lock"></i> Currently Borrowed';
            btn.onclick = null;
            btn.style.background = 'var(--gray)';
            btn.style.cursor = 'not-allowed';
        }
    } else {
        currentActionType = 'borrow';
        btn.innerHTML = '<i class="fas fa-book"></i> Borrow Book';
        btn.onclick = () => performAction('borrow');
        btn.style.background = 'var(--primary)';
        btn.style.cursor = 'pointer';
    }

    modal.classList.add('active');
}

function closeBookAction() {
    document.getElementById('book-action-modal').classList.remove('active');
    currentActionBookId = null;
    currentActionType = null;
    document.getElementById('action-notes').value = '';
}

function performAction(type) {
    if (!currentActionBookId || !currentUser) return;

    const notes = document.getElementById('action-notes').value.trim();

    showLoading(true);

    const batch = db.batch();
    const bookRef = db.collection('books').doc(currentActionBookId);
    const transactionRef = db.collection('transactions').doc();

    // Get book data first
    bookRef.get().then((doc) => {
        if (!doc.exists) {
            throw new Error('Book not found');
        }

        const book = doc.data();

        // Update book
        if (type === 'borrow') {
            batch.update(bookRef, {
                status: 'borrowed',
                borrowedBy: currentUser.uid,
                borrowedByName: currentUser.displayName || currentUser.email,
                borrowedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            batch.update(bookRef, {
                status: 'available',
                borrowedBy: null,
                borrowedByName: null,
                borrowedAt: null
            });
        }

        // Create transaction
        batch.set(transactionRef, {
            bookId: currentActionBookId,
            bookTitle: book.title,
            studentId: currentUser.uid,
            studentName: currentUser.displayName || currentUser.email,
            studentEmail: currentUser.email,
            type: type,
            notes: notes || null,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        return batch.commit();
    })
    .then(() => {
        showLoading(false);
        closeBookAction();

        const actionText = type === 'borrow' ? 'borrowed' : 'returned';
        showToast(`Book ${actionText} successfully!`, 'success');
    })
    .catch((error) => {
        showLoading(false);
        console.error('Transaction error:', error);
        showToast('Error: ' + error.message, 'error');
    });
}

// ===== TRANSACTIONS LOG =====
function loadTransactions() {
    if (transactionsListener) transactionsListener();

    const list = document.getElementById('transactions-list');

    transactionsListener = db.collection('transactions')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .onSnapshot((snapshot) => {
            if (snapshot.empty) {
                list.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>No transactions recorded yet.</p>
                    </div>
                `;
                return;
            }

            let html = '';
            snapshot.forEach((doc) => {
                const t = doc.data();
                const time = t.timestamp ? t.timestamp.toDate().toLocaleString() : 'Just now';
                const iconClass = t.type === 'borrow' ? 'borrow' : 'return';
                const icon = t.type === 'borrow' ? 'fa-book' : 'fa-undo';

                html += `
                    <div class="transaction-item">
                        <div class="transaction-icon ${iconClass}">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="transaction-details">
                            <div class="transaction-book">${escapeHtml(t.bookTitle)}</div>
                            <div class="transaction-meta">
                                ${t.type === 'borrow' ? 'Borrowed' : 'Returned'} by ${escapeHtml(t.studentName || 'Unknown')}
                                ${t.notes ? '· ' + escapeHtml(t.notes) : ''}
                            </div>
                        </div>
                        <div class="transaction-time">${time}</div>
                    </div>
                `;
            });

            list.innerHTML = html;
        }, (error) => {
            console.error('Transactions listener error:', error);
        });
}

// ===== UTILITIES =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeScanner();
        closeBookAction();
        closeQRModal();
    }
});

// ===== INITIALIZATION =====
console.log('Digital Logbook App Loaded');
console.log('Make sure to update firebase-config.js with your Firebase credentials!');
