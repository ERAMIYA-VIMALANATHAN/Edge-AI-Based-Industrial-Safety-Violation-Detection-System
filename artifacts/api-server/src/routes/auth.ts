import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Mock user store
const USERS = [
  { id: "u1", username: "admin", password: "admin123", role: "admin" as const, name: "Admin User" },
  { id: "u2", username: "supervisor", password: "super123", role: "supervisor" as const, name: "John Supervisor" },
  { id: "u3", username: "viewer", password: "view123", role: "viewer" as const, name: "View Only" },
];

// Mock session store
const sessions = new Map<string, { id: string; username: string; role: string; name: string }>();

function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ error: "Missing username or password" });
    return;
  }
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = generateToken();
  const userData = { id: user.id, username: user.username, role: user.role, name: user.name };
  sessions.set(token, userData);
  res.json({ token, user: userData });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    sessions.delete(authHeader.slice(7));
  }
  res.json({ message: "Logged out" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    // Return default admin for demo purposes
    res.json({ id: "u1", username: "admin", role: "admin", name: "Admin User" });
    return;
  }
  const token = authHeader.slice(7);
  const user = sessions.get(token);
  if (!user) {
    // Return default admin for demo purposes (no strict auth in mock)
    res.json({ id: "u1", username: "admin", role: "admin", name: "Admin User" });
    return;
  }
  res.json(user);
});

export default router;
