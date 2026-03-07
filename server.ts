import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, setDoc, getDocs } from "firebase/firestore";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Ensure settings exist in Firestore
async function initDb() {
  try {
    const settingsRef = doc(db, "settings", "global");
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      await setDoc(settingsRef, { results_published: false });
      console.log("Initialized global settings in Firestore.");
    }
  } catch (error) {
    console.error("Firebase init error:", error);
  }
}
initDb();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes

  // Check if email has voted
  app.get("/api/check-email/:email", async (req, res) => {
    try {
      const { email } = req.params;
      const emailLower = email.toLowerCase();
      // Use email as document ID
      const voteRef = doc(db, "votes", emailLower);
      const voteSnap = await getDoc(voteRef);
      res.json({ hasVoted: voteSnap.exists() });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Submit vote
  app.post("/api/vote", async (req, res) => {
    const { email, instagramUsername } = req.body;

    if (!email || !instagramUsername) {
      return res.status(400).json({ error: "Email and Instagram username are required" });
    }

    try {
      const emailLower = email.toLowerCase();
      const igUser = instagramUsername.toLowerCase().replace("@", "");

      const voteRef = doc(db, "votes", emailLower);
      const voteSnap = await getDoc(voteRef);

      if (voteSnap.exists()) {
        return res.status(400).json({ error: "You have already voted." });
      }

      await setDoc(voteRef, {
        email: emailLower,
        instagram_username: igUser,
        created_at: new Date().toISOString()
      });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin Login
  app.post("/api/admin/login", (req, res) => {
    const { email, password } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (email === adminEmail && password === adminPassword) {
      res.json({ success: true, token: "mock-admin-token" });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Admin Dashboard Data
  app.get("/api/admin/dashboard", async (req, res) => {
    try {
      const votesSnap = await getDocs(collection(db, "votes"));
      let totalVotes = 0;
      const counts: Record<string, number> = {};

      votesSnap.forEach(doc => {
        totalVotes++;
        const data = doc.data();
        const ig = data.instagram_username;
        counts[ig] = (counts[ig] || 0) + 1;
      });

      const leaderboard = Object.entries(counts)
        .map(([instagram_username, vote_count]) => ({ instagram_username, vote_count }))
        .sort((a, b) => b.vote_count - a.vote_count);

      const settingsRef = doc(db, "settings", "global");
      const settingsSnap = await getDoc(settingsRef);
      const resultsPublished = settingsSnap.exists() ? settingsSnap.data().results_published : false;

      res.json({
        totalVotes,
        leaderboard,
        resultsPublished
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Publish/Unpublish Results
  app.post("/api/admin/publish", async (req, res) => {
    try {
      const { published } = req.body;
      const settingsRef = doc(db, "settings", "global");
      await setDoc(settingsRef, { results_published: published }, { merge: true });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Public Results
  app.get("/api/results", async (req, res) => {
    try {
      const settingsRef = doc(db, "settings", "global");
      const settingsSnap = await getDoc(settingsRef);
      const resultsPublished = settingsSnap.exists() ? settingsSnap.data().results_published : false;

      if (!resultsPublished) {
        return res.status(403).json({ error: "Results are not published yet" });
      }

      const votesSnap = await getDocs(collection(db, "votes"));
      const counts: Record<string, number> = {};

      votesSnap.forEach(doc => {
        const data = doc.data();
        const ig = data.instagram_username;
        counts[ig] = (counts[ig] || 0) + 1;
      });

      const leaderboard = Object.entries(counts)
        .map(([instagram_username, vote_count]) => ({ instagram_username, vote_count }))
        .sort((a, b) => b.vote_count - a.vote_count);

      res.json({ leaderboard });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
