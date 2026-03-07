import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Vote, User, CheckCircle2, AlertCircle, LayoutDashboard, LogOut,
  Search, TrendingUp, Users, Eye, EyeOff, Trophy, Instagram,
  ArrowRight, ShieldCheck, ChevronRight, BarChart3
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { db } from "./firebase";
import { collection, doc, getDoc, setDoc, getDocs, deleteDoc } from "firebase/firestore";

type Page = "landing" | "voting" | "voted" | "admin-login" | "admin-dashboard" | "results";

interface LeaderboardItem {
  instagram_username: string;
  vote_count: number;
}

const LeaderboardChart = ({ data }: { data: LeaderboardItem[] }) => {
  const chartData = data.slice(0, 5).map(item => ({
    name: `@${item.instagram_username}`,
    votes: item.vote_count
  }));

  if (chartData.length === 0) return null;

  return (
    <div className="h-[250px] w-full mt-4 mb-8">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" opacity={0.2} />
          <XAxis type="number" hide />
          <YAxis
            dataKey="name"
            type="category"
            width={100}
            tick={{ fontSize: 11, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
          <Bar dataKey="votes" radius={[0, 8, 8, 0]} barSize={30}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index === 0 ? '#6366f1' : '#ec4899'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default function App() {
  const [page, setPage] = useState<Page>("landing");
  const [email, setEmail] = useState("");
  const [instagramUsername, setInstagramUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Admin state
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminData, setAdminData] = useState<{
    totalVotes: number;
    leaderboard: LeaderboardItem[];
    resultsPublished: boolean;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Public results state
  const [publicResults, setPublicResults] = useState<LeaderboardItem[]>([]);

  // Check if results are published on load
  useEffect(() => {
    const checkResults = async () => {
      try {
        const settingsRef = doc(db, "settings", "global");
        const settingsSnap = await getDoc(settingsRef);
        const resultsPublished = settingsSnap.exists() ? settingsSnap.data().results_published : false;

        if (resultsPublished) {
          const votesSnap = await getDocs(collection(db, "votes"));
          const counts: Record<string, number> = {};

          votesSnap.forEach(docSnap => {
            const data = docSnap.data();
            const ig = data.instagram_username;
            counts[ig] = (counts[ig] || 0) + 1;
          });

          const leaderboard = Object.entries(counts)
            .map(([instagram_username, vote_count]) => ({ instagram_username, vote_count }))
            .sort((a, b) => b.vote_count - a.vote_count);

          setPublicResults(leaderboard);
        }
      } catch (err) {
        console.error(err);
      }
    };
    checkResults();
  }, []);

  const handleEnterPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return setError("Please enter your email");

    setLoading(true);
    setError("");

    try {
      const emailLower = email.toLowerCase();
      const voteRef = doc(db, "votes", emailLower);
      const voteSnap = await getDoc(voteRef);

      if (voteSnap.exists()) {
        setError("You have already voted.");
      } else {
        setPage("voting");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instagramUsername) return setError("Please enter an Instagram username");

    setLoading(true);
    setError("");

    try {
      const emailLower = email.toLowerCase();
      const igUser = instagramUsername.toLowerCase().replace("@", "");

      const voteRef = doc(db, "votes", emailLower);
      const voteSnap = await getDoc(voteRef);

      if (voteSnap.exists()) {
        return setError("You have already voted.");
      }

      await setDoc(voteRef, {
        email: emailLower,
        instagram_username: igUser,
        created_at: new Date().toISOString()
      });

      setPage("voted");
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const adminEmailConfig = import.meta.env.VITE_ADMIN_EMAIL || import.meta.env.VITE_FIREBASE_PROJECT_ID;
      const adminPasswordConfig = import.meta.env.VITE_ADMIN_PASSWORD || import.meta.env.VITE_FIREBASE_API_KEY;

      if (adminEmail === adminEmailConfig && adminPassword === adminPasswordConfig) {
        await fetchAdminDashboard();
        setPage("admin-dashboard");
      } else {
        setError("Invalid admin credentials");
      }
    } catch (err) {
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminDashboard = async () => {
    try {
      const votesSnap = await getDocs(collection(db, "votes"));
      let totalVotes = 0;
      const counts: Record<string, number> = {};

      votesSnap.forEach(docSnap => {
        totalVotes++;
        const data = docSnap.data();
        const ig = data.instagram_username;
        counts[ig] = (counts[ig] || 0) + 1;
      });

      const leaderboard = Object.entries(counts)
        .map(([instagram_username, vote_count]) => ({ instagram_username, vote_count }))
        .sort((a, b) => b.vote_count - a.vote_count);

      const settingsRef = doc(db, "settings", "global");
      const settingsSnap = await getDoc(settingsRef);
      const resultsPublished = settingsSnap.exists() ? settingsSnap.data().results_published : false;

      setAdminData({
        totalVotes,
        leaderboard,
        resultsPublished
      });
    } catch (err) {
      console.error("Failed to fetch dashboard data");
    }
  };

  const togglePublish = async () => {
    if (!adminData) return;
    try {
      const newStatus = !adminData.resultsPublished;
      const settingsRef = doc(db, "settings", "global");
      await setDoc(settingsRef, { results_published: newStatus }, { merge: true });
      await fetchAdminDashboard();
    } catch (err) {
      console.error("Failed to toggle publish status");
    }
  };

  const handleDeleteUser = async (instagramUsername: string) => {
    if (!window.confirm(`Are you sure you want to delete all votes for @${instagramUsername}?`)) return;

    try {
      // Find all votes for this user
      const votesSnap = await getDocs(collection(db, "votes"));
      const deletePromises: Promise<void>[] = [];

      votesSnap.forEach(docSnap => {
        if (docSnap.data().instagram_username === instagramUsername) {
          deletePromises.push(deleteDoc(doc(db, "votes", docSnap.id)));
        }
      });

      await Promise.all(deletePromises);
      await fetchAdminDashboard(); // Refresh leaderboard
    } catch (err) {
      console.error("Failed to delete user votes", err);
      alert("Failed to delete votes. Please try again.");
    }
  };

  const filteredLeaderboard = adminData?.leaderboard.filter(item =>
    item.instagram_username.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const renderLanding = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-md w-full mx-auto p-8 bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-100 dark:border-zinc-800"
    >
      <div className="flex justify-center mb-6">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl">
          <Vote className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
        </div>
      </div>
      <h1 className="text-3xl font-bold text-center text-zinc-900 dark:text-white mb-3">
        UniVibe
      </h1>
      <p className="text-zinc-500 dark:text-zinc-400 text-center mb-8">
        Vote for the most popular person in your college. Each email can vote only once.
      </p>

      <form onSubmit={handleEnterPoll} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ml-1">
            Email Address
          </label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your email"
              className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
              required
            />
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
        >
          {loading ? "Checking..." : "Enter Poll"}
          <ArrowRight className="w-5 h-5" />
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
        <button
          onClick={() => setPage("admin-login")}
          className="text-xs text-zinc-400 hover:text-indigo-500 transition-colors flex items-center gap-1"
        >
          <ShieldCheck className="w-3 h-3" />
          Admin Access
        </button>
        {publicResults.length > 0 && (
          <button
            onClick={() => setPage("results")}
            className="text-xs text-indigo-500 font-medium hover:underline flex items-center gap-1"
          >
            <TrendingUp className="w-3 h-3" />
            View Results
          </button>
        )}
      </div>
    </motion.div>
  );

  const renderVoting = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md w-full mx-auto p-8 bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-100 dark:border-zinc-800"
    >
      <div className="flex justify-center mb-6">
        <div className="p-4 bg-pink-50 dark:bg-pink-900/30 rounded-2xl">
          <Instagram className="w-10 h-10 text-pink-600 dark:text-pink-400" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-center text-zinc-900 dark:text-white mb-2">
        Cast Your Vote
      </h2>
      <p className="text-zinc-500 dark:text-zinc-400 text-center mb-8">
        Enter the Instagram username of the person you want to vote for.
      </p>

      <form onSubmit={handleSubmitVote} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ml-1">
            Instagram Username
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-medium">@</span>
            <input
              type="text"
              value={instagramUsername}
              onChange={(e) => setInstagramUsername(e.target.value)}
              placeholder="username"
              className="w-full pl-8 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all dark:text-white"
              required
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-pink-600 hover:bg-pink-700 disabled:bg-pink-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-pink-500/20"
        >
          {loading ? "Submitting..." : "Submit Vote"}
        </button>

        <button
          type="button"
          onClick={() => setPage("landing")}
          className="w-full py-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm transition-colors"
        >
          Cancel
        </button>
      </form>
    </motion.div>
  );

  const renderVoted = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md w-full mx-auto p-10 bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-100 dark:border-zinc-800 text-center"
    >
      <div className="flex justify-center mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 12 }}
          className="p-5 bg-green-50 dark:bg-green-900/30 rounded-full"
        >
          <CheckCircle2 className="w-16 h-16 text-green-600 dark:text-green-400" />
        </motion.div>
      </div>
      <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-3">Vote Recorded!</h2>
      <p className="text-zinc-500 dark:text-zinc-400 mb-8">
        Your vote for <span className="font-bold text-pink-600">@{instagramUsername}</span> has been recorded successfully.
      </p>
      <button
        onClick={() => setPage("landing")}
        className="px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold rounded-xl hover:opacity-90 transition-all"
      >
        Back to Home
      </button>
    </motion.div>
  );

  const renderAdminLogin = () => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-md w-full mx-auto p-8 bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-100 dark:border-zinc-800"
    >
      <div className="flex justify-center mb-6">
        <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
          <ShieldCheck className="w-10 h-10 text-zinc-900 dark:text-white" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-center text-zinc-900 dark:text-white mb-8">Admin Portal</h2>

      <form onSubmit={handleAdminLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ml-1">Admin Email</label>
          <input
            type="text"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-zinc-500 outline-none transition-all dark:text-white"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ml-1">Password</label>
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-zinc-500 outline-none transition-all dark:text-white"
            required
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold rounded-xl hover:opacity-90 transition-all"
        >
          {loading ? "Authenticating..." : "Login to Dashboard"}
        </button>

        <button
          type="button"
          onClick={() => setPage("landing")}
          className="w-full py-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm transition-colors"
        >
          Back to Poll
        </button>
      </form>
    </motion.div>
  );

  const renderAdminDashboard = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl w-full mx-auto p-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Manage poll results and visibility</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={togglePublish}
            className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all ${adminData?.resultsPublished
              ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
              }`}
          >
            {adminData?.resultsPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {adminData?.resultsPublished ? "Unpublish Results" : "Publish Results"}
          </button>
          <button
            onClick={() => setPage("landing")}
            className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-indigo-500" />
            <span className="text-sm font-medium text-zinc-500">Total Votes</span>
          </div>
          <div className="text-3xl font-bold text-zinc-900 dark:text-white">{adminData?.totalVotes || 0}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-pink-500" />
            <span className="text-sm font-medium text-zinc-500">Unique Candidates</span>
          </div>
          <div className="text-3xl font-bold text-zinc-900 dark:text-white">{adminData?.leaderboard.length || 0}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <LayoutDashboard className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-zinc-500">Status</span>
          </div>
          <div className={`text-xl font-bold ${adminData?.resultsPublished ? "text-green-500" : "text-amber-500"}`}>
            {adminData?.resultsPublished ? "Live" : "Draft"}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Vote Distribution</h3>
          </div>
          <p className="text-xs text-zinc-500">Top 5 candidates by vote count</p>
          <LeaderboardChart data={adminData?.leaderboard || []} />
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Leaderboard</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Rank</th>
                <th className="px-6 py-4 font-semibold">Instagram Username</th>
                <th className="px-6 py-4 font-semibold text-right">Votes</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredLeaderboard.map((item, index) => (
                <tr key={item.instagram_username} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? "bg-amber-100 text-amber-700" :
                      index === 1 ? "bg-zinc-200 text-zinc-700" :
                        index === 2 ? "bg-orange-100 text-orange-700" :
                          "text-zinc-400"
                      }`}>
                      {index + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-tr from-amber-400 via-pink-500 to-indigo-600 rounded-full flex items-center justify-center text-white">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-zinc-900 dark:text-white">@{item.instagram_username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-zinc-900 dark:text-white">
                    {item.vote_count}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDeleteUser(item.instagram_username)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredLeaderboard.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-400">
                    No candidates found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );

  const renderResults = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl w-full mx-auto p-8 bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-100 dark:border-zinc-800"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-500" />
            Poll Results
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400">The most popular people in college</p>
        </div>
        <button
          onClick={() => setPage("landing")}
          className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-indigo-500" />
          <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Visual Standings</h3>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-700">
          <LeaderboardChart data={publicResults} />
        </div>
      </div>

      <div className="space-y-4">
        {publicResults.map((item, index) => (
          <motion.div
            key={item.instagram_username}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-4 rounded-2xl border flex items-center justify-between ${index === 0
              ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
              : "bg-zinc-50 border-zinc-100 dark:bg-zinc-800/50 dark:border-zinc-700"
              }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${index === 0 ? "bg-amber-400 text-white" :
                index === 1 ? "bg-zinc-300 text-zinc-700" :
                  index === 2 ? "bg-orange-300 text-white" :
                    "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                }`}>
                {index + 1}
              </div>
              <div>
                <div className="font-bold text-zinc-900 dark:text-white">@{item.instagram_username}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-wide">Candidate</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-zinc-900 dark:text-white">{item.vote_count}</div>
              <div className="text-[10px] text-zinc-500 uppercase font-bold">Votes</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <p className="text-zinc-400 text-sm mb-4">Thank you for participating in the poll!</p>
        <button
          onClick={() => setPage("landing")}
          className="px-6 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all font-medium"
        >
          Back to Home
        </button>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-4 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900">
      <AnimatePresence mode="wait">
        {page === "landing" && renderLanding()}
        {page === "voting" && renderVoting()}
        {page === "voted" && renderVoted()}
        {page === "admin-login" && renderAdminLogin()}
        {page === "admin-dashboard" && renderAdminDashboard()}
        {page === "results" && renderResults()}
      </AnimatePresence>

      {/* Background decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/5 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-pink-500/5 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}
