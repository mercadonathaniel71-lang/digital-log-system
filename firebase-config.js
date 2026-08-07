// ============================================
// FIREBASE CONFIGURATION
// ============================================
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project
// 3. Enable Authentication (Google & Email/Password)
// 4. Create a Firestore Database
// 5. Copy your config object from Project Settings
// ============================================

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('Multiple tabs open, persistence enabled in first tab only.');
        } else if (err.code === 'unimplemented') {
            console.warn('Browser does not support offline persistence.');
        }
    });
