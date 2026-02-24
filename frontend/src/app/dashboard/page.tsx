"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Plus,
  Brain,
  PlayCircle,
  Clock,
  Calendar,
  LogOut,
  User,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/shared/Button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { Session } from "@/types";
import toast from "react-hot-toast";

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, isAuthenticated, _hasHydrated } = useAuthStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!_hasHydrated) return   // wait for localStorage to rehydrate
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    fetchSessions();
  }, [_hasHydrated, isAuthenticated]);

  const fetchSessions = async () => {
    try {
      const response = await api.getSessions(1, 20);
      setSessions(response.items);
    } catch (error: any) {
      toast.error("Failed to load sessions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSession = async () => {
    const subject = prompt("Enter subject name:");
    if (!subject) return;

    setIsCreating(true);
    try {
      const newSession = await api.createSession(subject);
      toast.success("Session created!");
      router.push(`/classroom/${newSession.id}`);
    } catch (error: any) {
      toast.error("Failed to create session");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSession = async (
    sessionId: string,
    e: React.MouseEvent,
  ) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this session?")) return;

    try {
      await api.deleteSession(sessionId);
      setSessions(sessions.filter((s) => s.id !== sessionId));
      toast.success("Session deleted successfully");
    } catch (error: any) {
      toast.error("Failed to delete session");
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/");
    toast.success("Logged out successfully");
  };

  const formatDateInIST = (dateString: string) => {
    const date = new Date(dateString);
    // Format in IST (UTC+5:30)
    return date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const formatTimeInIST = (dateString: string) => {
    const date = new Date(dateString);
    // Format in IST (UTC+5:30)
    return date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "badge-success";
      case "paused":
        return "badge-warning";
      case "completed":
        return "badge-secondary";
      default:
        return "badge-secondary";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-dark-600">Loading your sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900">
      <nav className="border-b border-dark-700 glass">
        <div className="container-custom flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-dark-800 rounded-lg flex items-center justify-center border-2 border-primary-500/50">
              <Brain className="w-5 h-5 text-primary-500" />
            </div>
            <span className="text-xl font-bold text-dark-50">Aura</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800 border border-dark-700">
              <User className="w-4 h-4 text-dark-200" />
              <span className="text-sm font-medium text-dark-50">
                {user?.fullName}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="container-custom py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-dark-50 mb-2">
                Your Sessions
              </h1>
              <p className="text-lg text-dark-200">
                Manage your teaching sessions and access past lectures
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={handleCreateSession}
              isLoading={isCreating}
              leftIcon={<Plus className="w-5 h-5" />}
            >
              New Session
            </Button>
          </div>

          {sessions.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 bg-dark-800 border-2 border-primary-500/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <PlayCircle className="w-8 h-8 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold text-dark-50 mb-2">
                No sessions yet
              </h3>
              <p className="text-dark-200 mb-6 max-w-md mx-auto">
                Create your first teaching session to start using Aura's
                AI-powered assistance
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={handleCreateSession}
                isLoading={isCreating}
                leftIcon={<Plus className="w-5 h-5" />}
              >
                Create Your First Session
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sessions.map((session, index) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <div className="card p-6 h-full relative group">
                    <div className="flex items-start justify-between mb-4">
                      <Link
                        href={`/classroom/${session.id}`}
                        className="flex-1"
                      >
                        <h3 className="text-xl font-semibold text-dark-50 hover:text-primary-500 transition-colors">
                          {session.subject}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-3 ml-4">
                        <span
                          className={`badge ${getStatusColor(session.status)}`}
                        >
                          {session.status}
                        </span>
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="p-2 rounded-lg bg-dark-900 hover:bg-red-500/20 border border-dark-700 hover:border-red-500 transition-all"
                          title="Delete session"
                        >
                          <Trash2 className="w-4 h-4 text-dark-300 hover:text-red-500 transition-colors" />
                        </button>
                      </div>
                    </div>

                    <Link href={`/classroom/${session.id}`} className="block">
                      <div className="space-y-2 text-sm text-dark-200">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDateInIST(session.startTime)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{formatTimeInIST(session.startTime)}</span>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-dark-700/50">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-dark-200">Context buffer</span>
                          <span className="font-medium text-dark-50">
                            {session.activeBufferTokens.toLocaleString()} tokens
                          </span>
                        </div>
                      </div>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
