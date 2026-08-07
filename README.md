# Digital Logbook - QR Library System

A complete digital logbook application with QR code scanning, book management, and borrow/return tracking. Built with vanilla HTML/CSS/JS and Firebase (free tier).

## Features

- **Student Login**: Google Sign-In (verified names, no faking!)
- **Admin Login**: Secure email/password authentication
- **QR Code Generation**: Auto-generated unique QR codes for each book
- **QR Code Scanning**: Built-in camera scanner for borrow/return
- **Book Management**: Add, view, delete books (Admin only)
- **Borrow/Return System**: Track who borrowed what and when
- **Transaction Logbook**: Complete history of all transactions
- **Real-time Updates**: Live data sync across all users
- **Offline Support**: Works offline with Firebase persistence
- **Responsive Design**: Works on mobile, tablet, and desktop

## Demo Accounts

### Student
- Click "Sign in with Google" button
- Use any Google account

### Admin
- **Email**: `admin@logbook.com`
- **Password**: `admin123`
- *Note: You should change this after first login by creating a new admin account in Firebase Console*

## Setup Instructions

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project" and follow the setup
3. Once created, click the **Gear icon** → **Project Settings**
4. Under "Your apps", click the **</>** icon to add a web app
5. Copy the `firebaseConfig` object

### 2. Update Configuration

Open `js/firebase-config.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
    apiKey: "your-actual-api-key",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};
```

### 3. Enable Authentication

1. In Firebase Console, go to **Build** → **Authentication**
2. Click **Get Started**
3. Enable **Google** provider:
   - Toggle Google to "Enabled"
   - Add support email
   - Save
4. Enable **Email/Password** provider:
   - Toggle Email/Password to "Enabled"
   - Save

### 4. Setup Admin Account

1. In Firebase Console, go to **Build** → **Authentication**
2. Click **Add User**
3. Enter:
   - Email: `admin@logbook.com`
   - Password: `admin123`
4. Click **Add User**

### 5. Create Firestore Database

1. In Firebase Console, go to **Build** → **Firestore Database**
2. Click **Create Database**
3. Choose **Start in test mode** (or use the security rules below)
4. Select a location close to your users
5. Click **Enable**

### 6. Setup Security Rules

1. Go to **Firestore Database** → **Rules**
2. Replace with these rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - users can read their own data, admins can read all
    match /users/{userId} {
      allow read: if request.auth != null && (request.auth.uid == userId || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Books collection - anyone can read, only admins can write
    match /books/{bookId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Transactions collection - anyone can read, authenticated users can create
    match /transactions/{transactionId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.studentId == request.auth.uid;
      allow update, delete: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

3. Click **Publish**

### 7. Create Firestore Indexes

Some queries require composite indexes. The app will prompt you to create them if missing, or you can create them manually:

1. Go to **Firestore Database** → **Indexes**
2. Click **Add Index**
3. Create these indexes:

**Collection: transactions**
- Fields:
  - `studentId` (Ascending)
  - `timestamp` (Descending)
- Query scope: Collection

**Collection: transactions**
- Fields:
  - `timestamp` (Descending)
- Query scope: Collection

**Collection: books**
- Fields:
  - `createdAt` (Descending)
- Query scope: Collection

### 8. Deploy to GitHub Pages

1. Create a new repository on GitHub
2. Push these files to the repository:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/digital-logbook.git
git push -u origin main
```
3. Go to repository **Settings** → **Pages**
4. Under "Source", select **Deploy from a branch**
5. Select **main** branch and **/(root)** folder
6. Click **Save**
7. Wait a few minutes, then visit the provided URL

## File Structure

```
digital-logbook/
├── index.html          # Main application (single page)
├── css/
│   └── style.css       # All styles
├── js/
│   ├── firebase-config.js  # Firebase configuration (UPDATE THIS!)
│   └── app.js          # Application logic
├── firestore.rules     # Firestore security rules
├── firestore.indexes.json  # Firestore indexes
└── README.md           # This file
```

## How It Works

### For Students:
1. Login with Google (verified identity)
2. Click "Scan QR Code" to open camera
3. Scan a book's QR code
4. Click "Borrow Book" or "Return Book"
5. View your borrowing history

### For Admins:
1. Login with admin email/password
2. View dashboard stats (total books, borrowed, available, transactions)
3. Add new books with auto-generated QR codes
4. Download and print QR codes to paste on books
5. View all books and filter by status
6. View complete transaction logbook
7. Delete books if needed

## QR Code Flow

1. Admin adds a book → System generates unique QR code using Firestore document ID
2. Admin downloads/prints QR code → Pastes it on the physical book
3. Student scans QR code → System looks up book by ID
4. Student borrows/returns → System updates book status and logs transaction

## Troubleshooting

### Camera not working?
- Make sure you're using HTTPS (required for camera access)
- Allow camera permissions when prompted
- Try a different browser (Chrome recommended)
- On mobile, use the rear camera

### "Permission Denied" errors?
- Check that you're logged in
- Verify Firestore security rules are published
- Make sure the user has the correct role in the `users` collection

### Indexes errors?
- Check browser console for index creation links
- Or manually create indexes in Firebase Console

### Google Sign-In not working?
- Verify Google provider is enabled in Firebase Auth
- Add your domain to authorized domains in Firebase Console → Authentication → Settings → Authorized domains
- For GitHub Pages, add `YOUR_USERNAME.github.io`

## Customization

### Change Admin Credentials
1. Create a new admin user in Firebase Authentication
2. Login with new credentials
3. Delete the old admin user if desired

### Change Colors
Edit `css/style.css` and modify the CSS variables at the top:
```css
:root {
    --primary: #4f46e5;    /* Main color */
    --secondary: #06b6d4;  /* Accent color */
    --success: #10b981;    /* Success color */
    --warning: #f59e0b;    /* Warning color */
    --danger: #ef4444;     /* Danger color */
}
```

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Firebase (Authentication + Firestore)
- **QR Generation**: QRCode.js
- **QR Scanning**: html5-qrcode
- **Icons**: Font Awesome 6
- **Hosting**: GitHub Pages (free)

## License

MIT License - Free to use and modify!

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify Firebase configuration
3. Check Firestore rules and indexes
4. Make sure all Firebase services are enabled
